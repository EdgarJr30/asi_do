import { Suspense, type ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export function RoutePending({
  label = 'Cargando vista',
  hint,
  fullScreen = false
}: {
  label?: string
  hint?: string
  fullScreen?: boolean
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex w-full flex-col items-center justify-center gap-3 px-6 text-center', fullScreen ? 'min-h-dvh' : 'min-h-[clamp(14rem,38vh,24rem)]')}
    >
      <span className="relative flex size-10 items-center justify-center rounded-full border border-primary-200 bg-primary-50 dark:border-primary-500/25 dark:bg-primary-500/12">
        <span className="size-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600 dark:border-primary-500/20 dark:border-t-primary-300" />
      </span>
      <span className="text-sm font-semibold text-(--app-text)">{label}</span>
      {hint ? <span className="max-w-sm text-xs leading-5 text-(--app-text-muted)">{hint}</span> : null}
    </div>
  )
}

export function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RoutePending />}>{children}</Suspense>
}
