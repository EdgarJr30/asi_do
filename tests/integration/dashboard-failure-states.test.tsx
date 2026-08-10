import type { ReactElement } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listMyApplications = vi.hoisted(() => vi.fn())
const listPublicJobs = vi.hoisted(() => vi.fn())
const captureClientError = vi.hoisted(() => vi.fn())

vi.mock('@/features/applications/lib/applications-api', () => ({ listMyApplications }))
vi.mock('@/lib/errors/client-error-logger', () => ({ captureClientError }))

/**
 * La cuarta métrica del panel —«Vacantes para ti»— la alimenta `listPublicJobs`, y
 * sin este doble el test **salía a la red de verdad**: `listPublicJobs` usa el cliente
 * de Supabase, que apunta al host inventado de `src/test/env.ts`. Cuando esa petición
 * fallaba dentro de la ventana de las aserciones, esa métrica también se marcaba como
 * fallida y aparecía un `Dato no disponible` de más. De ahí el fallo intermitente que
 * solo se veía dentro de `npm run verify` —máquina más cargada, otro reparto de
 * tiempos— y que reventaba dos de los tres tests de este archivo: uno esperaba 3
 * etiquetas y veía 4, y el otro esperaba ninguna y veía 1.
 *
 * Medido antes de arreglarlo: 1 fallo en 14 corridas de la suite.
 */
vi.mock('@/features/jobs/lib/jobs-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/jobs/lib/jobs-api')>()),
  listPublicJobs
}))

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
    // Éxito por defecto: cada prueba habla del fallo de *aplicaciones*, así que la
    // consulta de vacantes tiene que ser un fondo estable, no una tercera variable.
    listPublicJobs.mockReset()
    // La forma importa: la página lee `data?.jobs.length`, así que un `[]` la
    // rompería entera en vez de dar cero vacantes.
    listPublicJobs.mockResolvedValue({ jobs: [], savedJobIds: [] })
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

  it('las métricas no muestran un 0 que miente cuando la consulta falla', async () => {
    // La mitad del defecto que quedaba sin cubrir. Aunque la lista ya avise del
    // fallo, unas tarjetas que dicen «0 aplicaciones activas» y «0 entrevistas»
    // siguen afirmando un dato falso: quien tiene diez postulaciones lee que no
    // tiene ninguna. Al fallar deben mostrar «—», no un número.
    listMyApplications.mockRejectedValue(new Error('network down'))

    const { CandidateHomePage } = await import('@/features/dashboard/pages/candidate-home-page')

    renderDashboard(CandidateHomePage)

    // Se espera al estado final —las tres— y no a «al menos una». Con el umbral
    // anterior la espera terminaba en cuanto aparecía la primera, y la aserción
    // siguiente leía un render intermedio: el mismo patrón que prohíbe
    // `TESTING_RULES` §10.2.
    //
    // Las tres métricas que dependen de las postulaciones: activas, entrevistas
    // y tasa de respuesta. La cuarta, vacantes, carga bien a propósito.
    await waitFor(() => {
      expect(screen.getAllByLabelText('Dato no disponible')).toHaveLength(3)
    })

    expect(screen.getAllByText('No se pudo cargar').length).toBe(3)
  })

  it('las métricas sí muestran 0 cuando el 0 es verdad', async () => {
    // El control de la prueba anterior: «—» solo debe aparecer por fallo. Si
    // sustituyera también al cero legítimo, la corrección habría cambiado un
    // dato engañoso por otro.
    listMyApplications.mockResolvedValue([])

    const { CandidateHomePage } = await import('@/features/dashboard/pages/candidate-home-page')

    renderDashboard(CandidateHomePage)

    await waitFor(() => {
      expect(screen.getByText('Aún no tienes aplicaciones')).toBeTruthy()
    })

    expect(screen.queryByLabelText('Dato no disponible')).toBeNull()
    expect(screen.queryByText('No se pudo cargar')).toBeNull()
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
