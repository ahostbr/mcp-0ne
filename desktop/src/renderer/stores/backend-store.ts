import { create } from 'zustand'
import { api } from '@/lib/api'
import { useToastStore } from './toast-store'
import type { Backend, ServerInfo, AddBackendPayload } from '@/types/backend'

interface BackendStore {
  serverUrl: string
  serverInfo: ServerInfo | null
  serverConnected: boolean
  backends: Backend[]
  isLoading: boolean
  theme: 'cyber' | 'optik'

  setServerUrl: (url: string) => void
  setTheme: (theme: 'cyber' | 'optik') => void
  fetchServerInfo: () => Promise<void>
  fetchBackends: () => Promise<void>
  addBackend: (id: string, payload: AddBackendPayload) => Promise<void>
  removeBackend: (id: string) => Promise<void>
  refreshBackend: (id: string) => Promise<void>
  toggleBackend: (id: string, enabled: boolean) => Promise<void>
  startPolling: () => void
  stopPolling: () => void
}

let pollInterval: ReturnType<typeof setInterval> | null = null

const savedUrl = typeof localStorage !== 'undefined'
  ? localStorage.getItem('mcp0ne-server-url') || 'http://localhost:8150'
  : 'http://localhost:8150'

const savedTheme = typeof localStorage !== 'undefined'
  ? (localStorage.getItem('mcp0ne-theme') as 'cyber' | 'optik') || 'cyber'
  : 'cyber'

// Initialize api with saved URL
api.setBaseUrl(savedUrl)

export const useBackendStore = create<BackendStore>((set, get) => ({
  serverUrl: savedUrl,
  serverInfo: null,
  serverConnected: false,
  backends: [],
  isLoading: false,
  theme: savedTheme,

  setServerUrl: (url) => {
    api.setBaseUrl(url)
    localStorage.setItem('mcp0ne-server-url', url)
    set({ serverUrl: url, serverConnected: false, serverInfo: null, backends: [] })
    // Re-fetch with new URL
    get().fetchServerInfo()
    get().fetchBackends()
  },

  setTheme: (theme) => {
    localStorage.setItem('mcp0ne-theme', theme)
    set({ theme })
  },

  fetchServerInfo: async () => {
    try {
      const info = await api.getServerInfo()
      set({ serverInfo: info, serverConnected: true })
    } catch {
      set({ serverInfo: null, serverConnected: false })
    }
  },

  fetchBackends: async () => {
    try {
      const backends = await api.getBackends()
      set({ backends, serverConnected: true })
    } catch {
      set({ serverConnected: false })
    }
  },

  addBackend: async (id, payload) => {
    const toast = useToastStore.getState().addToast
    try {
      set({ isLoading: true })
      await api.addBackend(id, payload)
      toast(`Backend "${id}" added`, 'success')
      await get().fetchBackends()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to add backend', 'error')
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  removeBackend: async (id) => {
    const toast = useToastStore.getState().addToast
    try {
      await api.removeBackend(id)
      toast(`Backend "${id}" removed`, 'success')
      await get().fetchBackends()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to remove backend', 'error')
    }
  },

  refreshBackend: async (id) => {
    const toast = useToastStore.getState().addToast
    try {
      await api.refreshBackend(id)
      toast(`Backend "${id}" refreshed`, 'success')
      await get().fetchBackends()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to refresh backend', 'error')
    }
  },

  toggleBackend: async (id, enabled) => {
    const toast = useToastStore.getState().addToast
    try {
      await api.toggleBackend(id, enabled)
      toast(`Backend "${id}" ${enabled ? 'enabled' : 'disabled'}`, 'success')
      await get().fetchBackends()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to toggle backend', 'error')
    }
  },

  startPolling: () => {
    if (pollInterval) return
    // Initial fetch
    get().fetchServerInfo()
    get().fetchBackends()
    // Poll every 5s
    pollInterval = setInterval(() => {
      get().fetchServerInfo()
      get().fetchBackends()
    }, 5000)
  },

  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }
}))
