import type { InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-primary-400 dark:focus:ring-primary-950',
        className
      )}
      {...props}
    />
  )
}
