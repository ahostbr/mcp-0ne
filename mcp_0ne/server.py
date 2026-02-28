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
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.types import Tool, TextContent
from starlette.routing import Route
from starlette.types import Receive, Scope, Send

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


@mcp_server.list_tools()
async def _mcp_list_tools() -> list[Tool]:
    """Return all gateway tools (admin + backend) via MCP SDK."""
    # NOTE: Backends are connected eagerly at startup, NOT here.
    # Calling ensure_all_connected() inside an MCP handler breaks anyio
    # cancel scopes because ClientSession.__aenter__ pushes cancel scopes
    # that outlive the request handler's responder scope.
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


# ── Session manager — handles transport lifecycle via SDK ──────────
session_manager = StreamableHTTPSessionManager(
    app=mcp_server,
    json_response=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: load config, connect backends, start session manager. Shutdown: disconnect all."""
    logger.info("mcp-0ne starting up...")
    results = await registry.load_from_config()
    for backend_id, status in results.items():
        logger.info(f"  [{backend_id}] {status}")

    # Eagerly connect all lazy backends BEFORE the session manager starts.
    # This MUST happen outside MCP request handlers because backend connections
    # enter ClientSession contexts with anyio cancel scopes that persist
    # beyond the handler call, breaking the responder's cancel scope chain.
    await registry.ensure_all_connected()
    logger.info(f"mcp-0ne ready — {len(registry.list_all_tools())} tools from {len(registry.list_backends())} backends")

    async with session_manager.run():
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


# ── Streamable HTTP MCP transport (via SDK session manager) ────────
# Register /mcp as a raw ASGI route — session_manager.handle_request writes directly to send
_mcp_route = Route("/mcp", endpoint=lambda r: None, methods=["GET", "POST", "DELETE"])
_mcp_route.app = session_manager.handle_request
app.router.routes.insert(0, _mcp_route)


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
