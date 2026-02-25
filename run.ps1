# mcp-0ne startup script (Windows)
$ErrorActionPreference = "Stop"

# Activate venv if it exists
$venvPath = Join-Path $PSScriptRoot ".venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    & $venvPath
}

# Run server
python -m mcp_0ne.server
