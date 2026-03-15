import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

type BadgeVariant = 'default' | 'soft' | 'outline'

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
  soft: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  outline: 'border border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide',
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
}
