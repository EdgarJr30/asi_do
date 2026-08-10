import { act, StrictMode } from 'react'

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { surfacePaths } from '@/app/router/surface-paths'
import { AuthConfirmPage } from '@/features/auth/pages/auth-confirm-page'

/**
 * Confirmación de correo (`/auth/confirm`).
 *
 * Esta pantalla es la única salida del enlace del correo: si se queda colgada,
 * la persona ya gastó su enlace de un solo uso y no tiene otra vía para entrar.
 * El bug que motivó estas pruebas era exactamente ese: la pantalla se quedaba
 * en el estado de carga para siempre porque el efecto se cancelaba a sí mismo
 * (confirmar cambia la sesión → el provider re-renderiza → cambia una
 * dependencia del efecto → la limpieza apagaba la bandera que autorizaba
 * navegar y mostrar el error).
 */

const completeAuthConfirmation = vi.hoisted(() => vi.fn())
const captureClientError = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())
const refresh = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/lib/auth-api', () => ({
  completeAuthConfirmation,
  toErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error))
}))

vi.mock('@/lib/errors/client-error-logger', () => ({ captureClientError }))

vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate
}))

const sessionState = vi.hoisted(() => ({ isSupabaseConfigured: true }))

vi.mock('@/app/providers/app-session-provider', () => ({
  // Objeto nuevo en cada render, igual que el provider real: su valor de
  // contexto se memoiza por datos de sesión, y confirmar el correo cambia
  // justamente esos datos.
  useAppSession: () => ({
    isSupabaseConfigured: sessionState.isSupabaseConfigured,
    authUser: null,
    refresh
  })
}))

function renderPage(search: string, { strict = false }: { strict?: boolean } = {}) {
  // Elemento nuevo en cada llamada: con la misma referencia React se salta el
  // render y no habría nada que probar.
  const buildTree = () => {
    const tree = (
      <MemoryRouter initialEntries={[`/auth/confirm${search}`]}>
        <AuthConfirmPage />
      </MemoryRouter>
    )

    return strict ? <StrictMode>{tree}</StrictMode> : tree
  }

  const view = render(buildTree())

  return {
    ...view,
    /** Re-renderiza la pantalla, como hace el provider al cambiar la sesión. */
    rerenderPage: () => {
      view.rerender(buildTree())
    }
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

describe('confirmación de correo', () => {
  beforeEach(() => {
    completeAuthConfirmation.mockReset()
    completeAuthConfirmation.mockResolvedValue({ session: { user: { id: 'usuario' } } })
    captureClientError.mockReset()
    captureClientError.mockResolvedValue(undefined)
    navigate.mockReset()
    navigate.mockResolvedValue(undefined)
    toastSuccess.mockReset()
    refresh.mockReset()
    refresh.mockResolvedValue(undefined)
    sessionState.isSupabaseConfigured = true
  })

  it('verifica el enlace y lleva al destino', async () => {
    renderPage('?token_hash=hash-del-correo&type=signup&next=/candidate/profile')

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/candidate/profile', { replace: true })
    })

    expect(completeAuthConfirmation).toHaveBeenCalledWith({
      code: null,
      tokenHash: 'hash-del-correo',
      type: 'signup'
    })
    expect(toastSuccess).toHaveBeenCalledWith('Correo confirmado', expect.anything())
  })

  // La regresión: confirmar el correo cambia la sesión y eso re-renderiza esta
  // pantalla mientras la confirmación sigue en vuelo. Antes eso cancelaba el
  // flujo y dejaba el loader puesto para siempre.
  it('no se queda colgada si la sesión cambia mientras confirma', async () => {
    const confirmation = deferred<unknown>()
    completeAuthConfirmation.mockReturnValue(confirmation.promise)

    const { rerenderPage } = renderPage('?code=codigo-pkce')

    expect(screen.getByTestId('page-loader')).toBeInTheDocument()

    // Varios re-renders con sesión nueva antes y después de que la
    // confirmación responda: ninguno puede abortar la navegación.
    act(() => {
      rerenderPage()
      rerenderPage()
    })

    await act(async () => {
      confirmation.resolve({ session: { user: { id: 'usuario' } } })
      await confirmation.promise
    })

    act(() => {
      rerenderPage()
    })

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(surfacePaths.candidate.profile, { replace: true })
    })
  })

  // StrictMode monta, desmonta y vuelve a montar en desarrollo. El enlace es de
  // un solo uso, así que el intercambio no puede repetirse; y el remontaje
  // tampoco puede dejar la pantalla sin salida.
  it('bajo StrictMode confirma una sola vez y aun así navega', async () => {
    renderPage('?code=codigo-pkce', { strict: true })

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(surfacePaths.candidate.profile, { replace: true })
    })

    expect(completeAuthConfirmation).toHaveBeenCalledTimes(1)
  })

  // Hidratar la sesión pasa *después* de gastar el enlace: si falla, mandar a la
  // persona a la pantalla de error la deja confirmada y sin poder reintentar.
  it('navega aunque falle la hidratación de la sesión', async () => {
    refresh.mockRejectedValue(new Error('sin red'))

    renderPage('?code=codigo-pkce')

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(surfacePaths.candidate.profile, { replace: true })
    })

    expect(screen.queryByText(/No pudimos confirmar tu correo/i)).not.toBeInTheDocument()
  })

  it('si el enlace no sirve muestra el error y la vuelta al acceso, no el loader', async () => {
    completeAuthConfirmation.mockRejectedValue(new Error('Email link is invalid or has expired'))

    renderPage('?token_hash=hash-caducado&type=signup')

    expect(await screen.findByText('No pudimos confirmar tu correo')).toBeInTheDocument()
    // El motivo se traduce a algo accionable: el texto de GoTrue («Email link
    // is invalid…») no le dice nada a quien confirma su correo.
    expect(screen.getByText(/Este enlace ya caducó o se usó antes/i)).toBeInTheDocument()
    expect(screen.queryByText(/Email link/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Volver a acceso/i })).toBeInTheDocument()
    expect(screen.queryByTestId('page-loader')).not.toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()

    const report = captureClientError.mock.calls[0][0] as { source: string }
    expect(report.source).toBe('auth.confirm')
  })

  it('usa el loader de la plataforma y no muestra jerga técnica', () => {
    renderPage('?code=codigo-pkce')

    expect(screen.getByTestId('page-loader')).toBeInTheDocument()
    expect(screen.getByText('Confirmando tu correo')).toBeInTheDocument()
    // «Auth callback», «token», «code»: nombres de nuestra plomería, no del
    // idioma de quien confirma su correo.
    expect(screen.queryByText(/auth|callback|token|otp/i)).not.toBeInTheDocument()
  })
})
