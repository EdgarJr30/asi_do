import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PASSWORD_RESET_WINDOW_SECONDS } from '@/features/auth/lib/password-reset-window'
import { ResetPasswordPage } from '@/features/auth/pages/reset-password-page'

/**
 * Pantalla de contraseña nueva (R7.1 / R7.2).
 *
 * Los tres estados de esta pantalla se deciden por la sesión, no por la URL: el
 * enlace del correo trae la sesión de recuperación en el fragmento y el SDK la
 * consume al arrancar. De ahí que la distinción que más importa sea entre
 * *«todavía hidratando»* y *«sin sesión»*: confundirlas le dice «este enlace ya
 * no sirve» a alguien cuyo enlace sí sirve, y esa persona no tiene otra vía para
 * entrar ni para reportarlo.
 */

const updateAccountPassword = vi.hoisted(() => vi.fn())
const signOutCurrentUser = vi.hoisted(() => vi.fn())
const reportErrorWithToast = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/lib/auth-api', () => ({
  updateAccountPassword,
  signOutCurrentUser,
  toErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error))
}))

vi.mock('@/lib/errors/error-reporting', () => ({ reportErrorWithToast }))

vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate
}))

const sessionState = vi.hoisted(() => ({
  value: {
    isSupabaseConfigured: true,
    isLoading: false,
    isAuthenticated: true,
    authUser: { id: 'usuario-en-recuperacion' },
    // El plazo de la pantalla se lee del `iat` de este token; sin él se cuenta
    // desde el montaje, que es lo que ve la mayoría de estas pruebas.
    session: null as { access_token: string } | null,
    refresh: vi.fn()
  }
}))

vi.mock('@/app/providers/app-session-provider', () => ({
  useAppSession: () => sessionState.value
}))

const validPassword = 'ClaveNueva2026'

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>
  )
}

function fillAndSubmit(password: string, confirmation = password) {
  fireEvent.change(screen.getByPlaceholderText('Tu contraseña nueva'), { target: { value: password } })
  fireEvent.change(screen.getByPlaceholderText('Repite tu contraseña nueva'), { target: { value: confirmation } })
  fireEvent.click(screen.getByRole('button', { name: /Guardar contraseña/i }))
}

