import { test, expect } from '@playwright/test'
import { type ElectronApplication, type Page } from 'playwright'
import { MockMcp0neServer, launchApp } from './helpers'

let mockServer: MockMcp0neServer
let app: ElectronApplication
let page: Page

const headerRefresh = () => page.locator('.titlebar-drag button[title="Refresh"]')
const headerConnected = () => page.getByText('Connected', { exact: true })

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
})

test.beforeEach(async () => {
  mockServer.backends = []
  await headerRefresh().click()
  await page.waitForTimeout(500)
})

// ─── Window ─────────────────────────────────────────────────────────

test('window title and dark background', async () => {
  expect(await page.title()).toBe('mcp-0ne')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toContain('9')
})

// ─── HeaderBar ──────────────────────────────────────────────────────

test('header shows server name, version, status', async () => {
  await expect(page.locator('text=mcp-0ne').first()).toBeVisible()
  await expect(page.locator('text=v0.1.0-test')).toBeVisible()
  await expect(headerConnected()).toBeVisible()
})

test('header shows backend and tool counts', async () => {
  await expect(page.locator('text=0 backends')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('text=0 tools')).toBeVisible()
})

test('refresh button triggers data reload', async () => {
  mockServer.backends.push({
    id: 'reload-test', type: 'http', prefix: 'reloadpfx',
    state: 'connected', enabled: true, description: '', tool_count: 5, error: null
  })
  await headerRefresh().click()
  await expect(page.locator('text=1 backends')).toBeVisible({ timeout: 5000 })
})

test('server URL panel opens and saves', async () => {
  await page.locator('button[title="Server URL"]').click()
  const input = page.locator('input[placeholder="http://localhost:8150"]')
  await expect(input).toBeVisible()
  await page.locator('button:has-text("Save")').click()
  await expect(input).not.toBeVisible()
})

// ─── Empty State ────────────────────────────────────────────────────

test('shows empty state with Add button', async () => {
  await expect(page.locator('text=No backends configured')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('button:has-text("Add Backend")')).toBeVisible()
})

// ─── Add Backend Modal ──────────────────────────────────────────────

test('add modal opens and closes', async () => {
  await page.locator('button[title="Add Backend"]').click()
  await expect(page.locator('h2:has-text("Add Backend")')).toBeVisible()
  await page.locator('button:has-text("Cancel")').first().click()
  await expect(page.locator('h2:has-text("Add Backend")')).not.toBeVisible()
})

test('add modal shows HTTP fields by default', async () => {
  await page.locator('button[title="Add Backend"]').click()
  await expect(page.locator('label[for="url"]')).toBeVisible()
  await expect(page.locator('label[for="health_url"]')).toBeVisible()
  await page.locator('button:has-text("Cancel")').first().click()
})

test('add modal switches to Stdio fields', async () => {
  await page.locator('button[title="Add Backend"]').click()
  await page.locator('select#type').selectOption('stdio')
  await expect(page.locator('label[for="command"]')).toBeVisible()
  await expect(page.locator('label[for="args"]')).toBeVisible()
  await expect(page.locator('label[for="env"]')).toBeVisible()
  await page.locator('button:has-text("Cancel")').first().click()
})

test('adds HTTP backend via form', async () => {
  await page.locator('button[title="Add Backend"]').click()
  await page.waitForTimeout(200)
  await page.locator('input#id').fill('http-add')
  await page.locator('input#prefix').fill('httpadd')
  await page.locator('input#url').fill('http://localhost:9999/mcp')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('text=httpadd')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('http-add', { exact: true })).toBeVisible()
})

test('adds Stdio backend via form', async () => {
  await page.locator('button[title="Add Backend"]').click()
  await page.waitForTimeout(200)
  await page.locator('input#id').fill('stdio-add')
  await page.locator('select#type').selectOption('stdio')
  await page.locator('input#prefix').fill('stdioadd')
  await page.locator('input#command').fill('python')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('text=stdioadd')).toBeVisible({ timeout: 5000 })
})

// ─── Backend Card ───────────────────────────────────────────────────

test('card shows all info: prefix, id, type, tools, description', async () => {
  mockServer.backends = [{
    id: 'info-card', type: 'http', prefix: 'infopfx',
    state: 'connected', enabled: true, description: 'My description', tool_count: 7, error: null
  }]
  await headerRefresh().click()
  await expect(page.locator('text=infopfx')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('text=info-card')).toBeVisible()
  await expect(page.locator('.group >> text=HTTP')).toBeVisible()
  await expect(page.locator('.group >> text=7 tools')).toBeVisible()
  await expect(page.locator('text=My description')).toBeVisible()
})

