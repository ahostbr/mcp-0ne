import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-none font-mono uppercase tracking-widest px-2 py-0.5 text-[10px] font-bold border',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-muted-foreground shadow-[inset_0_0_5px_rgba(255,255,255,0.05)]',
        success: 'border-success bg-success/10 text-success shadow-[0_0_8px_rgba(0,255,102,0.3)]',
        error: 'border-destructive bg-destructive/10 text-destructive shadow-[0_0_8px_rgba(255,51,51,0.3)]',
        warning: 'border-warning bg-warning/10 text-warning shadow-[0_0_8px_rgba(255,204,0,0.3)]',
        info: 'border-info bg-info/10 text-info shadow-[0_0_8px_rgba(0,240,255,0.3)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof badgeVariants> { }

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />
}
