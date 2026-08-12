import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmailBroadcastPanel } from '@/features/internal/components/email-broadcast-panel'

/**
 * Guardas del envío masivo (TASK-255, J3).
 *
 * Lo que se prueba no es que la pantalla pinte, sino las dos cosas que impiden
 * un desastre irreversible: que no se pueda enviar sin haber probado el
 * contenido, y que editarlo después obligue a probarlo otra vez. Un correo
 * transaccional con una errata se corrige en el siguiente; una campaña ya la
 * leyeron cuatro mil personas y no hay deshacer.
 */

const previewBroadcast = vi.hoisted(() => vi.fn())
const sendBroadcast = vi.hoisted(() => vi.fn())
const fetchBroadcasts = vi.hoisted(() => vi.fn())
const triggerEmailDispatch = vi.hoisted(() => vi.fn())

vi.mock('@/features/internal/lib/email-broadcast-api', async (importOriginal) => ({
  // El parser y la firma son puros y tienen su propio test: se usan de verdad
  // para que este test falle si dejan de casar con lo que la pantalla espera.
  ...(await importOriginal<typeof import('@/features/internal/lib/email-broadcast-api')>()),
  previewBroadcast,
  sendBroadcast,
  fetchBroadcasts
}))

vi.mock('@/features/internal/lib/email-pipeline-api', () => ({ triggerEmailDispatch }))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <EmailBroadcastPanel defaultTestRecipient="admin@asidominicana.do" />
    </QueryClientProvider>
  )
}

/** Abre el panel y deja un borrador completo con dos destinatarios. */
async function fillDraft() {
  fireEvent.click(screen.getByText('Envío masivo'))

  fireEvent.change(screen.getByPlaceholderText('Convocatoria asamblea 2026'), {
    target: { value: 'Convocatoria 2026' }
  })
  fireEvent.change(screen.getByPlaceholderText('Lo que ve el destinatario'), {
    target: { value: 'Te esperamos' }
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Mensaje' }), {
    target: { value: 'Hola a todos' }
  })
  fireEvent.change(screen.getByPlaceholderText(/Pega las direcciones/), {
    target: { value: 'uno@ejemplo.do\ndos@ejemplo.do' }
  })

  await waitFor(() => expect(previewBroadcast).toHaveBeenCalled())
}

const sendButton = () => screen.getByRole('button', { name: /Enviar a \d+ destinatarios/ })

beforeEach(() => {
  vi.clearAllMocks()
  previewBroadcast.mockResolvedValue({
    requested: 2,
    invalid: 0,
    duplicated: 0,
    suppressed: 0,
    deliverable: 2
  })
  sendBroadcast.mockResolvedValue({
    broadcastId: 'b-1',
    requested: 2,
    queued: 2,
    invalid: 0,
    duplicated: 0,
    suppressed: 0
  })
  fetchBroadcasts.mockResolvedValue([])
  triggerEmailDispatch.mockResolvedValue(undefined)
})

describe('EmailBroadcastPanel', () => {
  it('no deja enviar hasta que el contenido pasó por una prueba', async () => {
    renderPanel()
    await fillDraft()

    await waitFor(() => expect(sendButton()).toBeDisabled())
    expect(screen.getByText(/Envía primero una prueba/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Enviar prueba/ }))

    await waitFor(() => expect(sendButton()).toBeEnabled())
    // La prueba es `is_test` y va a las direcciones propias, no a la lista.
    expect(sendBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ isTest: true, emails: ['admin@asidominicana.do'] })
    )
  })

  it('vuelve a exigir la prueba si se edita el mensaje después', async () => {
    renderPanel()
    await fillDraft()

    fireEvent.click(screen.getByRole('button', { name: /Enviar prueba/ }))
    await waitFor(() => expect(sendButton()).toBeEnabled())

    // Lo probado tiene que ser lo que se envía: cambiar el cuerpo invalida la
    // prueba anterior, porque lo que se revisó ya no es lo que saldría.
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensaje' }), {
      target: { value: 'Hola a todas' }
    })

    await waitFor(() => expect(sendButton()).toBeDisabled())
  })

  it('el envío real usa la lista completa y no es de prueba', async () => {
    renderPanel()
    await fillDraft()

    fireEvent.click(screen.getByRole('button', { name: /Enviar prueba/ }))
    await waitFor(() => expect(sendButton()).toBeEnabled())

    fireEvent.click(sendButton())
    // Un envío masivo no se puede deshacer: media una confirmación explícita.
    fireEvent.click(screen.getByRole('button', { name: 'Enviar campaña' }))

    await waitFor(() =>
      expect(sendBroadcast).toHaveBeenLastCalledWith(
        expect.objectContaining({ isTest: false, emails: ['uno@ejemplo.do', 'dos@ejemplo.do'] })
      )
    )
    expect(triggerEmailDispatch).toHaveBeenCalled()
  })

  it('no deja enviar cuando la lista no tiene a nadie enviable', async () => {
    previewBroadcast.mockResolvedValue({
      requested: 2,
      invalid: 1,
      duplicated: 0,
      suppressed: 1,
      deliverable: 0
    })

    renderPanel()
    await fillDraft()

    fireEvent.click(screen.getByRole('button', { name: /Enviar prueba/ }))
    await waitFor(() => expect(screen.getByText(/no tiene destinatarios enviables/)).toBeInTheDocument())
    expect(sendButton()).toBeDisabled()
  })
})
