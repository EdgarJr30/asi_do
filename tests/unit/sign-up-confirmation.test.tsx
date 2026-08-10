import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SignUpPage } from '@/features/auth/pages/sign-up-page'

const signUpWithPassword = vi.hoisted(() => vi.fn())
const resendSignUpConfirmation = vi.hoisted(() => vi.fn())
const reportErrorWithToast = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/lib/auth-api', () => ({
  signUpWithPassword,
  resendSignUpConfirmation,
  toErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error))
}))

vi.mock('@/lib/errors/error-reporting', () => ({ reportErrorWithToast }))

vi.mock('@/app/providers/app-session-provider', () => ({
  useAppSession: () => ({
    isSupabaseConfigured: true,
    isLoading: false,
    isAuthenticated: false,
    permissions: [],
    authUser: null,
    refresh: vi.fn()
  })
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/auth/sign-up?next=/account/profile']}>
      <SignUpPage />
    </MemoryRouter>
  )
}

function submitValidRegistration() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Luigi' } })
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Valentino' } })
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'luigi@example.com' } })
  fireEvent.change(screen.getByPlaceholderText('Tu contraseña'), { target: { value: 'Clave123' } })
  fireEvent.change(screen.getByPlaceholderText('Repite tu contraseña'), { target: { value: 'Clave123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}

describe('confirmación del registro por correo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    signUpWithPassword.mockReset()
    signUpWithPassword.mockResolvedValue({ session: null })
    resendSignUpConfirmation.mockReset()
    resendSignUpConfirmation.mockResolvedValue(undefined)
    reportErrorWithToast.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reemplaza el formulario y habilita el reenvío solo después de 60 segundos', async () => {
    renderPage()
    submitValidRegistration()

    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument()
    expect(screen.getByText('luigi@example.com')).toBeInTheDocument()

    const resendButton = screen.getByRole('button', { name: 'Reenviar en 60 s' })
    expect(resendButton).toBeDisabled()

    for (let second = 0; second < 60; second += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })
    }

    const enabledResendButton = screen.getByRole('button', { name: 'Reenviar correo' })
    expect(enabledResendButton).toBeEnabled()
    fireEvent.click(enabledResendButton)

    expect(resendSignUpConfirmation).toHaveBeenCalledWith({
      email: 'luigi@example.com',
      nextPath: '/account/profile'
    })
  })
})
