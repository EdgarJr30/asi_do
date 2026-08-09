import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * R4.3 — el lado cliente de las donaciones, que estaba al 0 %.
 *
 * La donación se diferencia del pago de membresía en que **no exige sesión**: cualquiera
 * puede donar. Eso hace que el error caro sea el contrario al de membresía —mandar la
 * petición sin cabecera cuando sí hay sesión (la donación queda huérfana de donante) o
 * mandar basura donde el servicio espera campos ausentes.
 */

const envState = vi.hoisted(() => ({ azulPaymentsUrl: undefined as string | undefined }))
const sessionState = vi.hoisted(() => ({ accessToken: null as string | null }))
const rpcState = vi.hoisted(() => ({
  calls: [] as Array<{ fn: string; args: unknown }>,
  data: null as unknown,
  error: null as { message: string } | null
}))

vi.mock('@/shared/config/env', () => ({ env: envState }))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: sessionState.accessToken ? { access_token: sessionState.accessToken } : null }
        })
    },
    rpc: (fn: string, args: unknown) => {
      rpcState.calls.push({ fn, args })
      return Promise.resolve({ data: rpcState.data, error: rpcState.error })
    }
  }
}))

const validForm = {
  orderNumber: 'DON-260809-xyz789',
  amount: 1000,
  currency: 'DOP',
  paymentUrl: 'https://pruebas.azul.com.do/PaymentPage/',
  paymentAltUrl: '',
  fields: { MerchantId: '39038540035', Amount: '100000', AuthHash: 'abc123' }
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
function sentBody(calls: Array<unknown>): Record<string, unknown> {
  const [, init] = calls[0] as [string, RequestInit]
  if (typeof init.body !== 'string') {
    throw new Error('El cuerpo de la petición debería ser JSON serializado')
  }
  return JSON.parse(init.body) as Record<string, unknown>
}

beforeEach(() => {
  envState.azulPaymentsUrl = 'https://pagos.asidominicana.do'
  sessionState.accessToken = null
  rpcState.calls = []
  rpcState.data = null
  rpcState.error = null
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('startAzulDonation', () => {
  it('un visitante anónimo puede donar: la petición sale sin Authorization', async () => {
    const fetchDouble = respondWith(validForm)
    const { startAzulDonation } = await import('@/features/donations/lib/donation-api')

    await startAzulDonation({ customAmount: 1000, donorName: 'Ana Donante' })

    const [url, init] = fetchDouble.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://pagos.asidominicana.do/payments/azul/donations/create')
    expect(init.headers).not.toHaveProperty('Authorization')
  })

  it('si hay sesión, la donación se atribuye: viaja el JWT', async () => {
    sessionState.accessToken = 'jwt-del-donante'
    const fetchDouble = respondWith(validForm)
    const { startAzulDonation } = await import('@/features/donations/lib/donation-api')

    await startAzulDonation({ customAmount: 1000 })

    const [, init] = fetchDouble.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-del-donante')
  })

  it('sin campaña explícita la donación va a "general", nunca sin campaña', async () => {
    const fetchDouble = respondWith(validForm)
    const { startAzulDonation } = await import('@/features/donations/lib/donation-api')

    await startAzulDonation({ amountOptionId: 'monto-1' })

    expect(sentBody(fetchDouble.mock.calls)).toEqual({
      amountOptionId: 'monto-1',
      campaignSlug: 'general'
    })
  })

  it('los campos vacíos se omiten en vez de mandarse como null', async () => {
    const fetchDouble = respondWith(validForm)
    const { startAzulDonation } = await import('@/features/donations/lib/donation-api')

    await startAzulDonation({
      customAmount: 1500,
      donorName: '',
      donorEmail: null,
      donorPhone: undefined,
      designation: null
    })

    expect(sentBody(fetchDouble.mock.calls)).toEqual({ customAmount: 1500, campaignSlug: 'general' })
  })

  it('sin VITE_AZUL_PAYMENTS_URL falla diciendo qué falta', async () => {
    envState.azulPaymentsUrl = undefined
    const fetchDouble = respondWith(validForm)
    const { startAzulDonation } = await import('@/features/donations/lib/donation-api')

    await expect(startAzulDonation({ customAmount: 1000 })).rejects.toThrow(/VITE_AZUL_PAYMENTS_URL/)
    expect(fetchDouble).not.toHaveBeenCalled()
  })

  it('un rechazo del servicio propaga su motivo', async () => {
    respondWith({ error: 'Monto de donación inválido.' }, { status: 400 })
    const { startAzulDonation } = await import('@/features/donations/lib/donation-api')

    await expect(startAzulDonation({ customAmount: -5 })).rejects.toThrow('Monto de donación inválido.')
  })

  it('un 200 sin formulario firmado no se postea a AZUL', async () => {
    respondWith({ orderNumber: 'DON-1' })
    const { startAzulDonation } = await import('@/features/donations/lib/donation-api')

    await expect(startAzulDonation({ customAmount: 1000 })).rejects.toThrow(/Respuesta inválida/i)
  })
})

describe('submitDonationAzulForm', () => {
  it('postea a AZUL exactamente los campos firmados', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)
    const { submitDonationAzulForm } = await import('@/features/donations/lib/donation-api')

    submitDonationAzulForm({ paymentUrl: validForm.paymentUrl, fields: validForm.fields })

    const form = document.querySelector('form')!
    expect(form.action).toBe(validForm.paymentUrl)
    expect(
      Object.fromEntries(Array.from(form.querySelectorAll('input')).map((i) => [i.name, i.value]))
    ).toEqual(validForm.fields)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('payDonationWithAzul encadena iniciar y redirigir', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)
    respondWith(validForm)
    const { payDonationWithAzul } = await import('@/features/donations/lib/donation-api')

    await payDonationWithAzul({ customAmount: 1000 })

    expect(submit).toHaveBeenCalledTimes(1)
  })
})

describe('listDonationAmountOptions', () => {
  it('devuelve los montos activos que da la RPC', async () => {
    rpcState.data = [{ id: 'monto-1', label: 'RD$1,000', amount: 1000, currency: 'DOP', display_order: 1 }]
    const { listDonationAmountOptions } = await import('@/features/donations/lib/donation-api')

    const options = await listDonationAmountOptions()

    expect(rpcState.calls[0].fn).toBe('list_active_donation_amount_options')
    expect(options).toHaveLength(1)
    expect(options[0].amount).toBe(1000)
  })

  it('sin filas devuelve lista vacía, no null', async () => {
    const { listDonationAmountOptions } = await import('@/features/donations/lib/donation-api')

    await expect(listDonationAmountOptions()).resolves.toEqual([])
  })

  it('un error de la RPC sube con su mensaje', async () => {
    rpcState.error = { message: 'permission denied for function' }
    const { listDonationAmountOptions } = await import('@/features/donations/lib/donation-api')

    await expect(listDonationAmountOptions()).rejects.toThrow('permission denied for function')
  })
})

describe('getDonationReceipt', () => {
  it('traduce la fila de la RPC al comprobante que muestra la SPA', async () => {
    rpcState.data = [
      {
        order_number: 'DON-260809-xyz789',
        amount: '1000.00',
        currency: 'DOP',
        status: 'verified',
        donor_name: 'Ana Donante',
        campaign_slug: 'general',
        designation: null,
        authorization_code: 'OK9999',
        azul_rrn: '260809000123',
        azul_date_time: '20260809181500',
        settled_at: '2026-08-09T18:15:30.000Z',
        created_at: '2026-08-09T18:10:00.000Z'
      }
    ]
    const { getDonationReceipt } = await import('@/features/donations/lib/donation-api')

    const receipt = await getDonationReceipt('DON-260809-xyz789')

    expect(rpcState.calls[0]).toEqual({
      fn: 'get_donation_receipt',
      args: { p_order_number: 'DON-260809-xyz789' }
    })
    expect(receipt).toMatchObject({
      orderNumber: 'DON-260809-xyz789',
      // El monto llega como texto desde `numeric`; el comprobante debe mostrarlo como número.
      amount: 1000,
      status: 'verified',
      authorizationCode: 'OK9999',
      azulRrn: '260809000123'
    })
  })

  it('una orden inexistente devuelve null en vez de reventar el comprobante', async () => {
    rpcState.data = []
    const { getDonationReceipt } = await import('@/features/donations/lib/donation-api')

    await expect(getDonationReceipt('DON-no-existe')).resolves.toBeNull()
  })

  it('un error de la RPC sube tal cual', async () => {
    rpcState.error = { message: 'statement timeout' }
    const { getDonationReceipt } = await import('@/features/donations/lib/donation-api')

    await expect(getDonationReceipt('DON-1')).rejects.toThrow('statement timeout')
  })
})
