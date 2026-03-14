import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

type BadgeVariant = 'default' | 'soft' | 'outline'

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-primary-100 text-primary-700',
  soft: 'bg-sky-100 text-sky-700',
  outline: 'border border-zinc-200 bg-white text-zinc-700'
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
