import { RotateCw, Trash2, Power, PowerOff } from 'lucide-react'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { StateBadge } from './StateBadge'
import { useBackendStore } from '@/stores/backend-store'
import type { Backend } from '@/types/backend'

interface BackendCardProps {
  backend: Backend
  onRemove: (id: string) => void
}

export function BackendCard({ backend, onRemove }: BackendCardProps) {
  const { refreshBackend, toggleBackend } = useBackendStore()

  return (
    <div className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-[0_0_12px_-3px_rgba(59,130,246,0.15)]">
      {/* Header: prefix + state */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-primary">{backend.prefix}</span>
        <StateBadge state={backend.state} />
      </div>

      {/* ID */}
      <p className="text-xs text-muted-foreground">{backend.id}</p>

      {/* Description + type */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={backend.type === 'http' ? 'info' : 'warning'}>
          {backend.type.toUpperCase()}
        </Badge>
        {backend.state === 'connected' && (
          <Badge variant="success">{backend.tool_count} tools</Badge>
        )}
        {!backend.enabled && (
          <Badge variant="default">Disabled</Badge>
        )}
      </div>

      {/* Description */}
      {backend.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{backend.description}</p>
      )}

      {/* Error */}
      {backend.error && (
        <p className="text-xs text-destructive line-clamp-2">{backend.error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-border mt-auto">
        <Button
          variant="ghost"
          size="icon"
          title={backend.enabled ? 'Disable' : 'Enable'}
          onClick={() => toggleBackend(backend.id, !backend.enabled)}
        >
          {backend.enabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Refresh"
          onClick={() => refreshBackend(backend.id)}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          title="Remove"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onRemove(backend.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
