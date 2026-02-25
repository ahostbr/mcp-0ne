import { cn } from '@/lib/utils'
import type { BackendState } from '@/types/backend'

const stateConfig: Record<BackendState, { color: string; label: string; pulse?: boolean }> = {
  connected: { color: 'bg-success', label: 'Connected' },
  connecting: { color: 'bg-warning', label: 'Connecting', pulse: true },
  disconnected: { color: 'bg-muted-foreground', label: 'Disconnected' },
  error: { color: 'bg-destructive', label: 'Error' }
}

interface StateBadgeProps {
  state: BackendState
  className?: string
}

export function StateBadge({ state, className }: StateBadgeProps) {
  const config = stateConfig[state]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span
        className={cn('h-2 w-2 rounded-full', config.color, config.pulse && 'animate-pulse-dot')}
      />
      {config.label}
    </span>
  )
}
