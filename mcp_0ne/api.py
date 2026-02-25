"""REST API for backend CRUD operations.

Mounted at /api on the main server. Provides a REST interface
for managing backends — useful for future web UIs or scripts.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api", tags=["backends"])

# Registry reference — set by server.py at startup
_registry = None


def set_registry(registry) -> None:
    """Set the registry reference. Called once at server startup."""
    global _registry
    _registry = registry


class AddBackendRequest(BaseModel):
    """Request body for adding a new backend."""
    type: str = Field(..., description="Backend type: 'http' or 'stdio'")
    prefix: str = Field(..., description="Tool namespace prefix")
    url: str | None = Field(None, description="MCP endpoint URL (http)")
    health_url: str | None = Field(None, description="Health check URL (http)")
    command: str | None = Field(None, description="Executable path (stdio)")
    args: list[str] | None = Field(None, description="Command arguments (stdio)")
    env: dict[str, str] | None = Field(None, description="Environment variables (stdio)")
    timeout: float | None = Field(None, description="Timeout in seconds")
    description: str | None = Field(None, description="Human-readable description")
    enabled: bool = Field(True, description="Connect immediately")


class UpdateBackendRequest(BaseModel):
    """Request body for updating a backend."""
    enabled: bool | None = None
    timeout: float | None = None
    description: str | None = None
    url: str | None = None
    health_url: str | None = None


@router.get("/backends")
async def list_backends() -> dict[str, Any]:
    """List all backends with status."""
    return {"backends": _registry.list_backends()}


@router.post("/backends/{backend_id}")
async def add_backend(backend_id: str, body: AddBackendRequest) -> dict[str, Any]:
    """Add a new backend."""
    config = body.model_dump(exclude_none=True)
    try:
        result = await _registry.add_backend(backend_id, config)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/backends/{backend_id}")
async def remove_backend(backend_id: str) -> dict[str, Any]:
    """Remove a backend."""
    try:
        return await _registry.remove_backend(backend_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/backends/{backend_id}")
async def update_backend(backend_id: str, body: UpdateBackendRequest) -> dict[str, Any]:
    """Update backend configuration."""
    backend = _registry.get_backend(backend_id)
    if not backend:
        raise HTTPException(status_code=404, detail=f"Backend '{backend_id}' not found")

    updates = body.model_dump(exclude_none=True)
    backend.config.update(updates)
    _registry._persist()

    return {"id": backend_id, "updated": list(updates.keys()), "config": backend.config}


@router.post("/backends/{backend_id}/refresh")
async def refresh_backend(backend_id: str) -> dict[str, Any]:
    """Reconnect and refresh a backend."""
    try:
        result = await _registry.refresh(backend_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
