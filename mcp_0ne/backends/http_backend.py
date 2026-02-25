"""HTTP JSON-RPC 2.0 backend connection.

Connects to a remote MCP server over HTTP, proxying tool calls
via standard JSON-RPC 2.0 messages.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from .base import BackendConnection, BackendState, BackendToolInfo

logger = logging.getLogger("mcp_0ne.backends.http")


class HttpBackend(BackendConnection):
    """Backend that connects to an HTTP MCP server via JSON-RPC 2.0."""

    def __init__(self, id: str, config: dict[str, Any], separator: str = "__"):
        super().__init__(id=id, config=config, prefix=config["prefix"], separator=separator)
        self._url: str = config["url"]
        self._health_url: str | None = config.get("health_url")
        self._timeout: float = float(config.get("timeout", 30))
        self._initialized: bool = False
        self._tools_cache_time: float = 0
        self._tool_cache_ttl: float = float(config.get("tool_cache_ttl", 60))

    async def connect(self) -> None:
        """Initialize session with the HTTP MCP server."""
        self.state = BackendState.CONNECTING
        self.error_message = None
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    self._url,
                    json={
                        "jsonrpc": "2.0",
                        "id": "init",
                        "method": "initialize",
                        "params": {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {},
                            "clientInfo": {"name": "mcp-0ne", "version": "0.1.0"},
                        },
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                if "error" in data:
                    raise Exception(data["error"].get("message", "Initialize failed"))

            self._initialized = True
            self.state = BackendState.CONNECTED
            logger.info(f"[{self.id}] Connected to HTTP backend at {self._url}")
        except Exception as e:
            self.state = BackendState.ERROR
            self.error_message = str(e)
            logger.error(f"[{self.id}] Failed to connect: {e}")
            raise

    async def disconnect(self) -> None:
        """No persistent connection to close for HTTP."""
        self.state = BackendState.DISCONNECTED
        self._initialized = False
        self._tools = []
        self._tools_cache_time = 0
        logger.info(f"[{self.id}] Disconnected")

    async def list_tools(self) -> list[BackendToolInfo]:
        """Fetch tools from the HTTP backend via tools/list."""
        now = time.time()
        if self._tools and (now - self._tools_cache_time) < self._tool_cache_ttl:
            return self._tools

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    self._url,
                    json={
                        "jsonrpc": "2.0",
                        "id": "list-tools",
                        "method": "tools/list",
                        "params": {},
                    },
                )
                resp.raise_for_status()
                data = resp.json()

                if "error" in data:
                    raise Exception(data["error"].get("message", "tools/list failed"))

                raw_tools = data.get("result", {}).get("tools", [])
                self._tools = [
                    BackendToolInfo(
                        original_name=t.get("name", ""),
                        namespaced_name=self._namespace(t.get("name", "")),
                        description=t.get("description", ""),
                        input_schema=t.get("inputSchema", {}),
                        backend_id=self.id,
                    )
                    for t in raw_tools
                ]
                self._tools_cache_time = now
                logger.info(f"[{self.id}] Enumerated {len(self._tools)} tools")
                return self._tools

        except Exception as e:
            self.state = BackendState.ERROR
            self.error_message = str(e)
            logger.error(f"[{self.id}] Failed to list tools: {e}")
            raise

    async def call_tool(self, original_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Call a tool on the HTTP backend."""
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    self._url,
                    json={
                        "jsonrpc": "2.0",
                        "id": f"call-{original_name}",
                        "method": "tools/call",
                        "params": {
                            "name": original_name,
                            "arguments": arguments,
                        },
                    },
                )
                resp.raise_for_status()
                data = resp.json()

                if "error" in data:
                    return {
                        "content": [{"type": "text", "text": data["error"].get("message", "Tool call failed")}],
                        "isError": True,
                    }

                return data.get("result", {"content": [], "isError": False})

        except httpx.ConnectError:
            self.state = BackendState.ERROR
            self.error_message = f"Cannot connect to {self._url}"
            return {
                "content": [{"type": "text", "text": f"Backend '{self.id}' unreachable at {self._url}"}],
                "isError": True,
            }
        except Exception as e:
            return {
                "content": [{"type": "text", "text": f"Backend '{self.id}' error: {e}"}],
                "isError": True,
            }

    async def health_check(self) -> dict[str, Any]:
        """Check backend health via health URL or tools/list."""
        start = time.time()
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                if self._health_url:
                    resp = await client.get(self._health_url)
                    resp.raise_for_status()
                    latency_ms = round((time.time() - start) * 1000)
                    return {"ok": True, "latency_ms": latency_ms, **resp.json()}
                else:
                    # Fall back to tools/list as health probe
                    resp = await client.post(
                        self._url,
                        json={
                            "jsonrpc": "2.0",
                            "id": "health",
                            "method": "tools/list",
                            "params": {},
                        },
                    )
                    resp.raise_for_status()
                    latency_ms = round((time.time() - start) * 1000)
                    return {"ok": True, "latency_ms": latency_ms}

        except Exception as e:
            latency_ms = round((time.time() - start) * 1000)
            return {"ok": False, "latency_ms": latency_ms, "error": str(e)}
