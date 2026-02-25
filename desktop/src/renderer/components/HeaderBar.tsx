import { RefreshCw, Plus, Settings, FileJson } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/Button'
import { useBackendStore } from '@/stores/backend-store'
import { cn } from '@/lib/utils'

interface HeaderBarProps {
  onAdd: () => void
  onImport: () => void
}

export function HeaderBar({ onAdd, onImport }: HeaderBarProps) {
  const { serverInfo, serverConnected, serverUrl, setServerUrl, fetchServerInfo, fetchBackends } =
    useBackendStore()
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlDraft, setUrlDraft] = useState(serverUrl)

  const handleUrlSubmit = () => {
    setServerUrl(urlDraft)
    setShowUrlInput(false)
  }

  return (
    <div className="titlebar-drag flex h-12 items-center gap-3 border-b border-border bg-card px-4 pr-[140px] shrink-0">
      {/* Left: actions */}
      <div className="titlebar-no-drag flex items-center gap-1">
        <Button variant="ghost" size="icon" title="Add Backend" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" title="Import .mcp.json" onClick={onImport}>
          <FileJson className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          title="Refresh"
          onClick={() => {
            fetchServerInfo()
            fetchBackends()
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          title="Server URL"
          onClick={() => {
            setUrlDraft(serverUrl)
            setShowUrlInput(!showUrlInput)
          }}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Center: server name + status */}
      <div className="flex-1 flex items-center justify-center gap-3">
        <span className="font-semibold text-sm">mcp-0ne</span>
        {serverInfo && (
          <span className="text-xs text-muted-foreground">v{serverInfo.version}</span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              serverConnected ? 'bg-success' : 'bg-destructive'
            )}
          />
          {serverConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Right: stats (before window controls) */}
      <div className="flex items-center gap-3">
        {serverInfo && (
          <>
            <span className="text-xs text-muted-foreground">
              {serverInfo.backends} backends
            </span>
            <span className="text-xs text-muted-foreground">
              {serverInfo.tools} tools
            </span>
          </>
        )}
      </div>

      {/* URL input overlay */}
      {showUrlInput && (
        <div className="titlebar-no-drag absolute left-4 top-12 z-50 flex items-center gap-2 rounded-md border border-border bg-card p-2 shadow-lg">
          <input
            className="h-7 w-64 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
            placeholder="http://localhost:8150"
            autoFocus
          />
          <Button size="sm" variant="primary" onClick={handleUrlSubmit}>
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
