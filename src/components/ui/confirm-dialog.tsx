import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Diálogo de confirmación reutilizable (reemplaza window.confirm/alert nativos).
 * Usa el mismo patrón de overlay + Card que los modales del resto de la app.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        aria-label="Cancelar"
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />
      <Card className="relative z-10 w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {description ? <p className="text-sm leading-6 text-(--app-text-muted)">{description}</p> : null}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button variant={variant} onClick={onConfirm} disabled={loading}>
              {confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
