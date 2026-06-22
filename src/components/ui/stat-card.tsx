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
        'rounded-panel border border-(--app-border) bg-(--app-surface-elevated) px-3.5 py-3 shadow-[0_10px_26px_rgba(10,18,36,0.06)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.16)]',
        className
      )}
      {...props}
    >
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-(--app-text-subtle)">{label}</p>
      <p className="mt-2 text-[1.15rem] font-semibold tracking-tight text-(--app-text) sm:text-[1.3rem]">{value}</p>
      {helper ? <p className="mt-1.5 text-[0.8rem] leading-4.5 text-(--app-text-muted)">{helper}</p> : null}
    </div>
  )
}
