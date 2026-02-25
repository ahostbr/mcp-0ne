import { RefreshCw, Plus, Settings, FileJson, Palette } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/Button'
import { useBackendStore } from '@/stores/backend-store'
import { cn } from '@/lib/utils'

interface HeaderBarProps {
  onAdd: () => void
  onImport: () => void
}

export function HeaderBar({ onAdd, onImport }: HeaderBarProps) {
  const { serverInfo, serverConnected, serverUrl, setServerUrl, fetchServerInfo, fetchBackends, theme, setTheme } = useBackendStore()
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlDraft, setUrlDraft] = useState(serverUrl)

  const handleUrlSubmit = () => {
    setServerUrl(urlDraft)
    setShowUrlInput(false)
  }

  return (
    <div className="titlebar-drag flex h-16 pt-2 items-center gap-4 border-b border-primary/30 bg-card/80 px-4 pr-[140px] shrink-0 backdrop-blur-md relative before:absolute before:bottom-0 before:left-0 before:right-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-primary before:to-transparent before:opacity-50">
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-secondary/50 via-primary/50 to-transparent"></div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2 titlebar-no-drag">
        <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'cyber' ? 'optik' : 'cyber')} className="group relative overflow-hidden text-muted-foreground mr-6" title="Toggle Theme">
          <Palette className="mr-2 h-4 w-4 group-hover:text-primary transition-colors" />
          <span className="font-mono tracking-widest leading-none">{theme === 'optik' ? 'OPTIK' : 'CYBER'}</span>
        </Button>

        <Button variant="outline" size="icon" title="Add Backend" onClick={onAdd} className="border-primary/50 hover:border-primary text-primary">
          <Plus className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" title="Import .mcp.json" onClick={onImport}>
          <FileJson className="h-4 w-4" />
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
          <RefreshCw className="h-4 w-4" />
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
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: server name + status */}
      <div className="flex-1 flex items-center justify-center gap-4 relative z-10">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold text-primary tracking-[0.2em] uppercase hover-glitch drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
            mcp-0ne
          </span>
          {serverInfo && (
            <span className="font-mono text-[10px] text-primary/50 tracking-widest border border-primary/20 px-1 rounded-sm bg-primary/5">
              v{serverInfo.version}
            </span>
          )}
        </div>

        <div className="h-4 w-[1px] bg-primary/20 transform rotate-12"></div>

        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
          <span
            className={cn(
              'h-2 w-2 rounded-none shadow-[0_0_8px_currentColor]',
              serverConnected ? 'bg-success animate-pulse-dot text-success' : 'bg-destructive text-destructive'
            )}
          />
          <span className={serverConnected ? 'text-success/80' : 'text-destructive/80'}>
            {serverConnected ? 'SYS.ONLINE' : 'SYS.OFFLINE'}
          </span>
        </span>
      </div>

      {/* Right: stats (before window controls) */}
      <div className="flex items-center gap-4 relative z-10 titlebar-no-drag mr-8">
        {serverInfo && (
          <div className="flex bg-background/50 border border-primary/20 rounded-sm shadow-[0_0_10px_rgba(0,0,0,0.5)]">
            <div className="px-3 py-1.5 border-r border-primary/20 flex flex-col items-center justify-center">
              <span className="font-mono text-[8px] text-primary/60 uppercase tracking-widest leading-tight mb-0.5 text-center">Nodes</span>
              <span className="font-mono text-sm text-primary font-bold leading-tight drop-shadow-[0_0_5px_rgba(0,240,255,0.5)] pt-0.5">{serverInfo.backends}</span>
            </div>
            <div className="px-3 py-1.5 flex flex-col items-center justify-center">
              <span className="font-mono text-[8px] text-secondary/60 uppercase tracking-widest leading-tight mb-0.5 text-center">Impls</span>
              <span className="font-mono text-sm text-secondary font-bold leading-tight drop-shadow-[0_0_5px_rgba(255,0,85,0.5)] pt-0.5">{serverInfo.tools}</span>
            </div>
          </div>
        )}
      </div>

      {/* URL input overlay */}
      {showUrlInput && (
        <div className="titlebar-no-drag absolute left-4 top-14 z-50 flex items-center gap-2 border border-primary bg-background/95 p-3 shadow-[0_0_20px_rgba(0,240,255,0.15)] clip-chamfer backdrop-blur-xl">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,240,255,0.03)_50%,transparent_75%,transparent_100%)] bg-[length:4px_4px] pointer-events-none"></div>
          <input
            className="h-8 w-64 border-b border-primary/50 bg-background/50 px-2 font-mono text-xs text-primary focus:border-primary focus:outline-none focus:shadow-[0_4px_10px_-4px_rgba(0,240,255,0.3)] transition-all"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
            placeholder="http://localhost:8150"
            autoFocus
          />
          <Button size="sm" variant="primary" onClick={handleUrlSubmit} className="clip-chamfer h-8">
            CONNECT
          </Button>
        </div>
      )}
    </div>
  )
}
