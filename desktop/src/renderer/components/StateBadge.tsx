import { cn } from '@/lib/utils'
import type { BackendState } from '@/types/backend'

const stateConfig: Record<BackendState, { color: string; textColor: string; label: string; pulse?: boolean; glow?: string }> = {
  connected: {
    color: 'bg-success',
    textColor: 'text-success',
    label: 'Connected',
    glow: 'shadow-[0_0_8px_rgba(0,255,102,0.5)]'
  },
  connecting: {
    color: 'bg-warning',
    textColor: 'text-warning',
    label: 'Syncing',
    pulse: true,
    glow: 'shadow-[0_0_8px_rgba(255,204,0,0.5)]'
  },
  disconnected: {
    color: 'bg-muted-foreground',
    textColor: 'text-muted-foreground',
    label: 'Offline'
  },
  error: {
    color: 'bg-destructive',
    textColor: 'text-destructive',
    label: 'Error',
    glow: 'shadow-[0_0_8px_rgba(255,51,51,0.5)]'
  }
}

interface StateBadgeProps {
  state: BackendState
  className?: string
}

export function StateBadge({ state, className }: StateBadgeProps) {
  const config = stateConfig[state]
  return (
    <span className={cn(
      'inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest animate-status-flicker',
      config.textColor,
      className
    )}>
      <span
        className={cn(
          'h-2.5 w-2.5 rounded-none',
          config.color,
          config.glow,
          config.pulse && 'animate-pulse-dot'
        )}
      />
      {config.label}
    </span>
  )
}
