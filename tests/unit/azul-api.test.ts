import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * R4.3 — el lado cliente del cobro de membresía, que estaba al 0 %.
 *
 * Lo que se vigila aquí no es el "se ve bonito": es que el JWT llegue al servicio
 * (sin él, el RPC con RLS no puede calcular la cuota), que un fallo de red no se
 * confunda con un rechazo de la tarjeta, y que el formulario que se postea a AZUL
 * lleve exactamente los campos firmados —ni uno más— porque cualquier alteración
 * invalida el AuthHash y el pago muere en la pasarela.
 */

const envState = vi.hoisted(() => ({ azulPaymentsUrl: undefined as string | undefined }))
const sessionState = vi.hoisted(() => ({ accessToken: null as string | null }))

vi.mock('@/shared/config/env', () => ({ env: envState }))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: sessionState.accessToken ? { access_token: sessionState.accessToken } : null }
        })
    }
  }
}))

const validForm = {
  orderNumber: 'ASI-260809-abc123',
  amount: 2500,
  currency: 'DOP',
  paymentUrl: 'https://pruebas.azul.com.do/PaymentPage/',
  paymentAltUrl: '',
  fields: { MerchantId: '39038540035', Amount: '250000', AuthHash: 'abc123' }
}

function respondWith(body: unknown, init: { status?: number } = {}) {
  const fetchDouble = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
  )
  vi.stubGlobal('fetch', fetchDouble)
  return fetchDouble
}

/** Lo que se envió al servicio, ya parseado. Falla si el cuerpo no es JSON serializado. */
function sentBody(init: RequestInit): Record<string, unknown> {
  if (typeof init.body !== 'string') {
    throw new Error('El cuerpo de la petición debería ser JSON serializado')
  }
  return JSON.parse(init.body) as Record<string, unknown>
}

beforeEach(() => {
  envState.azulPaymentsUrl = 'https://pagos.asidominicana.do/'
  sessionState.accessToken = 'jwt-de-la-sesion'
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('startAzulMembershipPayment', () => {
  it('manda el JWT de la sesión y los valores por defecto del pago', async () => {
    const fetchDouble = respondWith(validForm)
    const { startAzulMembershipPayment } = await import('@/features/membership/lib/azul-api')

    const form = await startAzulMembershipPayment({ applicationId: 'app-1' })

    const [url, init] = fetchDouble.mock.calls[0] as unknown as [string, RequestInit]
    // La barra final de la variable de entorno no debe duplicarse en la ruta.
    expect(url).toBe('https://pagos.asidominicana.do/payments/azul/create')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-de-la-sesion')
    expect(sentBody(init)).toEqual({
      applicationId: 'app-1',
      intent: 'initial',
      years: 1
    })
    expect(form.orderNumber).toBe('ASI-260809-abc123')
  })

  it('respeta una renovación de varios años', async () => {
    const fetchDouble = respondWith(validForm)
    const { startAzulMembershipPayment } = await import('@/features/membership/lib/azul-api')

    await startAzulMembershipPayment({ applicationId: 'app-1', intent: 'renewal', years: 3 })

    const [, init] = fetchDouble.mock.calls[0] as unknown as [string, RequestInit]
    expect(sentBody(init)).toMatchObject({ intent: 'renewal', years: 3 })
  })

  it('sin sesión no llama a la pasarela y pide volver a entrar', async () => {
    sessionState.accessToken = null
    const fetchDouble = respondWith(validForm)
    const { startAzulMembershipPayment } = await import('@/features/membership/lib/azul-api')

    await expect(startAzulMembershipPayment({ applicationId: 'app-1' })).rejects.toThrow(/sesión expiró/i)
    expect(fetchDouble).not.toHaveBeenCalled()
  })

  it('sin VITE_AZUL_PAYMENTS_URL falla diciendo qué falta, en vez de pedir a una URL vacía', async () => {
    envState.azulPaymentsUrl = undefined
    const fetchDouble = respondWith(validForm)
    const { startAzulMembershipPayment } = await import('@/features/membership/lib/azul-api')

    await expect(startAzulMembershipPayment({ applicationId: 'app-1' })).rejects.toThrow(
      /VITE_AZUL_PAYMENTS_URL/
    )
    expect(fetchDouble).not.toHaveBeenCalled()
  })
})

describe('errores: la red no es lo mismo que un rechazo', () => {
  it('un fallo de conexión se explica como conexión, no como pago rechazado', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    const { startAzulMembershipPayment } = await import('@/features/membership/lib/azul-api')

    await expect(startAzulMembershipPayment({ applicationId: 'app-1' })).rejects.toThrow(
      /No pudimos conectar con la pasarela/i
    )
  })

  it('un 422 del servicio propaga el motivo de negocio', async () => {
    respondWith({ error: 'La solicitud ya tiene un pago verificado.' }, { status: 422 })
    const { startAzulMembershipPayment } = await import('@/features/membership/lib/azul-api')

    await expect(startAzulMembershipPayment({ applicationId: 'app-1' })).rejects.toThrow(
      'La solicitud ya tiene un pago verificado.'
    )
  })

  it('un error sin cuerpo útil cae en un mensaje accionable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('<html>502</html>', { status: 502 }))))
    const { startAzulMembershipPayment } = await import('@/features/membership/lib/azul-api')

    await expect(startAzulMembershipPayment({ applicationId: 'app-1' })).rejects.toThrow(
      /No pudimos iniciar el pago/i
    )
  })

  it('un 200 sin formulario firmado se rechaza en vez de postear a AZUL algo incompleto', async () => {
    respondWith({ orderNumber: 'ASI-1', amount: 2500 })
    const { startAzulMembershipPayment } = await import('@/features/membership/lib/azul-api')

    await expect(startAzulMembershipPayment({ applicationId: 'app-1' })).rejects.toThrow(
      /Respuesta inválida de la pasarela/i
    )
  })
})

describe('submitAzulForm', () => {
  it('postea a la URL de AZUL exactamente los campos firmados', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)
    const { submitAzulForm } = await import('@/features/membership/lib/azul-api')

    submitAzulForm({ paymentUrl: validForm.paymentUrl, fields: validForm.fields })

    const form = document.querySelector('form')
    expect(form).not.toBeNull()
    expect(form!.method).toBe('post')
    expect(form!.action).toBe(validForm.paymentUrl)

    const posted = Object.fromEntries(
      Array.from(form!.querySelectorAll('input')).map((input) => [input.name, input.value])
    )
    // Ni un campo de más: cualquier añadido invalida el AuthHash calculado en el servicio.
    expect(posted).toEqual(validForm.fields)
    expect(Array.from(form!.querySelectorAll('input')).every((i) => i.type === 'hidden')).toBe(true)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('payMembershipWithAzul encadena iniciar y redirigir', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)
    respondWith(validForm)
    const { payMembershipWithAzul } = await import('@/features/membership/lib/azul-api')

    await payMembershipWithAzul({ applicationId: 'app-1' })

    expect(submit).toHaveBeenCalledTimes(1)
    const posted = Array.from(document.querySelectorAll('form input')).map((i) => (i as HTMLInputElement).name)
    expect(posted).toContain('AuthHash')
    // El JWT es para nuestro servicio; no puede viajar en el formulario a AZUL.
    expect(document.body.innerHTML).not.toContain('jwt-de-la-sesion')
  })
})
