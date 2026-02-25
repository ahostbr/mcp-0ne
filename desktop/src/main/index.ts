import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { spawn, type ChildProcess } from 'child_process'
import { net } from 'electron'
import { is } from '@electron-toolkit/utils'

// ── mcp-0ne server process ──────────────────────────────────────────
const MCP0NE_DIR = 'C:\\Projects\\mcp-0ne'
const MCP0NE_PORT = 8150
let serverProc: ChildProcess | null = null
let weOwnServer = false

function checkServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = net.request(`http://localhost:${MCP0NE_PORT}/health`)
    req.on('response', () => resolve(true))
    req.on('error', () => resolve(false))
    req.end()
  })
}

async function ensureServer(): Promise<void> {
  const alreadyRunning = await checkServerRunning()
  if (alreadyRunning) {
    console.log('mcp-0ne server already running, skipping spawn')
    return
  }

  console.log('Starting mcp-0ne server...')
  serverProc = spawn('python', ['-m', 'mcp_0ne.server'], {
    cwd: MCP0NE_DIR,
    stdio: 'ignore',
    windowsHide: true
  })
  weOwnServer = true
  serverProc.on('error', (err) => {
    console.error('Failed to start mcp-0ne server:', err.message)
    serverProc = null
    weOwnServer = false
  })
  serverProc.on('exit', (code) => {
    console.log(`mcp-0ne server exited (code ${code})`)
    serverProc = null
    weOwnServer = false
  })
}

function stopServer(): void {
  if (weOwnServer && serverProc && !serverProc.killed) {
    serverProc.kill()
    serverProc = null
    weOwnServer = false
  }
}

// ── Window ──────────────────────────────────────────────────────────
function createWindow(): void {
  const windowIcon = join(__dirname, '../../resources/ico.ico')
  const win = new BrowserWindow({
    icon: windowIcon,
    width: 1100,
    height: 720,
    minWidth: 500,
    minHeight: 400,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a16',
      symbolColor: '#00f0ff',
      height: 36
    },
    backgroundColor: '#03030a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── IPC: Import .mcp.json ───────────────────────────────────────────
ipcMain.handle('dialog:open-mcp-json', async () => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return { cancelled: true }

  const result = await dialog.showOpenDialog(win, {
    title: 'Import .mcp.json',
    filters: [
      { name: 'MCP Config', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true }
  }

  try {
    const raw = readFileSync(result.filePaths[0], 'utf-8')
    const parsed = JSON.parse(raw)
    return { cancelled: false, path: result.filePaths[0], data: parsed }
  } catch (e) {
    return { cancelled: false, error: (e as Error).message }
  }
})

app.whenReady().then(async () => {
  // Skip server management in test mode — tests run their own mock server
  if (process.env.NODE_ENV !== 'test') {
    await ensureServer()
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopServer()
})

