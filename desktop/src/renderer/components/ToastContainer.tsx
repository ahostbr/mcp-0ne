import { X } from 'lucide-react'
import { useToastStore, type ToastVariant } from '@/stores/toast-store'
import { cn } from '@/lib/utils'

const variantClasses: Record<ToastVariant, string> = {
  success: 'border-success/50 bg-background/95 text-success shadow-[0_0_15px_rgba(0,255,102,0.15)]',
  error: 'border-destructive/50 bg-background/95 text-destructive shadow-[0_0_15px_rgba(255,51,51,0.15)]',
  warning: 'border-warning/50 bg-background/95 text-warning shadow-[0_0_15px_rgba(255,204,0,0.15)]',
  info: 'border-info/50 bg-background/95 text-info shadow-[0_0_15px_rgba(0,240,255,0.15)]'
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 border rounded-none px-4 py-3 font-mono text-xs uppercase tracking-wider clip-chamfer backdrop-blur-md animate-toast-enter',
            variantClasses[toast.variant]
          )}
        >
          <div className="h-1.5 w-1.5 rounded-none bg-current shadow-[0_0_6px_currentColor] shrink-0"></div>
          <span className="flex-1">{toast.message}</span>
          <button
            className="opacity-60 hover:opacity-100 cursor-pointer transition-opacity"
            onClick={() => removeToast(toast.id)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
