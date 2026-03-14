"""Stdio transport entry point for mcp-0ne.

Runs the same MCP server (tools, backends) over stdio instead of HTTP,
so Claude Code can spawn it directly without OAuth.

Usage:
    python -m mcp_0ne.stdio_server
"""

from __future__ import annotations

import asyncio
import logging

from mcp.server.stdio import stdio_server

from .config import LOG_LEVEL
from .registry import BackendRegistry
from .server import mcp_server, registry, protocol


async def main() -> None:
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    # Load backends from config and connect
    results = await registry.load_from_config()
    for backend_id, status in results.items():
        logging.getLogger("mcp_0ne").info(f"  [{backend_id}] {status}")
    await registry.ensure_all_connected()

    async with stdio_server() as (read_stream, write_stream):
        await mcp_server.run(read_stream, write_stream, mcp_server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
