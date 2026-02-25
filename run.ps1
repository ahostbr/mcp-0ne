param(
    [int]$Port = 8150,
    [int]$StartupWaitSec = 20,
    [switch]$Visible = $false,
    [switch]$NoDesktop = $false
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$WindowStyle = if ($Visible) { "Normal" } else { "Hidden" }

function Write-Status($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Warn($msg) { Write-Host $msg -ForegroundColor Yellow }

Write-Host ""
Write-Host "              MCP-0NE STACK LAUNCHER                          " -ForegroundColor Magenta
Write-Host ""

# ── Python resolution ───────────────────────────────────────────────
$Python = "python"
$VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
    $Python = $VenvPython
    Write-Status "Using venv: $VenvPython"
} else {
    $systemPython = Get-Command python -ErrorAction SilentlyContinue
    if ($systemPython) {
        $Python = $systemPython.Source
        Write-Status "Using system Python: $Python"
    } else {
        Write-Warn "No venv found, using 'python' from PATH"
    }
}

$env:MCP_0NE_PORT = $Port

Write-Status "Configuration:"
Write-Host "  Port:      $Port"
Write-Host "  Project:   $RepoRoot"
Write-Host ""

# ── Port cleanup ────────────────────────────────────────────────────
Write-Status "Checking port $Port..."
$existing = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($existing) {
    Write-Warn "  Port $Port in use, attempting to free..."
    $existing | ForEach-Object {
        $procId = $_.OwningProcess
        Get-CimInstance Win32_Process -Filter "ParentProcessId = $procId" -ErrorAction SilentlyContinue | ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500
}

# ── Start mcp-0ne server ───────────────────────────────────────────
Write-Status "Starting mcp-0ne server on port $Port..."
$ServerProcess = Start-Process -FilePath $Python -ArgumentList @(
    "-m", "mcp_0ne.server"
) -WorkingDirectory $RepoRoot -PassThru -WindowStyle $WindowStyle
Write-Host "  Server PID: $($ServerProcess.Id)"

# ── Wait for health ────────────────────────────────────────────────
Write-Status "Waiting for mcp-0ne..."
$maxWait = $StartupWaitSec
$waited = 0
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2 -ErrorAction Stop
        if ($health.ok) {
            Write-Success "  mcp-0ne ready! ($waited sec)"
            break
        }
    } catch {
        Write-Host "  ... waiting ($waited/$maxWait)" -ForegroundColor DarkGray
    }
}

if ($waited -ge $maxWait) {
    Write-Warn "  mcp-0ne may not be ready (proceeding anyway)"
}

# ── Desktop app ─────────────────────────────────────────────────────
$DesktopProcess = $null
if (-not $NoDesktop) {
    $DesktopDir = Join-Path $RepoRoot "desktop"
    if (Test-Path (Join-Path $DesktopDir "package.json")) {
        Write-Status "Building Desktop App..."
        Push-Location $DesktopDir
        try {
            npx electron-vite build 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "  Desktop build complete!"
            } else {
                Write-Warn "  Desktop build had issues (exit code: $LASTEXITCODE)"
            }
        } finally {
            Pop-Location
        }

        Write-Status "Starting Desktop App..."
        $DesktopProcess = Start-Process -FilePath "powershell" -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-Command", "cd '$DesktopDir'; npx electron-vite dev"
        ) -WorkingDirectory $DesktopDir -PassThru -WindowStyle $WindowStyle
        Write-Host "  Desktop PID: $($DesktopProcess.Id)"
    } else {
        Write-Warn "  Desktop app not found at $DesktopDir (skipping)"
    }
}

# ── Summary ─────────────────────────────────────────────────────────
Write-Host ""
Write-Success "  mcp-0ne Stack Running!"
Write-Host ""
Write-Host "  Server:    http://127.0.0.1:$Port/health"
Write-Host "  MCP:       http://127.0.0.1:$Port/mcp"
Write-Host "  REST API:  http://127.0.0.1:$Port/api/backends"
if ($DesktopProcess) {
    Write-Host "  Desktop:   Electron (PID $($DesktopProcess.Id))"
}
Write-Host ""
Write-Warn "Press Ctrl+C to stop all services"
Write-Host ""

# ── Health monitoring loop ──────────────────────────────────────────
try {
    $serverWasDown = $false

    while ($true) {
        Start-Sleep -Seconds 10

        $serverUp = $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
        if (-not $serverUp -and -not $serverWasDown) {
            Write-Warn "mcp-0ne server has stopped (port $Port)"
            $serverWasDown = $true
        } elseif ($serverUp -and $serverWasDown) {
            Write-Success "mcp-0ne server recovered"
            $serverWasDown = $false
        }

        if (-not $serverUp) {
            Write-Host "Server stopped. Exiting..."
            break
        }
    }
} finally {
    Write-Status "Shutting down..."

    # Kill server by port
    $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    if ($conn) {
        $conn | ForEach-Object {
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }

    # Kill wrapper processes
    if ($ServerProcess -and -not $ServerProcess.HasExited) {
        Stop-Process -Id $ServerProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($DesktopProcess -and -not $DesktopProcess.HasExited) {
        Stop-Process -Id $DesktopProcess.Id -Force -ErrorAction SilentlyContinue
    }

    # Kill lingering Electron
    Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Success "Done."
}
