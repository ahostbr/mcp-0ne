import { _electron as electron, type ElectronApplication, type Page } from 'playwright'
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { resolve, join } from 'path'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

// ── Mock mcp-0ne API server ─────────────────────────────────────────

export interface MockBackend {
  id: string
  type: 'http' | 'stdio'
  prefix: string
  state: 'connected' | 'disconnected' | 'error' | 'connecting'
  enabled: boolean
  description: string
  tool_count: number
  error: string | null
}

export class MockMcp0neServer {
  private server: Server | null = null
  backends: MockBackend[] = []
  port = 18150

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res))
      this.server.listen(this.port, '127.0.0.1', () => resolve())
      this.server.on('error', reject)
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve())
      } else {
        resolve()
      }
    })
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    res.setHeader('Content-Type', 'application/json')
    const url = req.url ?? ''

    if (req.method === 'GET' && url === '/') {
      return this.json(res, {
        name: 'mcp-0ne', version: '0.1.0-test', status: 'ok',
        backends: this.backends.length,
        tools: this.backends.reduce((sum, b) => sum + b.tool_count, 0)
      })
    }

    if (req.method === 'GET' && url === '/health') {
      return this.json(res, { ok: true, version: '0.1.0-test' })
    }

    if (req.method === 'GET' && url === '/api/backends') {
      return this.json(res, { backends: this.backends })
    }

    if (req.method === 'POST' && url.match(/^\/api\/backends\/[^/]+$/) && !url.includes('/refresh')) {
      const id = decodeURIComponent(url.split('/').pop()!)
      return this.readBody(req, (body) => {
        if (this.backends.find((b) => b.id === id)) {
          res.writeHead(400)
          return this.json(res, { detail: `Backend '${id}' already exists` })
        }
        const nb: MockBackend = {
          id, type: body.type as any ?? 'http', prefix: body.prefix as string ?? id,
          state: body.enabled !== false ? 'connected' : 'disconnected',
          enabled: body.enabled !== false, description: body.description as string ?? '',
          tool_count: 3, error: null
        }
        this.backends.push(nb)
        this.json(res, { id, state: nb.state, tool_count: 3 })
      })
    }

    if (req.method === 'DELETE' && url.match(/^\/api\/backends\/[^/]+$/)) {
      const id = decodeURIComponent(url.split('/').pop()!)
      const idx = this.backends.findIndex((b) => b.id === id)
      if (idx === -1) { res.writeHead(404); return this.json(res, { detail: 'Not found' }) }
      this.backends.splice(idx, 1)
      return this.json(res, { id, removed: true })
    }

    if (req.method === 'PATCH' && url.match(/^\/api\/backends\/[^/]+$/)) {
      const id = decodeURIComponent(url.split('/').pop()!)
      return this.readBody(req, (body) => {
        const backend = this.backends.find((b) => b.id === id)
        if (!backend) { res.writeHead(404); return this.json(res, { detail: 'Not found' }) }
        if (body.enabled !== undefined) {
          backend.enabled = body.enabled as boolean
          backend.state = body.enabled ? 'connected' : 'disconnected'
        }
        this.json(res, { id, updated: Object.keys(body), config: backend })
      })
    }

    if (req.method === 'POST' && url.match(/\/refresh$/)) {
      const id = decodeURIComponent(url.split('/')[3])
      const backend = this.backends.find((b) => b.id === id)
      if (!backend) { res.writeHead(404); return this.json(res, { detail: 'Not found' }) }
      return this.json(res, { [backend.id]: `refreshed (${backend.tool_count} tools)` })
    }

    res.writeHead(404)
    this.json(res, { detail: 'Not found' })
  }

  private json(res: ServerResponse, data: unknown): void { res.end(JSON.stringify(data)) }

  private readBody(req: IncomingMessage, cb: (body: Record<string, unknown>) => void): void {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => { try { cb(JSON.parse(data)) } catch { cb({}) } })
  }
}

// ── Electron app launcher ───────────────────────────────────────────

const MAIN_JS = resolve(__dirname, '../out/main/index.js')

export async function launchApp(mockPort = 18150): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [MAIN_JS],
    env: { ...process.env, NODE_ENV: 'test' }
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  // Point the renderer at the mock server instead of the real one
  const mockUrl = `http://localhost:${mockPort}`
  await page.evaluate((url) => {
    localStorage.setItem('mcp0ne-server-url', url)
  }, mockUrl)
  // Reload so the store picks up the new URL from localStorage
  await page.reload()
  await page.waitForLoadState('domcontentloaded')

  return { app, page }
}

// ── Dialog mocking (runs in main process via app.evaluate) ──────────

let _tmpDir: string | null = null

function getTmpDir(): string {
  if (!_tmpDir) {
    _tmpDir = mkdtempSync(join(tmpdir(), 'mcp0ne-test-'))
  }
  return _tmpDir
}

export function cleanupTmpDir(): void {
  if (_tmpDir) {
    rmSync(_tmpDir, { recursive: true, force: true })
    _tmpDir = null
  }
}

/**
 * Mock the next file dialog to return a temp file with the given JSON data.
 * Uses app.evaluate to override dialog.showOpenDialog in the main process.
 */
export async function mockDialogWithData(
  app: ElectronApplication,
  data: Record<string, unknown>
): Promise<void> {
  const filePath = join(getTmpDir(), `mock-${Date.now()}.json`)
  writeFileSync(filePath, JSON.stringify(data))

  await app.evaluate(async ({ dialog }, fp) => {
    const orig = (dialog as any)._origShowOpen || dialog.showOpenDialog
    ;(dialog as any)._origShowOpen = orig
    dialog.showOpenDialog = (async () => {
      dialog.showOpenDialog = orig
      return { canceled: false, filePaths: [fp] }
    }) as any
  }, filePath)
}

/** Mock the next file dialog as cancelled. */
export async function mockDialogCancelled(app: ElectronApplication): Promise<void> {
  await app.evaluate(async ({ dialog }) => {
    const orig = (dialog as any)._origShowOpen || dialog.showOpenDialog
    ;(dialog as any)._origShowOpen = orig
    dialog.showOpenDialog = (async () => {
      dialog.showOpenDialog = orig
      return { canceled: true, filePaths: [] }
    }) as any
  })
}

/** Mock the next file dialog to return an unparseable file. */
export async function mockDialogWithBadFile(app: ElectronApplication): Promise<void> {
  const filePath = join(getTmpDir(), `bad-${Date.now()}.json`)
  writeFileSync(filePath, '{{not valid json!!!', 'utf-8')

  await app.evaluate(async ({ dialog }, fp) => {
    const orig = (dialog as any)._origShowOpen || dialog.showOpenDialog
    ;(dialog as any)._origShowOpen = orig
    dialog.showOpenDialog = (async () => {
      dialog.showOpenDialog = orig
      return { canceled: false, filePaths: [fp] }
    }) as any
  }, filePath)
}
