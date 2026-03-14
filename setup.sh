#!/bin/bash
echo "============================================"
echo "  Setting up mcp-0ne v0.1.0"
echo "============================================"
echo

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python3 is not installed or not in PATH."
    echo "Please install Python 3.10+ from https://python.org"
    exit 1
fi

echo "Creating virtual environment..."
python3 -m venv .venv

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Installing requirements..."
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "ERROR: pip install failed."
    exit 1
fi

echo
echo "============================================"
echo "  Setup complete!"
echo "  Activate venv: source .venv/bin/activate"
echo "  Run: python -m mcp_0ne.server"
echo "============================================"
