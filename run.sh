#!/usr/bin/env bash
# mcp-0ne startup script (Linux/Mac)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Activate venv if it exists
if [ -f "$SCRIPT_DIR/.venv/bin/activate" ]; then
    source "$SCRIPT_DIR/.venv/bin/activate"
fi

# Run server
python -m mcp_0ne.server
