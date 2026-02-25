"""Backend registry — manages connections and the merged tool catalog.

Central coordination point: adding/removing/enabling backends,
maintaining the unified tool map, and routing tool calls.
"""

from __future__ import annotations

import logging
from typing import Any

from .backends.base import BackendConnection, BackendState, BackendToolInfo
from .backends.http_backend import HttpBackend
from .backends.stdio_backend import StdioBackend
from .config import load_config, save_config

logger = logging.getLogger("mcp_0ne.registry")


class BackendRegistry:
    """Manages all backend connections and the merged tool catalog."""

    def __init__(self):
        self._backends: dict[str, BackendConnection] = {}
        self._tool_map: dict[str, tuple[BackendConnection, str]] = {}
        # namespaced_name -> (backend, original_name)
        self._config: dict[str, Any] = {}

    @property
    def separator(self) -> str:
        return self._config.get("settings", {}).get("separator", "__")

    @property
    def lazy_connect(self) -> bool:
        return self._config.get("settings", {}).get("lazy_connect", True)

    def _create_backend(self, backend_id: str, backend_config: dict[str, Any]) -> BackendConnection:
        """Create a backend connection from config."""
        backend_type = backend_config.get("type", "")
        if backend_type == "http":
            return HttpBackend(id=backend_id, config=backend_config, separator=self.separator)
        elif backend_type == "stdio":
            return StdioBackend(id=backend_id, config=backend_config, separator=self.separator)
        else:
            raise ValueError(f"Unknown backend type: {backend_type}")

    async def load_from_config(self) -> dict[str, Any]:
        """Load all backends from backends.json and optionally connect."""
        self._config = load_config()
        results = {}

        for backend_id, backend_config in self._config.get("backends", {}).items():
            if not backend_config.get("enabled", True):
                results[backend_id] = "disabled"
                continue

            try:
                backend = self._create_backend(backend_id, backend_config)
                self._backends[backend_id] = backend

                if not self.lazy_connect:
                    await backend.connect()
                    tools = await backend.list_tools()
                    self._index_tools(backend, tools)
                    results[backend_id] = f"connected ({len(tools)} tools)"
                else:
                    results[backend_id] = "registered (lazy)"
            except Exception as e:
                results[backend_id] = f"error: {e}"
                logger.error(f"Failed to load backend '{backend_id}': {e}")

        return results

    def _index_tools(self, backend: BackendConnection, tools: list[BackendToolInfo]) -> None:
        """Index tools from a backend into the merged tool map."""
        # Remove old entries for this backend
        self._tool_map = {
            k: v for k, v in self._tool_map.items() if v[0].id != backend.id
        }
        # Add new entries
        for tool in tools:
            self._tool_map[tool.namespaced_name] = (backend, tool.original_name)

    def _unindex_backend(self, backend_id: str) -> None:
        """Remove all tool map entries for a backend."""
        self._tool_map = {
            k: v for k, v in self._tool_map.items() if v[0].id != backend_id
        }

    async def ensure_all_connected(self) -> None:
        """Connect all lazy backends that aren't connected yet."""
        for backend in self._backends.values():
            if backend.enabled and backend.state != BackendState.CONNECTED:
                try:
                    await backend.connect()
                    tools = await backend.list_tools()
                    self._index_tools(backend, tools)
                except Exception as e:
                    logger.warning(f"Failed to connect backend '{backend.id}': {e}")

    def _persist(self) -> None:
        """Save current backend configs to backends.json."""
        self._config["backends"] = {
            bid: b.config for bid, b in self._backends.items()
        }
        save_config(self._config)

    async def add_backend(self, backend_id: str, config: dict[str, Any], connect: bool = True) -> dict[str, Any]:
        """Register a new backend. Optionally connect and enumerate tools."""
        if backend_id in self._backends:
            raise ValueError(f"Backend '{backend_id}' already exists")

        # Validate prefix uniqueness
        new_prefix = config.get("prefix", "")
        if not new_prefix:
            raise ValueError("prefix is required")
        for existing in self._backends.values():
            if existing.prefix == new_prefix:
                raise ValueError(f"Prefix '{new_prefix}' already in use by backend '{existing.id}'")

        backend = self._create_backend(backend_id, config)
        self._backends[backend_id] = backend

        result: dict[str, Any] = {"id": backend_id, "state": "registered"}

        if connect and config.get("enabled", True):
            try:
                await backend.connect()
                tools = await backend.list_tools()
                self._index_tools(backend, tools)
                result["state"] = "connected"
                result["tool_count"] = len(tools)
            except Exception as e:
                result["state"] = "error"
                result["error"] = str(e)

        self._persist()
        return result

    async def remove_backend(self, backend_id: str) -> dict[str, Any]:
        """Disconnect and remove a backend."""
        backend = self._backends.get(backend_id)
        if not backend:
            raise ValueError(f"Backend '{backend_id}' not found")

        if backend.state == BackendState.CONNECTED:
            await backend.disconnect()

        self._unindex_backend(backend_id)
        del self._backends[backend_id]
        self._persist()
        return {"id": backend_id, "removed": True}

    async def enable_backend(self, backend_id: str) -> dict[str, Any]:
        """Enable a backend and connect it."""
        backend = self._backends.get(backend_id)
        if not backend:
            raise ValueError(f"Backend '{backend_id}' not found")

        backend.config["enabled"] = True
        try:
            await backend.connect()
            tools = await backend.list_tools()
            self._index_tools(backend, tools)
            self._persist()
            return {"id": backend_id, "enabled": True, "tool_count": len(tools)}
        except Exception as e:
            self._persist()
            return {"id": backend_id, "enabled": True, "error": str(e)}

    async def disable_backend(self, backend_id: str) -> dict[str, Any]:
        """Disable a backend without removing it."""
        backend = self._backends.get(backend_id)
        if not backend:
            raise ValueError(f"Backend '{backend_id}' not found")

        if backend.state == BackendState.CONNECTED:
            await backend.disconnect()

        backend.config["enabled"] = False
        self._unindex_backend(backend_id)
        self._persist()
        return {"id": backend_id, "enabled": False}

    async def refresh(self, backend_id: str | None = None) -> dict[str, Any]:
        """Reconnect and re-enumerate tools for one or all backends."""
        targets = (
            [self._backends[backend_id]] if backend_id else list(self._backends.values())
        )
        if backend_id and backend_id not in self._backends:
            raise ValueError(f"Backend '{backend_id}' not found")

        results = {}
        for backend in targets:
            if not backend.enabled:
                results[backend.id] = "disabled"
                continue
            try:
                if backend.state == BackendState.CONNECTED:
                    await backend.disconnect()
                await backend.connect()
                tools = await backend.list_tools()
                self._index_tools(backend, tools)
                results[backend.id] = f"refreshed ({len(tools)} tools)"
            except Exception as e:
                results[backend.id] = f"error: {e}"

        return results

    def list_all_tools(self) -> list[dict[str, Any]]:
        """Return merged list of all namespaced tools from all connected backends."""
        tools = []
        for backend in self._backends.values():
            if backend.state != BackendState.CONNECTED or not backend.enabled:
                continue
            for tool in backend._tools:
                tools.append({
                    "name": tool.namespaced_name,
                    "description": tool.description,
                    "inputSchema": tool.input_schema,
                })
        return tools

    def resolve_tool(self, namespaced_name: str) -> tuple[BackendConnection, str] | None:
        """Resolve a namespaced tool name to (backend, original_name)."""
        return self._tool_map.get(namespaced_name)

    async def call_tool(self, namespaced_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Route a tool call to the correct backend."""
        resolved = self.resolve_tool(namespaced_name)
        if not resolved:
            return {
                "content": [{"type": "text", "text": f"Unknown tool: {namespaced_name}"}],
                "isError": True,
            }

        backend, original_name = resolved

        # Lazy connect if needed
        if backend.state != BackendState.CONNECTED:
            try:
                await backend.connect()
                tools = await backend.list_tools()
                self._index_tools(backend, tools)
            except Exception as e:
                return {
                    "content": [{"type": "text", "text": f"Failed to connect backend '{backend.id}': {e}"}],
                    "isError": True,
                }

        return await backend.call_tool(original_name, arguments)

    def list_backends(self) -> list[dict[str, Any]]:
        """Return status summary for all backends."""
        return [b.status_dict() for b in self._backends.values()]

    def get_backend(self, backend_id: str) -> BackendConnection | None:
        return self._backends.get(backend_id)
