import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-[0_16px_40px_rgba(0,0,0,0.28)]',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-2', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold text-zinc-950 dark:text-zinc-50', className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-6 text-zinc-600 dark:text-zinc-400', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4', className)} {...props} />
}
