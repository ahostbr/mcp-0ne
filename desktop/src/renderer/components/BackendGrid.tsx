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
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground p-6">
        <Server className="h-12 w-12 opacity-30" />
        <p className="text-sm">Not connected to mcp-0ne server</p>
        <p className="text-xs">Waiting for connection...</p>
      </div>
    )
  }

  if (backends.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground p-6">
        <Server className="h-12 w-12 opacity-30" />
        <p className="text-sm">No backends configured</p>
        <Button variant="primary" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add Backend
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {backends.map((b) => (
          <BackendCard key={b.id} backend={b} onRemove={onRemove} />
        ))}
      </div>
    </div>
  )
}
