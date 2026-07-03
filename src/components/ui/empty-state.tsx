import { Button } from '@/components/ui/button'

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-card-lg border border-dashed bg-(--app-surface-muted) px-4 py-6 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <h3 className="text-lg font-semibold tracking-tight text-(--app-text)">{title}</h3>
        <p className="text-sm leading-6 text-(--app-text-muted)">{description}</p>
        {actionLabel && onAction ? (
          <div className="pt-1">
            <Button variant="outline" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
