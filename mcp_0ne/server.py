"""mcp-0ne FastAPI server.

The main entry point. Sets up the FastAPI app, initializes the registry,
mounts the REST API, and exposes SSE + JSON-RPC MCP endpoints.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, Sequence

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from mcp.server import Server as McpServer
from mcp.server.streamable_http import StreamableHTTPServerTransport
from mcp.types import Tool, TextContent
from starlette.requests import Request as StarletteRequest
from starlette.routing import Route

from . import __version__
from .api import router as api_router, set_registry
from .config import HOST, PORT, LOG_LEVEL
from .protocol import GatewayProtocol
from .registry import BackendRegistry

logger = logging.getLogger("mcp_0ne")

# Global registry and protocol — initialized in lifespan
registry = BackendRegistry()
protocol = GatewayProtocol(registry)

# ── MCP SDK Server (streamable HTTP transport) ─────────────────────
mcp_server = McpServer("mcp-0ne")
# Transport is created per-session in the request handler


@mcp_server.list_tools()
async def _mcp_list_tools() -> list[Tool]:
    """Return all gateway tools (admin + backend) via MCP SDK."""
    await registry.ensure_all_connected()
    from .admin_tools import get_admin_tool_definitions
    raw_tools = list(get_admin_tool_definitions()) + list(registry.list_all_tools())
    return [Tool(**t) for t in raw_tools]


@mcp_server.call_tool()
async def _mcp_call_tool(name: str, arguments: dict[str, Any] | None = None) -> Sequence[TextContent]:
    """Route tool calls through the gateway protocol."""
    import json
    from .admin_tools import handle_admin_tool
    arguments = arguments or {}

    # Try admin tools first
    admin_result = await handle_admin_tool(name, arguments, registry)
    if admin_result is not None:
        content = admin_result.get("content", [])
        return [TextContent(type="text", text=c.get("text", json.dumps(c))) for c in content]

    # Route to backend
    result = await registry.call_tool(name, arguments)
    content = result.get("content", [])
    return [TextContent(type="text", text=c.get("text", json.dumps(c))) for c in content]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: load config and connect backends. Shutdown: disconnect all."""
    logger.info("mcp-0ne starting up...")
    results = await registry.load_from_config()
    for backend_id, status in results.items():
        logger.info(f"  [{backend_id}] {status}")
    logger.info(f"mcp-0ne ready — {len(registry.list_all_tools())} tools from {len(registry.list_backends())} backends")

    yield

    logger.info("mcp-0ne shutting down...")
    for info in registry.list_backends():
        backend = registry.get_backend(info["id"])
        if backend and backend.state.value == "connected":
            try:
                await backend.disconnect()
            except Exception as e:
                logger.warning(f"Error disconnecting {info['id']}: {e}")
    logger.info("mcp-0ne stopped")


app = FastAPI(
    title="mcp-0ne",
    description="MCP Gateway — one server to multiplex N backend MCP servers",
    version=__version__,
    lifespan=lifespan,
)

# CORS — allow desktop app (electron-vite dev server) to fetch
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Wire up REST API
set_registry(registry)
app.include_router(api_router)


# ── Streamable HTTP MCP transport ───────────────────────────────────
import asyncio
import uuid

# Session map: mcp-session-id → transport
_http_transports: dict[str, StreamableHTTPServerTransport] = {}
_session_tasks: dict[str, asyncio.Task] = {}


async def _run_mcp_session(transport: StreamableHTTPServerTransport):
    """Keep the transport's connect() context alive for the session lifetime."""
    async with transport.connect() as (read_stream, write_stream):
        await mcp_server.run(
            read_stream, write_stream, mcp_server.create_initialization_options()
        )


async def _handle_mcp_http(request: StarletteRequest):
    """POST/GET/DELETE /mcp — MCP streamable HTTP transport."""
    session_id = request.headers.get("mcp-session-id")

    if request.method == "GET":
        if session_id and session_id in _http_transports:
            transport = _http_transports[session_id]
            await transport.handle_request(request.scope, request.receive, request._send)
        else:
            from starlette.responses import JSONResponse
            resp = JSONResponse({"error": "No session"}, status_code=400)
            await resp(request.scope, request.receive, request._send)
        return

    if request.method == "DELETE":
        if session_id and session_id in _http_transports:
            transport = _http_transports.pop(session_id)
            task = _session_tasks.pop(session_id, None)
            await transport.handle_request(request.scope, request.receive, request._send)
            if task:
                task.cancel()
        return

    # POST — main request path
    if session_id and session_id in _http_transports:
        transport = _http_transports[session_id]
        await transport.handle_request(request.scope, request.receive, request._send)
    else:
        # New session — create transport, start server.run in background
        new_id = f"mcp0ne-{uuid.uuid4().hex[:12]}"
        transport = StreamableHTTPServerTransport(new_id, is_json_response_enabled=True)
        _http_transports[new_id] = transport
        _session_tasks[new_id] = asyncio.create_task(_run_mcp_session(transport))
        # Small yield to let connect() establish before handling the request
        await asyncio.sleep(0.01)
        await transport.handle_request(request.scope, request.receive, request._send)


app.routes.insert(0, Route("/mcp", endpoint=_handle_mcp_http, methods=["GET", "POST", "DELETE"]))


# ============================================================================
# Routes
# ============================================================================

@app.get("/")
async def root() -> dict[str, Any]:
    """Server info."""
    backends = registry.list_backends()
    tools = registry.list_all_tools()
    return {
        "name": "mcp-0ne",
        "version": __version__,
        "status": "ok",
        "backends": len(backends),
        "tools": len(tools),
    }


@app.get("/health")
async def health() -> dict[str, Any]:
    """Health check — returns immediately."""
    return {"ok": True, "version": __version__}


# Legacy /mcp POST endpoint removed — now handled by StreamableHTTPServerTransport above


# ============================================================================
# Main
# ============================================================================

def main() -> None:
    """Run the server."""
    import uvicorn

    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    print(f"mcp-0ne v{__version__}")
    print(f"  Host: {HOST}")
    print(f"  Port: {PORT}")
    print(f"  MCP endpoint: /mcp (streamable HTTP)")
    print()

    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_level=LOG_LEVEL,
    )


if __name__ == "__main__":
    main()
