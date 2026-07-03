import type { HTMLMotionProps } from 'motion/react'
import { motion, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border border-primary-600 bg-primary-600 text-white shadow-[0_12px_24px_rgba(43,69,143,0.2)] hover:border-primary-700 hover:bg-primary-700 hover:text-white hover:shadow-[0_18px_32px_rgba(43,69,143,0.28)]',
  secondary:
    'border border-accent-200 bg-accent-50 text-accent-600 shadow-sm hover:border-accent-300 hover:bg-accent-100 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)] dark:border-accent-500/25 dark:bg-accent-500/10 dark:text-accent-200 dark:hover:bg-accent-500/16',
  outline:
    'border bg-(--app-surface) text-(--app-text) shadow-sm hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 hover:shadow-[0_12px_24px_rgba(15,23,42,0.1)] dark:hover:border-primary-400 dark:hover:bg-primary-500/12 dark:hover:text-primary-200',
  ghost:
    'border border-transparent bg-transparent text-(--app-text-muted) hover:border-(--app-border) hover:bg-(--app-surface-muted) hover:text-(--app-text)',
  danger:
    'border border-rose-300 bg-rose-500 text-white shadow-[0_12px_26px_rgba(244,114,182,0.18)] hover:border-rose-400 hover:bg-rose-600 hover:shadow-[0_18px_34px_rgba(244,114,182,0.24)] dark:border-rose-500/30 dark:bg-rose-500/90'
}

export interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: ButtonVariant
}

export function Button({ className, type = 'button', variant = 'primary', ...props }: ButtonProps) {
  const shouldReduceMotion = useReducedMotion()
  const isDisabled = props.disabled ?? false

  return (
    <motion.button
      animate={shouldReduceMotion || isDisabled ? undefined : { y: 0, scale: 1 }}
      type={type}
      className={cn(
        'inline-flex h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-card px-3.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--app-canvas) disabled:cursor-not-allowed disabled:opacity-60',
        buttonVariants[variant],
        className
      )}
      transition={{ type: 'spring', stiffness: 360, damping: 24, mass: 0.7 }}
      whileHover={shouldReduceMotion || isDisabled ? undefined : { y: -1, scale: 1.005 }}
      whileTap={shouldReduceMotion || isDisabled ? undefined : { scale: 0.99 }}
      {...props}
    />
  )
}
