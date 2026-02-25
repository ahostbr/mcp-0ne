import { test, expect } from '@playwright/test'
import { type ElectronApplication, type Page } from 'playwright'
import {
  MockMcp0neServer, launchApp, cleanupTmpDir,
  mockDialogWithData, mockDialogCancelled, mockDialogWithBadFile
} from './helpers'

let mockServer: MockMcp0neServer
let app: ElectronApplication
let page: Page

const headerRefresh = () => page.locator('.titlebar-drag button[title="Refresh"]')
const headerConnected = () => page.getByText('Connected', { exact: true })
const importBtn = () => page.locator('button[title="Import .mcp.json"]')
const browseBtn = () => page.locator('button:has-text("Browse...")')
const modalTitle = () => page.locator('h2:has-text("Import from .mcp.json")')
const closeModal = async () => {
  // Try cancel button first, fall back to backdrop
  const cancel = page.locator('button:has-text("Cancel")').last()
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click()
  } else {
    await page.locator('.bg-black\\/60').click({ position: { x: 10, y: 10 } })
  }
  await page.waitForTimeout(300)
}

test.beforeAll(async () => {
  mockServer = new MockMcp0neServer()
  await mockServer.start()
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  await expect(headerConnected()).toBeVisible({ timeout: 15000 })
})

test.afterAll(async () => {
  await app.close()
  await mockServer.stop()
  cleanupTmpDir()
})

test.beforeEach(async () => {
  mockServer.backends = []
  await headerRefresh().click()
  await page.waitForTimeout(500)
})

// ─── Modal Basics ───────────────────────────────────────────────────

test('import button visible in header', async () => {
  await expect(importBtn()).toBeVisible()
})

test('import modal opens and closes', async () => {
  await importBtn().click()
  await expect(modalTitle()).toBeVisible()
  await expect(browseBtn()).toBeVisible()
  await closeModal()
  await expect(modalTitle()).not.toBeVisible()
})

// ─── Parse & Display ────────────────────────────────────────────────

test('parses HTTP + Stdio servers from .mcp.json', async () => {
  await mockDialogWithData(app, {
    mcpServers: {
      'my-server': { type: 'http', url: 'http://localhost:3000/mcp' },
      'stdio-server': { command: 'python', args: ['-m', 'myserver'], env: { API_KEY: 'test' } }
    }
  })

  await importBtn().click()
  await browseBtn().click()

  await expect(page.locator('text=my-server')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('text=stdio-server')).toBeVisible()
  const modal = page.locator('.fixed')
  await expect(modal.getByText('HTTP', { exact: true })).toBeVisible()
  await expect(modal.getByText('STDIO', { exact: true })).toBeVisible()
  await expect(page.locator('text=http://localhost:3000/mcp')).toBeVisible()
  await expect(page.locator('text=python -m myserver')).toBeVisible()

  await closeModal()
})

test('disabled servers are unchecked by default', async () => {
  await mockDialogWithData(app, {
    mcpServers: {
      'active-srv': { url: 'http://localhost:3000/mcp' },
      'disabled-srv': { command: 'python', args: ['-m', 'off'], disabled: true }
    }
  })

  await importBtn().click()
  await browseBtn().click()

  await expect(page.locator('text=active-srv')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('text=disabled-srv')).toBeVisible()

  const checkboxes = page.locator('.fixed input[type="checkbox"]')
  await expect(checkboxes.nth(0)).toBeChecked()
  await expect(checkboxes.nth(1)).not.toBeChecked()
  await expect(page.locator('text=1 of 2 selected')).toBeVisible()

  await closeModal()
})

test('toggle selection changes count and button label', async () => {
  await mockDialogWithData(app, {
    mcpServers: {
      'srv-a': { url: 'http://localhost:1/mcp' },
      'srv-b': { url: 'http://localhost:2/mcp' }
    }
  })

  await importBtn().click()
  await browseBtn().click()
  await expect(page.locator('text=2 of 2 selected')).toBeVisible({ timeout: 5000 })

  await page.locator('.fixed input[type="checkbox"]').nth(1).uncheck()
  await expect(page.locator('text=1 of 2 selected')).toBeVisible()
  await expect(page.locator('button:has-text("Import 1 Backend")')).toBeVisible()

  await closeModal()
})

test('prefix is auto-sanitized and editable', async () => {
  await mockDialogWithData(app, {
    mcpServers: { 'MY-WEIRD_Name': { url: 'http://localhost:1234/mcp' } }
  })

  await importBtn().click()
  await browseBtn().click()
  await expect(page.locator('text=MY-WEIRD_Name')).toBeVisible({ timeout: 5000 })

  const prefixInput = page.locator('.fixed input[placeholder="prefix"]')
  await expect(prefixInput).toHaveValue('my_weird_name')
  await prefixInput.clear()
  await prefixInput.fill('custom_pfx')
  await expect(prefixInput).toHaveValue('custom_pfx')

  await closeModal()
})

