import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

type BadgeVariant = 'default' | 'soft' | 'outline'

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'border border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/12 dark:text-primary-200',
  soft: 'border border-accent-200 bg-accent-50 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/12 dark:text-accent-200',
  outline: 'border bg-[var(--app-surface)] text-[var(--app-text-muted)]'
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-[0.72rem] font-semibold',
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
}
