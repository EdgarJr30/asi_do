import { useEffect } from 'react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { captureClientError } from '@/lib/errors/client-error-logger'

export function ErrorEventBridge() {
  const session = useAppSession()

  useEffect(() => {
    function handleWindowError(event: ErrorEvent) {
      void captureClientError({
        source: 'window.error',
        route: window.location.pathname,
        userId: session.authUser?.id ?? null,
        userMessage: 'La aplicacion encontro un error inesperado.',
        error: event.error ?? new Error(event.message),
        severity: 'fatal',
        metadata: {
          columnNumber: event.colno,
          fileName: event.filename,
          lineNumber: event.lineno
        }
      })
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      void captureClientError({
        source: 'window.unhandledrejection',
        route: window.location.pathname,
        userId: session.authUser?.id ?? null,
        userMessage: 'La aplicacion encontro una promesa sin manejar.',
        error: event.reason,
        severity: 'fatal'
      })
    }

    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleWindowError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [session.authUser?.id])

  return null
}
