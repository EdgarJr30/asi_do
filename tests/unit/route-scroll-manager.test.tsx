import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RouteScrollManager } from '@/app/router/route-scroll-manager'

function NavigationHarness() {
  const navigate = useNavigate()

  return (
    <>
      <RouteScrollManager />
      <button
        type="button"
        onClick={() => {
          void navigate('/workspace/talent?candidate=63e5ebe0-2ac7-4100-ac7e-d15413c826ad', {
            replace: true,
            preventScrollReset: true
          })
        }}
      >
        Abrir candidato
      </button>
      <button
        type="button"
        onClick={() => {
          void navigate('/workspace/pipeline')
        }}
      >
        Cambiar ruta
      </button>
    </>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RouteScrollManager', () => {
  it('preserva el scroll en cambios de query y lo reinicia al cambiar de ruta', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

    render(
      <MemoryRouter initialEntries={['/workspace/talent']}>
        <NavigationHarness />
      </MemoryRouter>
    )

    expect(scrollTo).toHaveBeenCalledTimes(1)
    scrollTo.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir candidato' }))
    expect(scrollTo).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar ruta' }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' })
  })
})
