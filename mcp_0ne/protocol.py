"""MCP JSON-RPC 2.0 protocol handler with tool routing.

Handles initialize, tools/list, and tools/call — merging admin tools
with all backend tools, and routing calls to the correct destination.
"""

from __future__ import annotations

import uuid
from typing import Any

from .admin_tools import get_admin_tool_definitions, handle_admin_tool
from .registry import BackendRegistry

MCP_PROTOCOL_VERSION = "2024-11-05"


class GatewayProtocol:
    """Async JSON-RPC 2.0 MCP protocol handler for the gateway."""

    def __init__(self, registry: BackendRegistry):
        self.registry = registry
        self._sessions: dict[str, bool] = {}

    async def handle_request(
        self,
        request: dict[str, Any],
        session_id: str | None = None,
    ) -> tuple[dict[str, Any], str]:
        """Handle a JSON-RPC 2.0 request. Returns (response, session_id)."""
        req_id = request.get("id")
        method = request.get("method", "")
        params = request.get("params", {})

        if request.get("jsonrpc") != "2.0":
            return self._error(req_id, -32600, "Invalid Request: missing jsonrpc 2.0"), session_id or ""

        # Ensure session
        if not session_id:
            session_id = f"session_{uuid.uuid4().hex}"
        if session_id not in self._sessions:
            self._sessions[session_id] = False

        if method == "initialize":
            self._sessions[session_id] = True
            return self._success(req_id, {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "mcp-0ne", "version": "0.1.0"},
            }), session_id

        # Auto-initialize for stateless clients
        if not self._sessions.get(session_id):
            self._sessions[session_id] = True

        if method == "tools/list":
            return await self._handle_tools_list(req_id), session_id

        if method == "tools/call":
            return await self._handle_tools_call(req_id, params), session_id

        return self._error(req_id, -32601, f"Method not found: {method}"), session_id

    async def _handle_tools_list(self, req_id: Any) -> dict[str, Any]:
        """Merge admin tools + all backend tools."""
        tools = list(get_admin_tool_definitions())
        tools.extend(self.registry.list_all_tools())
        return self._success(req_id, {"tools": tools})

    async def _handle_tools_call(self, req_id: Any, params: dict[str, Any]) -> dict[str, Any]:
        """Route tool call to admin handler or backend."""
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        if not tool_name:
            return self._error(req_id, -32602, "Invalid params: missing tool name")

        # Try admin tools first
        admin_result = await handle_admin_tool(tool_name, arguments, self.registry)
        if admin_result is not None:
            return self._success(req_id, admin_result)

        # Route to backend
        result = await self.registry.call_tool(tool_name, arguments)
        return self._success(req_id, result)

    def _success(self, req_id: Any, result: Any) -> dict[str, Any]:
        return {"jsonrpc": "2.0", "id": req_id, "result": result}

    def _error(self, req_id: Any, code: int, message: str) -> dict[str, Any]:
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}
