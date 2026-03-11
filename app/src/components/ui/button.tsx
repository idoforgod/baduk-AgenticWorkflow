// =============================================================================
// components/ui/button.tsx — Reusable Button with CVA variants
// =============================================================================

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import * as React from 'react'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: Parameters<typeof clsx>): string {
  return twMerge(clsx(inputs))
}

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]',
        destructive: 'bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)]',
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
        secondary: 'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--border)]',
        ghost: 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
        link: 'text-[var(--accent)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
