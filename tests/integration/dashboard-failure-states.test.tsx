import type { ReactElement } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listMyApplications = vi.hoisted(() => vi.fn())
const listOpenJobsPreview = vi.hoisted(() => vi.fn())
const captureClientError = vi.hoisted(() => vi.fn())

vi.mock('@/features/applications/lib/applications-api', () => ({ listMyApplications }))
vi.mock('@/lib/errors/client-error-logger', () => ({ captureClientError }))

vi.mock('@/app/providers/app-session-provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/providers/app-session-provider')>()

  return {
    ...actual,
    useAppSession: () => ({
      authUser: { id: 'user-1', email: 'persona@example.com' },
      profile: { full_name: 'Persona', display_name: 'Persona' },
      isAuthenticated: true,
      isLoading: false
    })
  }
})

function renderDashboard(CandidateHomePage: () => ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CandidateHomePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('dashboard del candidato: fallo distinguible de vacío', () => {
  beforeEach(() => {
    listMyApplications.mockReset()
    listOpenJobsPreview.mockReset()
    captureClientError.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cuando la consulta falla NO dice que no hay aplicaciones', async () => {
    // Este es el defecto que se corrige. Al fallar, el dato queda en `[]` y la
    // interfaz mostraba «Aún no tienes aplicaciones» y un 0 en las métricas:
    // exactamente lo que vería alguien que de verdad no tiene ninguna. El
    // usuario concluye que perdió sus datos, no que hubo un fallo de red.
    listMyApplications.mockRejectedValue(new Error('network down'))

    const { CandidateHomePage } = await import('@/features/dashboard/pages/candidate-home-page')

    renderDashboard(CandidateHomePage)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar tus aplicaciones')
    expect(screen.queryByText('Aún no tienes aplicaciones')).toBeNull()
  })

  it('cuando de verdad no hay ninguna, muestra el estado vacío y no una alerta', async () => {
    // La otra mitad del contrato: distinguir los dos casos solo sirve si el
    // vacío legítimo sigue viéndose como vacío.
    listMyApplications.mockResolvedValue([])

    const { CandidateHomePage } = await import('@/features/dashboard/pages/candidate-home-page')

    renderDashboard(CandidateHomePage)

    await waitFor(() => {
      expect(screen.getByText('Aún no tienes aplicaciones')).toBeTruthy()
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('registra la causa real del fallo', async () => {
    listMyApplications.mockRejectedValue(new Error('network down'))

    const { CandidateHomePage } = await import('@/features/dashboard/pages/candidate-home-page')

    renderDashboard(CandidateHomePage)

    await waitFor(() => {
      expect(captureClientError).toHaveBeenCalled()
    })

    const call = captureClientError.mock.calls[0][0] as { source: string }

    expect(call.source).toBe('dashboard.candidate.applications')
  })
})
