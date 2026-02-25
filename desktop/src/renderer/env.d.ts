/// <reference types="vite/client" />

interface McpJsonResult {
  cancelled: boolean
  path?: string
  data?: Record<string, unknown>
  error?: string
}

interface Window {
  electronAPI: {
    platform: string
    openMcpJson: () => Promise<McpJsonResult>
  }
}
