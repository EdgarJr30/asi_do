import type { SelectHTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-primary-400 dark:focus:ring-primary-950',
        className
      )}
      {...props}
    />
  )
}
