import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-card border border-(--app-border) p-3.5 shadow-[0_10px_28px_rgba(10,18,36,0.06)] backdrop-blur-sm sm:p-4 dark:shadow-[0_14px_32px_rgba(0,0,0,0.18)]',
        className
      )}
      style={{
        background: 'var(--app-surface-elevated)'
      }}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1.5', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[0.95rem] font-semibold tracking-tight text-(--app-text) sm:text-base', className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[0.8rem] leading-5 text-(--app-text-muted)', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-3', className)} {...props} />
}
