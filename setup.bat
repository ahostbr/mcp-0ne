@echo off
echo ============================================
echo   Setting up mcp-0ne v0.1.0
echo ============================================
echo.

:: Check for Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

echo Creating virtual environment...
python -m venv .venv

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Installing requirements...
pip install -r requirements.txt

if %ERRORLEVEL% neq 0 (
    echo ERROR: pip install failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Setup complete!
echo   Activate venv: .venv\Scripts\activate.bat
echo   Run: python -m mcp_0ne.server
echo ============================================
pause
