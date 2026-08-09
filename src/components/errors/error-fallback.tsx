import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

/**
 * Superficie visible cuando algo se rompe al renderizar.
 *
 * Se separa del boundary para que la use tambien el `errorElement` del router,
 * que no es una clase y no puede compartir el mismo componente.
 */
export function ErrorFallback({
  title,
  description,
  visual,
  actionLabel,
  actionIcon,
  onAction,
  secondaryLabel,
  onSecondaryAction
}: {
  title: string
  description: string
  visual?: ReactNode
  actionLabel: string
  actionIcon?: ReactNode
  onAction: () => void
  secondaryLabel?: string
  onSecondaryAction?: () => void
}) {
  return (
    // `role="alert"` para que un lector de pantalla lo anuncie al aparecer: sin
    // esto el usuario que no ve la pantalla no se entera de que hubo un fallo, y
    // el foco se queda donde estaba.
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-[60vh] items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-md rounded-card-lg border border-(--app-border) bg-(--app-surface-elevated) px-5 py-8 text-center shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)] sm:px-8 sm:py-10">
        {visual ? <div className="mb-6 flex justify-center">{visual}</div> : null}
        <h1 className="text-xl font-semibold tracking-tight text-(--app-text)">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-(--app-text-muted)">
          {description}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button onClick={onAction}>
            {actionIcon}
            {actionLabel}
          </Button>
          {secondaryLabel && onSecondaryAction ? (
            <Button variant="outline" onClick={onSecondaryAction}>
              {secondaryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
