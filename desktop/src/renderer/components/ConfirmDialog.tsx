import { createPortal } from 'react-dom'
import { Button } from './ui/Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-dialog-backdrop" onClick={onCancel} />
      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm border border-primary/40 bg-background/95 p-6 clip-chamfer animate-dialog-enter shadow-[0_0_30px_rgba(0,240,255,0.15)]">
        {/* Top border glow */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"></div>
        {/* Corner deco */}
        <div className="absolute top-2 right-3 font-mono text-[8px] text-primary/30 tracking-widest">SYS.CONFIRM</div>

        <h3 className="font-mono text-sm font-bold tracking-wider uppercase text-primary">{title}</h3>
        <p className="mt-3 font-mono text-xs text-muted-foreground leading-relaxed tracking-wide">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            ABORT
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            {confirmLabel.toUpperCase()}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
