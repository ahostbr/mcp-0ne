"""Admin management tools exposed as MCP tools under the 0ne__ prefix.

These tools let MCP clients manage backends at runtime:
- 0ne__discover: list backends with state/tool counts
- 0ne__health: health check all backends
- 0ne__add: register a new backend
- 0ne__remove: remove a backend
- 0ne__enable / 0ne__disable: toggle backends
- 0ne__refresh: force reconnect + re-enumerate
"""

from __future__ import annotations

import json
from typing import Any

from .registry import BackendRegistry

ADMIN_PREFIX = "0ne"
ADMIN_SEP = "__"


def _tool_name(name: str) -> str:
    return f"{ADMIN_PREFIX}{ADMIN_SEP}{name}"


def get_admin_tool_definitions() -> list[dict[str, Any]]:
    """Return MCP tool definitions for all admin tools."""
    return [
        {
            "name": _tool_name("discover"),
            "description": "List all registered backends with their state, tool count, and description.",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
        {
            "name": _tool_name("health"),
            "description": "Run health checks on all connected backends. Returns latency and status for each.",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
        {
            "name": _tool_name("add"),
            "description": "Register a new backend MCP server. Connects and enumerates tools immediately.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Unique backend identifier"},
                    "type": {"type": "string", "enum": ["http", "stdio"], "description": "Backend type"},
                    "prefix": {"type": "string", "description": "Tool namespace prefix (must be unique)"},
                    "url": {"type": "string", "description": "MCP endpoint URL (required for http type)"},
                    "health_url": {"type": "string", "description": "Health check URL (optional, http only)"},
                    "command": {"type": "string", "description": "Executable path (required for stdio type)"},
                    "args": {"type": "array", "items": {"type": "string"}, "description": "Command arguments (stdio only)"},
                    "env": {"type": "object", "description": "Environment variables (stdio only)"},
                    "timeout": {"type": "number", "description": "Request timeout in seconds (default: 30)"},
                    "description": {"type": "string", "description": "Human-readable description"},
                    "enabled": {"type": "boolean", "description": "Whether to connect immediately (default: true)"},
                },
                "required": ["id", "type", "prefix"],
                "additionalProperties": False,
            },
        },
        {
            "name": _tool_name("remove"),
            "description": "Disconnect and unregister a backend. Removes from config.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Backend ID to remove"},
                },
                "required": ["id"],
                "additionalProperties": False,
            },
        },
        {
            "name": _tool_name("enable"),
            "description": "Enable a disabled backend. Connects and enumerates tools.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Backend ID to enable"},
                },
                "required": ["id"],
                "additionalProperties": False,
            },
        },
        {
            "name": _tool_name("disable"),
            "description": "Disable a backend without removing it. Disconnects and hides tools.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Backend ID to disable"},
                },
                "required": ["id"],
                "additionalProperties": False,
            },
        },
        {
            "name": _tool_name("refresh"),
            "description": "Force reconnect and re-enumerate tools for one or all backends.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Backend ID to refresh (omit for all)"},
                },
                "additionalProperties": False,
            },
        },
    ]


async def handle_admin_tool(
    tool_name: str,
    arguments: dict[str, Any],
    registry: BackendRegistry,
) -> dict[str, Any] | None:
    """Handle an admin tool call. Returns None if not an admin tool."""
    if not tool_name.startswith(f"{ADMIN_PREFIX}{ADMIN_SEP}"):
        return None

    action = tool_name[len(f"{ADMIN_PREFIX}{ADMIN_SEP}"):]

    try:
        if action == "discover":
            backends = registry.list_backends()
            text = json.dumps({"backends": backends, "count": len(backends)}, indent=2)
            return {"content": [{"type": "text", "text": text}], "isError": False}

        elif action == "health":
            results = {}
            for info in registry.list_backends():
                backend = registry.get_backend(info["id"])
                if backend:
                    results[info["id"]] = await backend.health_check()
                else:
                    results[info["id"]] = {"ok": False, "error": "not found"}
            text = json.dumps(results, indent=2)
            return {"content": [{"type": "text", "text": text}], "isError": False}

        elif action == "add":
            backend_id = arguments.get("id", "")
            if not backend_id:
                return _error("'id' is required")
            backend_type = arguments.get("type", "")
            if backend_type not in ("http", "stdio"):
                return _error("'type' must be 'http' or 'stdio'")
            if backend_type == "http" and not arguments.get("url"):
                return _error("'url' is required for http backends")
            if backend_type == "stdio" and not arguments.get("command"):
                return _error("'command' is required for stdio backends")

            config = {
                "type": backend_type,
                "prefix": arguments["prefix"],
                "enabled": arguments.get("enabled", True),
            }
            # Copy optional fields
            for key in ("url", "health_url", "command", "args", "env", "timeout", "description"):
                if key in arguments:
                    config[key] = arguments[key]

            result = await registry.add_backend(backend_id, config)
            text = json.dumps(result, indent=2)
            return {"content": [{"type": "text", "text": text}], "isError": False}

        elif action == "remove":
            backend_id = arguments.get("id", "")
            if not backend_id:
                return _error("'id' is required")
            result = await registry.remove_backend(backend_id)
            text = json.dumps(result, indent=2)
            return {"content": [{"type": "text", "text": text}], "isError": False}

        elif action == "enable":
            backend_id = arguments.get("id", "")
            if not backend_id:
                return _error("'id' is required")
            result = await registry.enable_backend(backend_id)
            text = json.dumps(result, indent=2)
            return {"content": [{"type": "text", "text": text}], "isError": False}

        elif action == "disable":
            backend_id = arguments.get("id", "")
            if not backend_id:
                return _error("'id' is required")
            result = await registry.disable_backend(backend_id)
            text = json.dumps(result, indent=2)
            return {"content": [{"type": "text", "text": text}], "isError": False}

        elif action == "refresh":
            result = await registry.refresh(arguments.get("id"))
            text = json.dumps(result, indent=2)
            return {"content": [{"type": "text", "text": text}], "isError": False}

        else:
            return _error(f"Unknown admin action: {action}")

    except Exception as e:
        return _error(str(e))


def _error(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": f"Error: {message}"}], "isError": True}