describe('pantalla de contraseña nueva', () => {
  beforeEach(() => {
    updateAccountPassword.mockReset()
    updateAccountPassword.mockResolvedValue({ user: { id: 'usuario-en-recuperacion' } })
    signOutCurrentUser.mockReset()
    signOutCurrentUser.mockResolvedValue(undefined)
    reportErrorWithToast.mockReset()
    navigate.mockReset()
    toastSuccess.mockReset()
    sessionState.value = {
      isSupabaseConfigured: true,
      isLoading: false,
      isAuthenticated: true,
      authUser: { id: 'usuario-en-recuperacion' },
      session: null,
      refresh: vi.fn()
    }
  })

  it('espera a que la sesión hidrate antes de juzgar el enlace', () => {
    sessionState.value = { ...sessionState.value, isLoading: true, isAuthenticated: false }

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Validando tu enlace')).toBeInTheDocument()
    // El falso negativo que arruina el flujo: declarar muerto un enlace vivo
    // mientras el SDK todavía está consumiendo el fragmento de la URL.
    expect(screen.queryByText(/Este enlace ya no sirve/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Tu contraseña nueva')).not.toBeInTheDocument()
  })

  // Caducado, ya usado o tecleado a mano son el mismo estado observable desde el
  // cliente: sin sesión. Ninguno se arregla mostrando el formulario, porque
  // `updateUser` fallaría después de que la persona escriba la contraseña dos veces.
  it('sin sesión ofrece pedir otro enlace en vez del formulario', () => {
    sessionState.value = { ...sessionState.value, isLoading: false, isAuthenticated: false }

    renderPage()

    expect(screen.getByText(/Este enlace ya no sirve/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Tu contraseña nueva')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pedir un enlace nuevo/i })).toBeInTheDocument()
  })

  it('lleva a pedir un enlace nuevo, no al acceso', () => {
    sessionState.value = { ...sessionState.value, isLoading: false, isAuthenticated: false }

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Pedir un enlace nuevo/i }))

    expect(navigate).toHaveBeenCalledWith('/auth/forgot-password')
  })

  it('guarda la contraseña, cierra la sesión de recuperación y manda a estrenarla', async () => {
    renderPage()
    fillAndSubmit(validPassword)

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/auth/sign-in', { replace: true })
    })

    expect(updateAccountPassword).toHaveBeenCalledWith(validPassword)

    // El orden es la garantía: cerrar antes de guardar tiraría la credencial que
    // autoriza el cambio. La sesión de recuperación llegó por correo y es de un
    // solo uso, así que no puede sobrevivir al cambio.
    expect(signOutCurrentUser.mock.invocationCallOrder[0]).toBeGreaterThan(
      updateAccountPassword.mock.invocationCallOrder[0]
    )
    expect(toastSuccess).toHaveBeenCalledWith('Contraseña actualizada', expect.anything())
  })

  it('no guarda si la confirmación no coincide', async () => {
    renderPage()
    fillAndSubmit(validPassword, 'OtraClave2026')

    expect(await screen.findByText('Las contraseñas deben coincidir.')).toBeInTheDocument()
    expect(updateAccountPassword).not.toHaveBeenCalled()
  })

  // La política vive replicada en `auth-schemas.ts` para adelantar el rechazo de
  // GoTrue. Si el cliente afloja, la persona ve un error genérico del servidor
  // sin saber qué le falta a su contraseña.
  it('no guarda una contraseña que incumple la política', async () => {
    renderPage()
    fillAndSubmit('minusculas')

    expect(await screen.findByText('Incluye al menos una letra mayúscula.')).toBeInTheDocument()
    expect(updateAccountPassword).not.toHaveBeenCalled()
  })

  it('si el guardado falla conserva la sesión para reintentar', async () => {
    updateAccountPassword.mockRejectedValue(new Error('New password should be different from the old password.'))

    renderPage()
    fillAndSubmit(validPassword)

    await waitFor(() => {
      expect(reportErrorWithToast).toHaveBeenCalled()
    })

    const report = reportErrorWithToast.mock.calls[0][0] as { source: string; userMessage: string }

    expect(report.source).toBe('auth.reset-password')
    expect(report.userMessage).toBe('No pudimos actualizar tu contraseña.')
    // Cerrar la sesión aquí dejaría a la persona sin enlace y sin contraseña: el
    // único camino de vuelta sería pedir otro correo.
    expect(signOutCurrentUser).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})

/**
 * Contador del plazo (R7.3).
 *
 * El enlace dura 15 minutos, pero abrirlo crea una sesión que dura una hora y se
 * refresca sola. Sin este tope en la pantalla, acortar el enlace no acortaría
 * nada para quien deja la pestaña abierta, y el contador estaría mintiendo.
 */
describe('plazo visible de la recuperación', () => {
  const issuedAtMs = Date.UTC(2026, 7, 9, 12, 0, 0)

  function tokenIssuedAt(seconds: number) {
    const payload = Buffer.from(JSON.stringify({ iat: seconds })).toString('base64url')

    return `cabecera.${payload}.firma`
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(issuedAtMs)
    signOutCurrentUser.mockReset()
    signOutCurrentUser.mockResolvedValue(undefined)
    sessionState.value = {
      isSupabaseConfigured: true,
      isLoading: false,
      isAuthenticated: true,
      authUser: { id: 'usuario-en-recuperacion' },
      session: { access_token: tokenIssuedAt(issuedAtMs / 1000) },
      refresh: vi.fn()
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dice cuánto queda y lo va descontando', () => {
    renderPage()

    expect(screen.getByRole('timer')).toHaveTextContent('15:00')

    act(() => {
      vi.advanceTimersByTime(90_000)
    })

    expect(screen.getByRole('timer')).toHaveTextContent('13:30')
  })

  it('el plazo se mide desde el token, así que recargar no regala tiempo', () => {
    // Alguien que abre el enlace, se distrae diez minutos y recarga la pestaña.
    vi.setSystemTime(issuedAtMs + 10 * 60 * 1000)

    renderPage()

    expect(screen.getByRole('timer')).toHaveTextContent('5:00')
  })

  it('al agotarse cierra la sesión de recuperación y ofrece pedir otro enlace', async () => {
    renderPage()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PASSWORD_RESET_WINDOW_SECONDS * 1000 + 1_000)
    })

    // Dejar viva la credencial que llegó por correo convertiría el contador en
    // decoración: bastaría recargar para seguir cambiando la contraseña.
    expect(signOutCurrentUser).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Este enlace ya no sirve/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Tu contraseña nueva')).not.toBeInTheDocument()
  })
})
