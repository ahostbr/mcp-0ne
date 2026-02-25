import { Plus, Server } from 'lucide-react'
import { Button } from './ui/Button'
import { BackendCard } from './BackendCard'
import { useBackendStore } from '@/stores/backend-store'

interface BackendGridProps {
  onAdd: () => void
  onRemove: (id: string) => void
}

export function BackendGrid({ onAdd, onRemove }: BackendGridProps) {
  const backends = useBackendStore((s) => s.backends)
  const serverConnected = useBackendStore((s) => s.serverConnected)

  if (!serverConnected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground p-6 relative overflow-hidden">
        <Server className="h-16 w-16 opacity-30 text-destructive drop-shadow-[0_0_15px_rgba(255,51,51,0.5)]" />
        <p className="font-mono tracking-widest uppercase text-destructive">SYS.OFFLINE</p>
        <p className="font-mono text-xs opacity-50">Attempting connection to primary node...</p>
      </div>
    )
  }

  if (backends.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground p-6 relative overflow-hidden">
        <Server className="h-16 w-16 opacity-30 text-primary drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]" />
        <p className="font-mono tracking-widest uppercase text-primary">NO NODES DETECTED</p>
        <Button variant="primary" size="md" onClick={onAdd} className="clip-chamfer mt-4">
          <Plus className="h-4 w-4" />
          INITIALIZE NODE
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 relative">
      <div className="grid gap-6 auto-rows-max" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
        {backends.map((b, index) => (
          <div
            key={b.id}
            className="animate-card-enter"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <BackendCard backend={b} onRemove={onRemove} />
          </div>
        ))}
      </div>
    </div>
  )
}
