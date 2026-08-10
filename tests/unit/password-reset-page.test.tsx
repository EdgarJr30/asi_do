import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