test('shows "exists" badge for duplicate backend IDs', async () => {
  mockServer.backends = [{
    id: 'existing-one', type: 'http', prefix: 'existpfx',
    state: 'connected', enabled: true, description: '', tool_count: 3, error: null
  }]
  await headerRefresh().click()
  await expect(page.locator('text=existpfx')).toBeVisible({ timeout: 5000 })

  await mockDialogWithData(app, {
    mcpServers: {
      'existing-one': { url: 'http://localhost:1234/mcp' },
      'new-one': { url: 'http://localhost:5678/mcp' }
    }
  })

  await importBtn().click()
  await browseBtn().click()
  await expect(page.locator('text=new-one')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.fixed').locator('text=exists')).toBeVisible()

  await closeModal()
})

// ─── Edge Cases ─────────────────────────────────────────────────────

test('empty mcpServers shows error', async () => {
  await mockDialogWithData(app, { mcpServers: {} })

  await importBtn().click()
  await browseBtn().click()
  await expect(page.locator('text=No valid MCP servers found in file')).toBeVisible({ timeout: 5000 })

  await closeModal()
})

test('cancelled file dialog does nothing', async () => {
  await mockDialogCancelled(app)

  await importBtn().click()
  await browseBtn().click()
  // Modal stays, no error, no servers
  await expect(modalTitle()).toBeVisible()
  await page.waitForTimeout(500)

  await closeModal()
})

test('bad JSON file shows error', async () => {
  await mockDialogWithBadFile(app)

  await importBtn().click()
  await browseBtn().click()
  // Should show a parse error
  await expect(page.locator('text=/Unexpected|token|position/i')).toBeVisible({ timeout: 5000 })

  await closeModal()
})

// ─── Actual Import ──────────────────────────────────────────────────

test('imports 2 backends to mcp-0ne', async () => {
  await mockDialogWithData(app, {
    mcpServers: {
      'imp-http': { url: 'http://localhost:5000/mcp' },
      'imp-stdio': { command: 'node', args: ['server.js'] }
    }
  })

  await importBtn().click()
  await browseBtn().click()
  await expect(page.locator('text=imp-http')).toBeVisible({ timeout: 5000 })

  await page.locator('button:has-text("Import 2 Backends")').click()
  await expect(page.locator('text=Imported 2 backends')).toBeVisible({ timeout: 5000 })

  // Cards should appear in grid
  await expect(page.locator('.group:has-text("imp_http")')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.group:has-text("imp_stdio")')).toBeVisible()
})

test('Kuroryuu .mcp.json — 5 servers, 4 enabled', async () => {
  await mockDialogWithData(app, {
    mcpServers: {
      kuroryuu: { type: 'http', url: 'http://127.0.0.1:8100/mcp' },
      KURORYUU_STDIO_MCP: {
        command: 'python.exe', args: ['server.py'],
        env: { KURORYUU_RAG_USE_RG: '1' }, disabled: true
      },
      SOTS_MCP_CORE: { command: 'python.exe', args: ['sots_server.py'] },
      SOTS_BPGEN: { command: 'python.exe', args: ['bpgen_server.py'] },
      VibeUE: { command: 'python.exe', args: ['vibeue_server.py'] }
    }
  })

  await importBtn().click()
  await browseBtn().click()

  // All 5 listed
  const modal = page.locator('.fixed')
  await expect(modal.locator('text=kuroryuu').first()).toBeVisible({ timeout: 5000 })
  await expect(modal.locator('text=KURORYUU_STDIO_MCP')).toBeVisible()
  await expect(modal.getByText('SOTS_MCP_CORE', { exact: true })).toBeVisible()
  await expect(modal.getByText('SOTS_BPGEN', { exact: true })).toBeVisible()
  await expect(modal.getByText('VibeUE', { exact: true })).toBeVisible()

  // 1 HTTP + 4 STDIO
  await expect(modal.getByText('HTTP', { exact: true })).toHaveCount(1)
  await expect(modal.getByText('STDIO', { exact: true })).toHaveCount(4)

  // 4 of 5 selected (KURORYUU_STDIO_MCP is disabled)
  await expect(page.locator('text=4 of 5 selected')).toBeVisible()

  await page.locator('button:has-text("Import 4 Backends")').click()
  await expect(page.locator('text=Imported 4 backends')).toBeVisible({ timeout: 10000 })
})
