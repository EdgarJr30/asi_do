import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForgotPasswordPage } from '@/features/auth/pages/forgot-password-page'

/**
 * Pantalla de solicitud del enlace de recuperación (R7.2).
 *
 * Lo que se vigila aquí no es que el formulario funcione: es que **no conteste
 * la pregunta "¿tiene esta persona cuenta en ASI?"**. Un formulario público que
 * responde distinto según exista o no el correo es un verificador de padrón, y
 * en este producto el padrón son los miembros de una iglesia. La confirmación
 * tiene que ser literalmente la misma en los dos casos, incluido el fallo del
 * proveedor.
 */

const requestPasswordRecovery = vi.hoisted(() => vi.fn())
const reportErrorWithToast = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/lib/auth-api', () => ({
  requestPasswordRecovery,
  toErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error))
}))

vi.mock('@/lib/errors/error-reporting', () => ({ reportErrorWithToast }))

vi.mock('@/app/providers/app-session-provider', () => ({
  useAppSession: () => ({ isSupabaseConfigured: true })
}))

const registeredEmail = 'miembro.registrado@asido.test'
const unknownEmail = 'nadie.por.aqui@asido.test'

/** Frases que delatarían si la cuenta existe. Ninguna puede aparecer jamás. */
const revealingWordings = [
  /no (existe|está registrad|encontramos|hay ninguna cuenta)/i,
  /correo no válido para recuperación/i,
  /esta cuenta (sí|ya) existe/i
]

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>
  )
}

function submitEmail(email: string) {
  fireEvent.change(screen.getByPlaceholderText('john.doe@empresa.com.do'), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: /Enviar enlace/i }))
}

/**
 * Texto de la confirmación con la dirección sustituida por un marcador: es lo
 * único que legítimamente cambia entre un correo y otro, así que redactarlo deja
 * dos cadenas comparables carácter a carácter.
 */
async function confirmationTextFor(email: string) {
  const view = renderPage()
  submitEmail(email)

  const heading = await screen.findByRole('heading', { name: /Revisa tu correo/i })
  const text = (heading.closest('section')?.textContent ?? '').replaceAll(email, '{correo}')

  view.unmount()

  return text
}

describe('solicitud de recuperación de contraseña', () => {
  beforeEach(() => {
    requestPasswordRecovery.mockReset()
    requestPasswordRecovery.mockResolvedValue(undefined)
    reportErrorWithToast.mockReset()
  })

  it('confirma con el mismo texto exista o no la cuenta', async () => {
    const forRegistered = await confirmationTextFor(registeredEmail)
    const forUnknown = await confirmationTextFor(unknownEmail)

    expect(forRegistered).toBe(forUnknown)
    // La confirmación es condicional a propósito ("Si … tiene una cuenta"): es
    // lo que la hace verdadera en los dos casos sin distinguirlos.
    expect(forRegistered).toContain('tiene una cuenta en ASI')

    for (const wording of revealingWordings) {
      expect(forRegistered).not.toMatch(wording)
    }
  })

  it('pide el enlace con el correo escrito, una sola vez', async () => {
    renderPage()
    submitEmail(registeredEmail)

    await screen.findByRole('heading', { name: /Revisa tu correo/i })

    expect(requestPasswordRecovery).toHaveBeenCalledTimes(1)
    expect(requestPasswordRecovery).toHaveBeenCalledWith(registeredEmail)
  })

  // `usuario@dominio` y no `esto-no-es-un-correo`: el segundo lo rechaza la
  // validación nativa del `type="email"` y el submit ni siquiera llega a React,
  // así que probaría el navegador y no nuestro esquema. Un correo sin dominio de
  // primer nivel pasa el filtro nativo y lo para zod, que es la costura a vigilar
  // —la que evita gastar un viaje al proveedor y consumir su límite de envíos.
  it('no gasta un viaje al proveedor si el correo no es válido', async () => {
    renderPage()
    submitEmail('usuario@dominio')

    expect(await screen.findByText('Escribe un correo válido.')).toBeInTheDocument()
    expect(requestPasswordRecovery).not.toHaveBeenCalled()
  })

  it('ante un fallo del proveedor avisa en genérico y no simula haber enviado', async () => {
    requestPasswordRecovery.mockRejectedValue(new Error('rate limit exceeded for email'))

    renderPage()
    submitEmail(registeredEmail)

    await waitFor(() => {
      expect(reportErrorWithToast).toHaveBeenCalled()
    })

    const report = reportErrorWithToast.mock.calls[0][0] as { source: string; userMessage: string }

    expect(report.source).toBe('auth.forgot-password')
    expect(report.userMessage).toBe('No pudimos enviar el enlace de recuperación.')
    for (const wording of revealingWordings) {
      expect(report.userMessage).not.toMatch(wording)
    }

    // Sin confirmación: decir "revisa tu correo" cuando el envío falló deja a
    // quien no puede entrar esperando un correo que nunca va a llegar.
    expect(screen.queryByRole('heading', { name: /Revisa tu correo/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enviar enlace/i })).toBeInTheDocument()
  })

  it('permite reintentar sin recargar la página', async () => {
    renderPage()
    submitEmail(registeredEmail)

    await screen.findByRole('heading', { name: /Revisa tu correo/i })
    fireEvent.click(screen.getByRole('button', { name: /Intenta otra vez/i }))

    expect(screen.getByRole('button', { name: /Enviar enlace/i })).toBeInTheDocument()
  })
})
