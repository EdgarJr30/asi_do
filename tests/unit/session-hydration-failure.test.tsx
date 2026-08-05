import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppSessionProvider, useAppSession } from '@/app/providers/app-session-provider'

const captureClientError = vi.hoisted(() => vi.fn())
const fetchSessionSnapshot = vi.hoisted(() => vi.fn())

vi.mock('@/lib/errors/client-error-logger', () => ({ captureClientError }))
vi.mock('@/features/auth/lib/auth-api', () => ({ fetchSessionSnapshot }))

const fakeUser = { id: 'user-1', email: 'persona@example.com' }
const fakeSession = { user: fakeUser }

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: fakeSession } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) })
  }
}))

vi.mock('@/shared/config/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/config/env')>()),
  getSupabaseConfig: () => ({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' })
}))

function SessionProbe() {
  const session = useAppSession()

  return <span data-testid="loading">{session.isLoading ? 'cargando' : 'listo'}</span>
}

// El fallo intermitente que rompia la suite venia de aqui: `hydrateSession` se
// invoca con `void` desde el efecto de arranque y desde el listener de auth, asi
// que sin un `catch` propio el rechazo escapaba del arbol de React y vitest lo
// reportaba mucho despues, atribuido a cualquier test que estuviera corriendo.
//
// No se asierta sobre `process.on('unhandledRejection')`: vitest intercepta los
// rechazos antes y el aserto pasaria incluso sin el arreglo. Lo que se vigila es
// la presencia del manejo —que el error se registre—, que es lo que solo puede
// ocurrir si el `catch` existe.
describe('fallo al hidratar la sesion', () => {
  beforeEach(() => {
    captureClientError.mockClear()
    fetchSessionSnapshot.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sale del estado de carga en vez de quedarse colgada', async () => {
    fetchSessionSnapshot.mockRejectedValue(new Error('RLS bloqueo el perfil'))

    render(
      <AppSessionProvider>
        <SessionProbe />
      </AppSessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('listo')
    })
  })

  it('registra el fallo en vez de tragarselo', async () => {
    fetchSessionSnapshot.mockRejectedValue(new Error('RLS bloqueo el perfil'))

    render(
      <AppSessionProvider>
        <SessionProbe />
      </AppSessionProvider>
    )

    await waitFor(() => {
      expect(captureClientError).toHaveBeenCalled()
    })

    const call = captureClientError.mock.calls[0][0] as { source: string; userId: string }

    expect(call.source).toBe('session.hydrate')
    expect(call.userId).toBe('user-1')
  })
})
