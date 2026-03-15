import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary-500 text-white hover:bg-primary-400',
  secondary: 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200',
  outline:
    'border border-zinc-300 bg-white text-zinc-900 hover:border-primary-300 hover:text-primary-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-primary-500 dark:hover:text-primary-300',
  ghost:
    'bg-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900',
  danger: 'bg-rose-500 text-white hover:bg-rose-400'
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ className, type = 'button', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-60',
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  )
}
