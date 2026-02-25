"""Base classes for backend connections.

Defines the ABC that HTTP and Stdio backends implement,
plus shared data structures.
"""

from __future__ import annotations

import enum
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


class BackendState(enum.Enum):
    """Lifecycle state of a backend connection."""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


@dataclass
class BackendToolInfo:
    """Metadata for a single tool exposed by a backend."""
    original_name: str
    namespaced_name: str
    description: str
    input_schema: dict[str, Any]
    backend_id: str


@dataclass
class BackendConnection(ABC):
    """Abstract base for a backend MCP connection.

    Subclasses implement the transport-specific logic (HTTP or stdio).
    """
    id: str
    config: dict[str, Any]
    prefix: str
    separator: str = "__"
    state: BackendState = field(default=BackendState.DISCONNECTED, init=False)
    error_message: str | None = field(default=None, init=False)
    _tools: list[BackendToolInfo] = field(default_factory=list, init=False)

    @abstractmethod
    async def connect(self) -> None:
        """Establish the connection to the backend."""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Close the connection and release resources."""
        ...

    @abstractmethod
    async def list_tools(self) -> list[BackendToolInfo]:
        """Enumerate tools from the backend. Returns namespaced tool infos."""
        ...

    @abstractmethod
    async def call_tool(self, original_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Call a tool on the backend by its original (un-namespaced) name.

        Returns the raw MCP result dict (with 'content' array).
        """
        ...

    @abstractmethod
    async def health_check(self) -> dict[str, Any]:
        """Check backend health. Returns {ok: bool, ...details}."""
        ...

    def _namespace(self, tool_name: str) -> str:
        """Create namespaced tool name: {prefix}{separator}{tool_name}."""
        return f"{self.prefix}{self.separator}{tool_name}"

    @property
    def description(self) -> str:
        return self.config.get("description", "")

    @property
    def backend_type(self) -> str:
        return self.config.get("type", "unknown")

    @property
    def enabled(self) -> bool:
        return self.config.get("enabled", True)

    def status_dict(self) -> dict[str, Any]:
        """Return status summary for discovery/health endpoints."""
        return {
            "id": self.id,
            "type": self.backend_type,
            "prefix": self.prefix,
            "state": self.state.value,
            "enabled": self.enabled,
            "description": self.description,
            "tool_count": len(self._tools),
            "error": self.error_message,
        }
