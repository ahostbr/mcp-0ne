import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, FileJson, Check, AlertCircle } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { useBackendStore } from '@/stores/backend-store'
import { useToastStore } from '@/stores/toast-store'
import type { AddBackendPayload, BackendType } from '@/types/backend'

interface ParsedServer {
  id: string
  prefix: string
  type: BackendType
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  enabled: boolean
  selected: boolean
}

function parseMcpJson(data: Record<string, unknown>): ParsedServer[] {
  const servers: ParsedServer[] = []
  const mcpServers = (data.mcpServers ?? data.backends ?? {}) as Record<string, Record<string, unknown>>

  for (const [name, config] of Object.entries(mcpServers)) {
    if (!config || typeof config !== 'object') continue

    const hasUrl = typeof config.url === 'string'
    const hasCommand = typeof config.command === 'string'
    if (!hasUrl && !hasCommand) continue

    const type: BackendType = hasUrl ? 'http' : 'stdio'
    const prefix = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')

    servers.push({
      id: name,
      prefix,
      type,
      url: hasUrl ? (config.url as string) : undefined,
      command: hasCommand ? (config.command as string) : undefined,
      args: Array.isArray(config.args) ? config.args as string[] : undefined,
      env: config.env && typeof config.env === 'object' ? config.env as Record<string, string> : undefined,
      enabled: config.disabled !== true,
      selected: config.disabled !== true
    })
  }

  return servers
}

interface ImportMcpJsonModalProps {
  open: boolean
  onClose: () => void
}

export function ImportMcpJsonModal({ open, onClose }: ImportMcpJsonModalProps) {
  const addBackend = useBackendStore((s) => s.addBackend)
  const backends = useBackendStore((s) => s.backends)
  const toast = useToastStore((s) => s.addToast)

  const [filePath, setFilePath] = useState<string | null>(null)
  const [servers, setServers] = useState<ParsedServer[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<Record<string, 'ok' | 'error' | 'skip'>>({})

  const reset = () => {
    setFilePath(null)
    setServers([])
    setParseError(null)
    setImporting(false)
    setResults({})
  }

  const handleBrowse = async () => {
    const result = await window.electronAPI.openMcpJson()
    if (result.cancelled) return

    if (result.error) {
      setParseError(result.error)
      return
    }

    setParseError(null)
    setFilePath(result.path ?? null)
    const parsed = parseMcpJson(result.data as Record<string, unknown>)
    if (parsed.length === 0) {
      setParseError('No valid MCP servers found in file')
      return
    }
    setServers(parsed)
    setResults({})
  }

  const toggleServer = (idx: number) => {
    setServers((prev) => prev.map((s, i) => (i === idx ? { ...s, selected: !s.selected } : s)))
  }

  const updatePrefix = (idx: number, prefix: string) => {
    setServers((prev) => prev.map((s, i) => (i === idx ? { ...s, prefix } : s)))
  }

  const existingIds = new Set(backends.map((b) => b.id))

  const handleImport = async () => {
    const selected = servers.filter((s) => s.selected)
    if (selected.length === 0) return

    setImporting(true)
    const newResults: Record<string, 'ok' | 'error' | 'skip'> = {}

    for (const server of selected) {
      if (existingIds.has(server.id)) {
        newResults[server.id] = 'skip'
        continue
      }

      const payload: AddBackendPayload = {
        type: server.type,
        prefix: server.prefix,
        enabled: server.enabled
      }

      if (server.type === 'http') {
        payload.url = server.url
      } else {
        payload.command = server.command
        payload.args = server.args
        payload.env = server.env
      }

      try {
        await addBackend(server.id, payload)
        newResults[server.id] = 'ok'
      } catch {
        newResults[server.id] = 'error'
      }
    }

    setResults(newResults)
    setImporting(false)

    const okCount = Object.values(newResults).filter((v) => v === 'ok').length
    const skipCount = Object.values(newResults).filter((v) => v === 'skip').length
    const errCount = Object.values(newResults).filter((v) => v === 'error').length

    if (okCount > 0) toast(`Imported ${okCount} backend${okCount > 1 ? 's' : ''}`, 'success')
    if (skipCount > 0) toast(`Skipped ${skipCount} (already exist)`, 'warning')
    if (errCount > 0) toast(`Failed to import ${errCount}`, 'error')

    if (errCount === 0) {
      setTimeout(() => { reset(); onClose() }, 600)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-xl rounded-lg border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Import from .mcp.json</h2>
          </div>
          <button className="text-muted-foreground hover:text-foreground cursor-pointer" onClick={handleClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* File picker */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBrowse}>
              Browse...
            </Button>
            {filePath && (
              <span className="text-xs text-muted-foreground truncate flex-1">{filePath}</span>
            )}
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {parseError}
            </div>
          )}

          {/* Server list */}
          {servers.length > 0 && (
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-1">
                {servers.filter((s) => s.selected).length} of {servers.length} selected
              </p>
              {servers.map((server, idx) => {
                const alreadyExists = existingIds.has(server.id)
                const result = results[server.id]
                return (
                  <div
                    key={server.id}
                    className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={server.selected}
                      onChange={() => toggleServer(idx)}
                      disabled={importing}
                      className="h-4 w-4 accent-primary shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{server.id}</span>
                        <Badge variant={server.type === 'http' ? 'info' : 'warning'}>
                          {server.type.toUpperCase()}
                        </Badge>
                        {alreadyExists && <Badge variant="default">exists</Badge>}
                        {result === 'ok' && <Check className="h-3.5 w-3.5 text-success" />}
                        {result === 'error' && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {server.type === 'http' ? server.url : `${server.command} ${(server.args ?? []).join(' ')}`}
                      </p>
                    </div>
                    <Input
                      className="!w-28 !h-7 text-xs"
                      value={server.prefix}
                      onChange={(e) => updatePrefix(idx, e.target.value)}
                      placeholder="prefix"
                      disabled={importing}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Actions */}
          {servers.length > 0 && (
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleImport}
                disabled={importing || servers.filter((s) => s.selected).length === 0}
              >
                {importing ? 'Importing...' : `Import ${servers.filter((s) => s.selected).length} Backend${servers.filter((s) => s.selected).length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
