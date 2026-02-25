import { X } from 'lucide-react'
import { useToastStore, type ToastVariant } from '@/stores/toast-store'
import { cn } from '@/lib/utils'

const variantClasses: Record<ToastVariant, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-info/30 bg-info/10 text-info'
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
            'flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg animate-in slide-in-from-right',
            variantClasses[toast.variant]
          )}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            className="opacity-60 hover:opacity-100 cursor-pointer"
            onClick={() => removeToast(toast.id)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