test('card shows Connected state badge', async () => {
  mockServer.backends = [{
    id: 'state-card', type: 'http', prefix: 'statepfx',
    state: 'connected', enabled: true, description: '', tool_count: 1, error: null
  }]
  await headerRefresh().click()
  await expect(page.locator('text=statepfx')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.group').getByText('Connected', { exact: true })).toBeVisible()
})

test('disable toggle works', async () => {
  mockServer.backends = [{
    id: 'toggle-card', type: 'http', prefix: 'togpfx',
    state: 'connected', enabled: true, description: '', tool_count: 2, error: null
  }]
  await headerRefresh().click()
  await expect(page.locator('text=togpfx')).toBeVisible({ timeout: 5000 })
  await page.locator('button[title="Disable"]').click()
  await expect(page.locator('.group >> text=Disabled')).toBeVisible({ timeout: 5000 })
})

test('card refresh button works', async () => {
  mockServer.backends = [{
    id: 'refresh-card', type: 'http', prefix: 'refpfx',
    state: 'connected', enabled: true, description: '', tool_count: 3, error: null
  }]
  await headerRefresh().click()
  await expect(page.locator('text=refpfx')).toBeVisible({ timeout: 5000 })
  // Card refresh = second Refresh button on page
  await page.locator('button[title="Refresh"]').nth(1).click()
  await expect(page.locator('text=refreshed')).toBeVisible({ timeout: 5000 })
})

// ─── Remove Backend ─────────────────────────────────────────────────

test('remove: shows confirm, cancel keeps it', async () => {
  mockServer.backends = [{
    id: 'rm-cancel', type: 'http', prefix: 'rmcpfx',
    state: 'connected', enabled: true, description: '', tool_count: 1, error: null
  }]
  await headerRefresh().click()
  await expect(page.locator('text=rmcpfx')).toBeVisible({ timeout: 5000 })

  await page.locator('button[title="Remove"]').click()
  await expect(page.locator('h3:has-text("Remove Backend")')).toBeVisible()
  await page.locator('button:has-text("Cancel")').last().click()
  await expect(page.locator('text=rmcpfx')).toBeVisible()
})

test('remove: confirm deletes backend', async () => {
  mockServer.backends = [{
    id: 'rm-confirm', type: 'http', prefix: 'rmdpfx',
    state: 'connected', enabled: true, description: '', tool_count: 1, error: null
  }]
  await headerRefresh().click()
  await expect(page.locator('text=rmdpfx')).toBeVisible({ timeout: 5000 })

  await page.locator('button[title="Remove"]').click()
  await page.locator('button:has-text("Remove")').last().click()
  await expect(page.locator('text=rmdpfx')).not.toBeVisible({ timeout: 5000 })
  await expect(page.locator('text=No backends configured')).toBeVisible({ timeout: 5000 })
})

// ─── Error State ────────────────────────────────────────────────────

test('shows error state on card', async () => {
  mockServer.backends = [{
    id: 'err-card', type: 'http', prefix: 'errpfx',
    state: 'error', enabled: true, description: '', tool_count: 0, error: 'Connection refused'
  }]
  await headerRefresh().click()
  await expect(page.locator('text=errpfx')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.group').getByText('Error', { exact: true })).toBeVisible()
  await expect(page.locator('text=Connection refused')).toBeVisible()
})

// ─── Multiple Backends ──────────────────────────────────────────────

test('grid shows multiple backends with different states', async () => {
  mockServer.backends = [
    { id: 'b1', type: 'http', prefix: 'aaa', state: 'connected', enabled: true, description: '', tool_count: 1, error: null },
    { id: 'b2', type: 'http', prefix: 'bbb', state: 'disconnected', enabled: false, description: '', tool_count: 0, error: null },
    { id: 'b3', type: 'http', prefix: 'ccc', state: 'error', enabled: true, description: '', tool_count: 0, error: 'Timeout' }
  ]
  await headerRefresh().click()
  await expect(page.locator('text=aaa')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('text=bbb')).toBeVisible()
  await expect(page.locator('text=ccc')).toBeVisible()
  await expect(page.locator('text=Timeout')).toBeVisible()
})

// ─── Toasts ─────────────────────────────────────────────────────────

test('toast appears on add and auto-dismisses', async () => {
  await page.locator('button[title="Add Backend"]').click()
  await page.waitForTimeout(200)
  await page.locator('input#id').fill('toast-add')
  await page.locator('input#prefix').fill('toastpfx')
  await page.locator('input#url').fill('http://localhost:1234/mcp')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('text=Backend "toast-add" added')).toBeVisible({ timeout: 5000 })
  // Auto-dismiss after 4s
  await expect(page.locator('text=Backend "toast-add" added')).not.toBeVisible({ timeout: 6000 })
})
