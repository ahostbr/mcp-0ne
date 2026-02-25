import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  retries: 0,
  workers: 1, // Electron tests must be serial
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry'
  }
})
