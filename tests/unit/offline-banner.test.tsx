import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OfflineBanner } from '@/components/ui/offline-banner'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'))
  })
}

function renderBanner() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const refetchQueries = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined)

  render(
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
    </QueryClientProvider>
  )

  return { refetchQueries }
}

describe('aviso de sin conexion', () => {
  beforeEach(() => {
    setOnline(true)
  })

  afterEach(() => {
    setOnline(true)
    vi.restoreAllMocks()
  })

  it('no muestra nada mientras hay conexion', () => {
    renderBanner()

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('aparece al perder la conexion', () => {
    renderBanner()
    setOnline(false)

    const banner = screen.getByRole('status')

    expect(banner.textContent).toContain('Sin conexión')
    // `status` y no `alert`: es una condicion persistente, no una interrupcion.
    expect(banner.getAttribute('aria-live')).toBe('polite')
  })

  it('reintenta a mano sin esperar a que vuelva la red', () => {
    // El caso que justifica el boton: `navigator.onLine` dice que hay red y aun
    // asi no la hay, que es lo normal en un wifi cautivo.
    const { refetchQueries } = renderBanner()
    setOnline(false)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(refetchQueries).toHaveBeenCalledWith({ type: 'all' })
  })

  it('al volver la conexion refresca solo y se oculta', async () => {
    const { refetchQueries } = renderBanner()

    setOnline(false)
    expect(screen.getByRole('status')).toBeTruthy()

    refetchQueries.mockClear()
    setOnline(true)

    await waitFor(() => {
      expect(refetchQueries).toHaveBeenCalledWith({ type: 'all' })
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('no refresca al montar si nunca se perdio la conexion', () => {
    // Sin la guarda de "estuvo offline", cada montaje dispararia un refetch
    // global y la app entera parpadearia al navegar.
    const { refetchQueries } = renderBanner()

    expect(refetchQueries).not.toHaveBeenCalled()
  })
})
