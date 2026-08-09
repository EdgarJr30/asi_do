import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from '@/components/errors/error-boundary'
import { isStaleChunkError } from '@/components/errors/stale-chunk'
import { appRoutes } from '@/app/router/routes'

const captureClientError = vi.hoisted(() => vi.fn())

vi.mock('@/lib/errors/client-error-logger', () => ({ captureClientError }))

function Boom({ shouldThrow, message }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) {
    throw new Error(message ?? 'fallo de render')
  }

  return <p>contenido vivo</p>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    captureClientError.mockClear()
    // React escribe el error a la consola aunque el boundary lo capture; se
    // silencia para que la salida de la suite siga siendo legible.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deja pasar a los hijos cuando no hay error', () => {
    render(
      <ErrorBoundary source="test">
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('contenido vivo')).toBeTruthy()
  })

  it('muestra el fallback en vez de la pantalla en blanco', () => {
    render(
      <ErrorBoundary source="test">
        <Boom shouldThrow />
      </ErrorBoundary>
    )

    // Lo que se verifica no es el texto sino que haya *algo* anunciado: sin
    // boundary el arbol se desmontaba y el contenedor quedaba vacio.
    const alert = screen.getByRole('alert')

    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain('Algo se rompio en esta pantalla')
  })

  it('registra el fallo como fatal, con la ruta y el stack de componentes', () => {
    render(
      <ErrorBoundary source="workspace">
        <Boom shouldThrow />
      </ErrorBoundary>
    )

    expect(captureClientError).toHaveBeenCalledTimes(1)

    const call = captureClientError.mock.calls[0][0] as {
      source: string
      severity: string
      metadata: { componentStack: string }
    }

    expect(call.source).toBe('workspace.render')
    expect(call.severity).toBe('fatal')
    expect(typeof call.metadata.componentStack).toBe('string')
  })

  it('reintentar vuelve a montar el subarbol', () => {
    // El caso real: el fallo era transitorio y ya no ocurre. Se modela cambiando
    // la prop en vez de mutando una bandera dentro del componente, porque React
    // vuelve a renderizar una vez mas en dev despues de capturar un error y esa
    // segunda pasada hacia el test no determinista.
    const { rerender } = render(
      <ErrorBoundary source="test">
        <Boom shouldThrow />
      </ErrorBoundary>
    )

    expect(screen.getByRole('alert')).toBeTruthy()

    rerender(
      <ErrorBoundary source="test">
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    )

    // Mientras el boundary siga en estado de error, cambiar los hijos no basta:
    // es el boton el que tiene que limpiarlo.
    expect(screen.getByRole('alert')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(screen.getByText('contenido vivo')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('trata el chunk obsoleto como un caso aparte, con recarga en vez de reintento', () => {
    render(
      <ErrorBoundary source="test">
        <Boom shouldThrow message="Failed to fetch dynamically imported module: /assets/page-abc123.js" />
      </ErrorBoundary>
    )

    const alert = screen.getByRole('alert')

    expect(screen.getByRole('heading', { name: 'Hay una versión nueva disponible' })).toBeTruthy()
    expect(
      screen.getByText(
        'Esta pestaña conservó una versión anterior de la aplicación y no pudo cargar esta página. Recarga para usar la versión más reciente.'
      )
    ).toBeTruthy()
    expect(alert.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
    // Reintentar el render no sirve: el chunk sigue sin existir en el servidor.
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy()
  })
})

describe('deteccion de chunk obsoleto', () => {
  it.each([
    ['Failed to fetch dynamically imported module: /assets/x.js', true],
    ['Importing a module script failed.', true],
    ['error loading dynamically imported module', true],
    ['Cannot read properties of undefined', false],
    ['NetworkError when attempting to fetch resource.', false]
  ])('%s → %s', (message, expected) => {
    expect(isStaleChunkError(new Error(message))).toBe(expected)
  })

  it('no revienta con valores que no son Error', () => {
    expect(isStaleChunkError(null)).toBe(false)
    expect(isStaleChunkError(undefined)).toBe(false)
    expect(isStaleChunkError({ status: 500 })).toBe(false)
  })
})

describe('cobertura de errorElement en el router', () => {
  it('toda ruta de primer nivel tiene su errorElement', () => {
    // Sin esto, un import dinamico que falla en una experiencia nueva vuelve a
    // dejar la pantalla en blanco, y el fallo no se nota hasta produccion.
    const sinCobertura = appRoutes.filter((route) => !route.errorElement)

    expect(sinCobertura.map((route) => route.path ?? '(sin path)')).toEqual([])
  })
})
