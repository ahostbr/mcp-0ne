import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono uppercase tracking-wider font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30 cursor-pointer clip-chamfer relative overflow-hidden',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-transparent hover:text-primary border border-transparent hover:border-primary hover:shadow-[0_0_15px_rgba(0,240,255,0.6)]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-transparent hover:text-secondary border border-transparent hover:border-secondary hover:shadow-[0_0_15px_rgba(255,0,85,0.6)]',
        ghost: 'hover:bg-primary/20 text-primary hover:text-primary hover:shadow-[inset_0_0_10px_rgba(0,240,255,0.2)]',
        destructive: 'bg-destructive/10 text-destructive border border-destructive hover:bg-destructive hover:text-destructive-foreground hover:shadow-[0_0_15px_rgba(255,51,51,0.6)]',
        outline: 'border-b-2 border-primary bg-background/50 text-primary hover:bg-primary/10 hover:shadow-[0px_4px_10px_-2px_rgba(0,240,255,0.4)]'
      },
      size: {
        sm: 'h-8 px-4 text-[10px]',
        md: 'h-9 px-6 text-xs',
        lg: 'h-10 px-8 text-sm',
        icon: 'h-8 w-8 text-sm !px-0 rounded-none clip-chamfer'
      }
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> { }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
)
Button.displayName = 'Button'
