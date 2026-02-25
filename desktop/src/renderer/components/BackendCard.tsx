import { RotateCw, Trash2, Power, PowerOff } from 'lucide-react'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { StateBadge } from './StateBadge'
import { useBackendStore } from '@/stores/backend-store'
import type { Backend } from '@/types/backend'
import { cn } from '@/lib/utils'

interface BackendCardProps {
  backend: Backend
  onRemove: (id: string) => void
}

export function BackendCard({ backend, onRemove }: BackendCardProps) {
  const { refreshBackend, toggleBackend } = useBackendStore()

  return (
    <div className="group relative flex flex-col gap-4 bg-background/60 p-5 transition-all outline-none neon-border clip-chamfer backdrop-blur-sm shadow-[0_4px_30px_rgba(0,0,0,0.5)] before:!border-primary/30 hover:before:!border-primary overflow-hidden corner-deco data-stream-bg animate-breathe">
      {/* Decorative tech background elements */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/5 to-transparent pointer-events-none transition-all duration-500 group-hover:from-primary/15"></div>
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/50 via-secondary/20 to-transparent opacity-30 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-primary/40 via-transparent to-secondary/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      {/* Header: prefix + state */}
      <div className="flex items-start justify-between relative z-10">
        <div className="flex flex-col">
          <span className="font-mono text-xs text-primary/60 tracking-[0.3em] uppercase mb-1">NODE_ID</span>
          <span className="font-mono text-xl font-bold tracking-wider uppercase text-foreground drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:text-primary group-hover:drop-shadow-[0_0_10px_rgba(0,240,255,0.4)] transition-colors duration-300">{backend.prefix}</span>
        </div>
        <StateBadge state={backend.state} />
      </div>

      {/* ID */}
      <p className="font-mono text-[10px] text-muted-foreground/70 tracking-widest uppercase border-b border-border/50 pb-2 relative z-10">{backend.id}</p>

      {/* Description + type */}
      <div className="flex flex-wrap items-center gap-2 relative z-10">
        <Badge variant={backend.type === 'http' ? 'info' : 'warning'} className="tracking-widest border-l-2 border-y-0 border-r-0 pl-2">
          {backend.type}
        </Badge>
        {backend.state === 'connected' && (
          <Badge variant="success" className="tracking-widest border-l-2 border-y-0 border-r-0 pl-2 opacity-80 decoration-slice">OPS: {backend.tool_count}</Badge>
        )}
        {!backend.enabled && (
          <Badge variant="default" className="tracking-widest opacity-50">SYS.SUSPENDED</Badge>
        )}
      </div>

      {/* Description */}
      {backend.description && (
        <p className="font-mono text-xs text-muted-foreground/90 line-clamp-2 leading-relaxed tracking-wide relative z-10">{backend.description}</p>
      )}

      {/* Error */}
      {backend.error && (
        <div className="bg-destructive/5 border border-destructive/30 p-2 clip-chamfer relative z-10 mt-1">
          <p className="font-mono text-xs text-destructive line-clamp-2">{backend.error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border mt-auto relative z-10">
        <Button
          variant="outline"
          size="icon"
          title={backend.enabled ? 'Suspend Node' : 'Initialize Node'}
          onClick={() => toggleBackend(backend.id, !backend.enabled)}
          className={cn("clip-chamfer-reverse", backend.enabled ? "text-primary hover:text-primary" : "text-muted-foreground")}
        >
          {backend.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          title="Force Sync cycle"
          onClick={() => refreshBackend(backend.id)}
          className="clip-chamfer-reverse text-primary hover:text-primary"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          title="Purge Node"
          className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 hover:shadow-[inset_0_0_10px_rgba(255,51,51,0.2)] hover:border-destructive border border-transparent clip-chamfer-reverse transition-all"
          onClick={() => onRemove(backend.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
