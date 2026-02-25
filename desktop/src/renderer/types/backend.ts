export type BackendState = 'disconnected' | 'connecting' | 'connected' | 'error'
export type BackendType = 'http' | 'stdio'

export interface Backend {
  id: string
  type: BackendType
  prefix: string
  state: BackendState
  enabled: boolean
  description: string
  tool_count: number
  error: string | null
}

export interface ServerInfo {
  name: string
  version: string
  status: string
  backends: number
  tools: number
}

export interface AddBackendPayload {
  type: BackendType
  prefix: string
  description?: string
  enabled?: boolean
  // HTTP fields
  url?: string
  health_url?: string
  // Stdio fields
  command?: string
  args?: string[]
  env?: Record<string, string>
  // Shared
  timeout?: number
}
