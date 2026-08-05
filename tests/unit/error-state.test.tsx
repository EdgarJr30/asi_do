import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorState } from '@/components/ui/error-state'

const captureClientError = vi.hoisted(() => vi.fn())

vi.mock('@/lib/errors/client-error-logger', () => ({ captureClientError }))

describe('estado de error de una seccion', () => {
  beforeEach(() => {
    captureClientError.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('se anuncia como alerta', () => {
    render(<ErrorState error={new Error('fallo')} source="prueba" />)

    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('nunca muestra el mensaje crudo del error', () => {
    // `toErrorMessage` devuelve el texto del proveedor tal cual, incluido el
    // campo `details` de PostgREST, que puede describir tablas y politicas. Ese
    // texto va al registro, no a la pantalla.
    const leaky = new Error(
      'permission denied for table candidate_profiles; policy "candidate_profiles_select_own" failed'
    )

    render(<ErrorState error={leaky} source="prueba" />)

    expect(screen.getByRole('alert').textContent).not.toContain('candidate_profiles')
    expect(screen.getByRole('alert').textContent).not.toContain('permission denied')
  })

  it('registra la causa real una sola vez por error', () => {
    const error = new Error('fallo de red')
    const { rerender } = render(<ErrorState error={error} source="dashboard.candidate.applications" />)

    rerender(<ErrorState error={error} source="dashboard.candidate.applications" />)
    rerender(<ErrorState error={error} source="dashboard.candidate.applications" />)

    // Sin la guarda, cada re-render escribiria otra fila y el rate limit de la
    // ingesta acabaria descartando errores distintos que si importan.
    expect(captureClientError).toHaveBeenCalledTimes(1)

    const call = captureClientError.mock.calls[0][0] as { source: string; error: unknown }

    expect(call.source).toBe('dashboard.candidate.applications')
    expect(call.error).toBe(error)
  })

  it('vuelve a registrar si el error cambia', () => {
    const { rerender } = render(<ErrorState error={new Error('primero')} source="prueba" />)

    rerender(<ErrorState error={new Error('segundo')} source="prueba" />)

    expect(captureClientError).toHaveBeenCalledTimes(2)
  })

  it('ofrece reintentar cuando hay como hacerlo', () => {
    const onRetry = vi.fn()

    render(<ErrorState error={new Error('fallo')} source="prueba" onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('no ofrece un boton que no lleva a ningun sitio', () => {
    render(<ErrorState error={new Error('fallo')} source="prueba" />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('bloquea el reintento mientras uno esta en curso', () => {
    const onRetry = vi.fn()

    render(<ErrorState error={new Error('fallo')} source="prueba" isRetrying onRetry={onRetry} />)

    const button = screen.getByRole('button')

    expect(button.hasAttribute('disabled')).toBe(true)
  })
})
