import { Component, type ErrorInfo, type ReactNode } from 'react'

import { ErrorFallback } from '@/components/errors/error-fallback'
import { isStaleChunkError } from '@/components/errors/stale-chunk'
import { captureClientError } from '@/lib/errors/client-error-logger'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Identifica la superficie en los registros: `app.root`, `workspace`, etc. */
  source: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Frontera de error de React.
 *
 * Antes de esto no habia ninguna en el proyecto: un error lanzado durante el
 * render desmontaba el arbol entero y dejaba la pantalla en blanco, sin mensaje,
 * sin forma de volver y sin registro de lo ocurrido. El usuario solo podia
 * recargar a ciegas, y nosotros nunca nos enterabamos.
 *
 * Tiene que ser una clase: `componentDidCatch` y `getDerivedStateFromError` no
 * tienen equivalente en hooks.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // `severity: 'fatal'` los separa de los errores de negocio ya registrados:
    // estos dejaron la interfaz inutilizable.
    void captureClientError({
      source: `${this.props.source}.render`,
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      error,
      severity: 'fatal',
      userMessage: 'La pantalla no se pudo mostrar.',
      metadata: { componentStack: info.componentStack }
    })
  }

  private handleRetry = () => {
    // Limpiar el error vuelve a montar el subarbol. Sirve para fallos
    // transitorios; si el error es determinista volvera a saltar, y para eso
    // esta el segundo boton.
    this.setState({ error: null })
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state

    if (!error) {
      return this.props.children
    }

    if (isStaleChunkError(error)) {
      return (
        <ErrorFallback
          title="Hay una version nueva disponible"
          description="Esta pestana quedo con una version anterior de la aplicacion y no pudo cargar una parte. Recarga para tomar la ultima."
          actionLabel="Recargar"
          onAction={this.handleReload}
        />
      )
    }

    return (
      <ErrorFallback
        title="Algo se rompio en esta pantalla"
        description="El fallo quedo registrado y lo vamos a revisar. Puedes reintentar; si vuelve a pasar, recarga la pagina."
        actionLabel="Reintentar"
        onAction={this.handleRetry}
        secondaryLabel="Recargar"
        onSecondaryAction={this.handleReload}
      />
    )
  }
}
