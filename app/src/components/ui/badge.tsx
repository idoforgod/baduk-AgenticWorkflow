// =============================================================================
// components/ui/badge.tsx — Status/label badge
// =============================================================================

import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from './button'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]',
        secondary:
          'border-transparent bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--border)]',
        destructive:
          'border-transparent bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)]',
        outline: 'text-[var(--text-primary)] border-[var(--border)]',
        success: 'border-transparent bg-[var(--success)] text-white',
        warning: 'border-transparent bg-[var(--warning)] text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
