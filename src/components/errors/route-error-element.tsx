import { useEffect } from 'react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'

import { ErrorFallback } from '@/components/errors/error-fallback'
import { StaleVersionFallback } from '@/components/errors/stale-version-fallback'
import { isStaleChunkError } from '@/components/errors/stale-chunk'
import { captureClientError } from '@/lib/errors/client-error-logger'
import { surfacePaths } from '@/app/router/surface-paths'

/**
 * `errorElement` del router.
 *
 * Cubre lo que una frontera de React no ve: los fallos al resolver una ruta —el
 * import dinamico de la pagina, un loader— ocurren antes de que haya arbol que
 * proteger. Sin esto, un chunk que no carga deja la pantalla en blanco.
 *
 * La recuperacion que ofrece es distinta a la del boundary: aqui se puede
 * navegar, asi que el camino de salida es volver al inicio en vez de recargar a
 * ciegas.
 */
export function RouteErrorElement() {
  const error = useRouteError()
  const navigate = useNavigate()

  useEffect(() => {
    // Un 404 del router es navegacion normal, no un fallo que registrar.
    if (isRouteErrorResponse(error) && error.status === 404) {
      return
    }

    void captureClientError({
      source: 'router.route-error',
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      error,
      severity: 'fatal',
      userMessage: 'La pagina no se pudo abrir.'
    })
  }, [error])

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <ErrorFallback
        title="Esta pagina no existe"
        description="Puede que el enlace este mal o que el contenido se haya movido."
        actionLabel="Ir al inicio"
        onAction={() => void navigate(surfacePaths.institutional.home)}
      />
    )
  }

  if (isStaleChunkError(error)) {
    return <StaleVersionFallback onReload={() => window.location.reload()} />
  }

  return (
    <ErrorFallback
      title="No pudimos abrir esta pagina"
      description="El fallo quedo registrado y lo vamos a revisar. Vuelve al inicio o recarga para intentarlo de nuevo."
      actionLabel="Ir al inicio"
      onAction={() => void navigate(surfacePaths.institutional.home)}
      secondaryLabel="Recargar"
      onSecondaryAction={() => window.location.reload()}
    />
  )
}
