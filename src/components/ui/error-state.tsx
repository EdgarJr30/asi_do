import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/loader'
import { captureClientError } from '@/lib/errors/client-error-logger'

/**
 * Estado de error de una sección, separado del estado vacío.
 *
 * Existe porque confundirlos engaña al usuario. Cuando una consulta falla, el
 * dato queda en `[]` y la interfaz decía "aún no tienes aplicaciones" o mostraba
 * un 0: exactamente lo mismo que vería alguien que de verdad no tiene ninguna.
 * El usuario concluye que perdió sus datos, no que hubo un fallo de red.
 *
 * El mensaje que se muestra **nunca** es el del error. `toErrorMessage` devuelve
 * el texto crudo del proveedor —incluido el campo `details` de PostgREST, que
 * puede describir tablas y políticas—, así que la causa real va al registro y al
 * usuario le llega una explicación en su idioma.
 */
export function ErrorState({
  title = 'No pudimos cargar esta sección',
  description = 'Puede ser un problema de conexión. Vuelve a intentarlo; si sigue fallando, ya quedó registrado y lo vamos a revisar.',
  error,
  source,
  onRetry,
  isRetrying = false
}: {
  title?: string
  description?: string
  error: unknown
  /** Identifica la superficie en los registros: `dashboard.applications`, etc. */
  source: string
  onRetry?: () => void
  isRetrying?: boolean
}) {
  const reportedErrorRef = useRef<unknown>(null)

  useEffect(() => {
    // Un render nuevo del mismo error no es un fallo nuevo: sin esta guarda, cada
    // re-render escribiría otra fila y el rate limit de la ingesta acabaría
    // descartando errores distintos que sí importan.
    if (!error || reportedErrorRef.current === error) {
      return
    }

    reportedErrorRef.current = error

    void captureClientError({
      source,
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      error,
      severity: 'error',
      userMessage: title
    })
  }, [error, source, title])

  return (
    <div
      role="alert"
      className="rounded-card-lg border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-500/30 dark:bg-rose-500/10"
    >
      <div className="mx-auto max-w-md space-y-3">
        <h3 className="text-lg font-semibold tracking-tight text-rose-900 dark:text-rose-100">
          {title}
        </h3>
        <p className="text-sm leading-6 text-rose-800/90 dark:text-rose-200/90">{description}</p>
        {onRetry ? (
          <div className="pt-1">
            <Button variant="outline" disabled={isRetrying} onClick={onRetry}>
              {isRetrying ? <Spinner className="size-4" /> : 'Reintentar'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
