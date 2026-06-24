import { forwardRef, type SelectHTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full rounded-2xl border border-(--app-border) bg-(--app-surface-elevated) px-3.5 text-sm text-(--app-text) shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-[border-color,background-color,box-shadow,color] duration-200 hover:border-primary-300/60 focus:border-primary-400 focus:bg-(--app-surface) focus:ring-2 focus:ring-(--app-ring) dark:hover:border-primary-500/40',
        className
      )}
      {...props}
    />
  )
})
