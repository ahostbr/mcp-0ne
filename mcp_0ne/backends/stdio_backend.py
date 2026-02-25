"""Stdio subprocess backend connection.

Spawns a child process and communicates via MCP SDK's stdio transport.
"""

from __future__ import annotations

import logging
import time
from contextlib import AsyncExitStack
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from .base import BackendConnection, BackendState, BackendToolInfo

logger = logging.getLogger("mcp_0ne.backends.stdio")


class StdioBackend(BackendConnection):
    """Backend that spawns a subprocess and talks MCP over stdio."""

    def __init__(self, id: str, config: dict[str, Any], separator: str = "__"):
        super().__init__(id=id, config=config, prefix=config["prefix"], separator=separator)
        self._command: str = config["command"]
        self._args: list[str] = config.get("args", [])
        self._env: dict[str, str] | None = config.get("env")
        self._timeout: float = float(config.get("timeout", 60))
        self._exit_stack: AsyncExitStack | None = None
        self._session: ClientSession | None = None
        self._tool_cache_ttl: float = float(config.get("tool_cache_ttl", 60))
        self._tools_cache_time: float = 0

    async def connect(self) -> None:
        """Spawn the subprocess and establish MCP session."""
        self.state = BackendState.CONNECTING
        self.error_message = None
        try:
            server_params = StdioServerParameters(
                command=self._command,
                args=self._args,
                env=self._env,
            )

            self._exit_stack = AsyncExitStack()
            stdio_transport = await self._exit_stack.enter_async_context(
                stdio_client(server_params)
            )
            read_stream, write_stream = stdio_transport
            self._session = await self._exit_stack.enter_async_context(
                ClientSession(read_stream, write_stream)
            )

            await self._session.initialize()

            self.state = BackendState.CONNECTED
            logger.info(f"[{self.id}] Stdio backend connected: {self._command} {' '.join(self._args)}")
        except Exception as e:
            self.state = BackendState.ERROR
            self.error_message = str(e)
            logger.error(f"[{self.id}] Failed to connect: {e}")
            # Cleanup on failure
            await self._cleanup()
            raise

    async def _cleanup(self) -> None:
        """Clean up exit stack and session."""
        if self._exit_stack:
            try:
                await self._exit_stack.aclose()
            except Exception as e:
                logger.warning(f"[{self.id}] Cleanup warning: {e}")
            self._exit_stack = None
        self._session = None

    async def disconnect(self) -> None:
        """Kill the subprocess and clean up."""
        await self._cleanup()
        self.state = BackendState.DISCONNECTED
        self._tools = []
        self._tools_cache_time = 0
        logger.info(f"[{self.id}] Disconnected")

    async def list_tools(self) -> list[BackendToolInfo]:
        """Enumerate tools from the stdio backend."""
        if not self._session:
            raise RuntimeError(f"Backend '{self.id}' not connected")

        now = time.time()
        if self._tools and (now - self._tools_cache_time) < self._tool_cache_ttl:
            return self._tools

        try:
            result = await self._session.list_tools()
            self._tools = [
                BackendToolInfo(
                    original_name=t.name,
                    namespaced_name=self._namespace(t.name),
                    description=t.description or "",
                    input_schema=t.inputSchema if hasattr(t, "inputSchema") else {},
                    backend_id=self.id,
                )
                for t in result.tools
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
        """Call a tool on the stdio backend."""
        if not self._session:
            return {
                "content": [{"type": "text", "text": f"Backend '{self.id}' not connected"}],
                "isError": True,
            }

        try:
            result = await self._session.call_tool(original_name, arguments)
            # Convert MCP SDK result to dict format
            content = []
            for block in result.content:
                if hasattr(block, "text"):
                    content.append({"type": "text", "text": block.text})
                elif hasattr(block, "data"):
                    content.append({"type": block.type, "data": block.data})
                else:
                    content.append({"type": "text", "text": str(block)})

            return {
                "content": content,
                "isError": getattr(result, "isError", False),
            }
        except Exception as e:
            return {
                "content": [{"type": "text", "text": f"Backend '{self.id}' error: {e}"}],
                "isError": True,
            }

    async def health_check(self) -> dict[str, Any]:
        """Check health by verifying session is alive."""
        start = time.time()
        if not self._session:
            return {"ok": False, "latency_ms": 0, "error": "Not connected"}

        try:
            await self._session.list_tools()
            latency_ms = round((time.time() - start) * 1000)
            return {"ok": True, "latency_ms": latency_ms}
        except Exception as e:
            latency_ms = round((time.time() - start) * 1000)
            return {"ok": False, "latency_ms": latency_ms, "error": str(e)}
