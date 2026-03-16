import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
}

export function StatCard({ label, value, helper, className, ...props }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-[20px] border bg-[var(--app-surface)] px-4 py-4 shadow-[var(--app-shadow-card)]',
        className
      )}
      {...props}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">{label}</p>
      <p className="mt-3 text-[1.45rem] font-semibold tracking-tight text-[var(--app-text)] sm:text-[1.6rem]">{value}</p>
      {helper ? <p className="mt-2 text-sm leading-5 text-[var(--app-text-muted)]">{helper}</p> : null}
    </div>
  )
}
