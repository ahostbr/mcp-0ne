import type { Backend, ServerInfo, AddBackendPayload } from '@/types/backend'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '')
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `HTTP ${res.status}`)
    }
    return res.json()
  }

  async getServerInfo(): Promise<ServerInfo> {
    return this.request<ServerInfo>('/')
  }

  async getBackends(): Promise<Backend[]> {
    const data = await this.request<{ backends: Backend[] }>('/api/backends')
    return data.backends
  }

  async addBackend(id: string, payload: AddBackendPayload): Promise<void> {
    await this.request(`/api/backends/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  async removeBackend(id: string): Promise<void> {
    await this.request(`/api/backends/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  }

  async refreshBackend(id: string): Promise<void> {
    await this.request(`/api/backends/${encodeURIComponent(id)}/refresh`, {
      method: 'POST'
    })
  }

  async toggleBackend(id: string, enabled: boolean): Promise<void> {
    await this.request(`/api/backends/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled })
    })
  }
}

export const api = new ApiClient('http://localhost:8150')
