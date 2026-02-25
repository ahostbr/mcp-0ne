"""Configuration management for mcp-0ne.

Loads/saves backends.json and reads environment variable overrides.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("mcp_0ne.config")

# Environment variable overrides
HOST = os.environ.get("MCP_0NE_HOST", "127.0.0.1")
PORT = int(os.environ.get("MCP_0NE_PORT", "8150"))
LOG_LEVEL = os.environ.get("MCP_0NE_LOG_LEVEL", "info")

# Config file path — defaults to backends.json next to the package
_default_config = str(Path(__file__).parent.parent / "backends.json")
CONFIG_PATH = Path(os.environ.get("MCP_0NE_CONFIG", _default_config))

# Default settings
DEFAULT_SETTINGS = {
    "separator": "__",
    "lazy_connect": True,
    "tool_cache_ttl": 60,
    "log_level": "info",
}


def load_config() -> dict[str, Any]:
    """Load backends.json config file.

    Returns default structure if file doesn't exist or is invalid.
    """
    if not CONFIG_PATH.exists():
        logger.info(f"Config not found at {CONFIG_PATH}, using defaults")
        return {"backends": {}, "settings": dict(DEFAULT_SETTINGS)}

    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        # Merge defaults for any missing settings
        settings = dict(DEFAULT_SETTINGS)
        settings.update(data.get("settings", {}))
        data["settings"] = settings
        if "backends" not in data:
            data["backends"] = {}
        return data
    except (json.JSONDecodeError, OSError) as e:
        logger.error(f"Failed to load config: {e}")
        return {"backends": {}, "settings": dict(DEFAULT_SETTINGS)}


def save_config(data: dict[str, Any]) -> None:
    """Save config to backends.json."""
    try:
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        logger.info(f"Config saved to {CONFIG_PATH}")
    except OSError as e:
        logger.error(f"Failed to save config: {e}")
        raise
