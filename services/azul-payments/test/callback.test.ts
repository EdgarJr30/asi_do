import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'

import { buildApp } from '../src/app.ts'
import { createSettlementDouble, signedCallbackUrl, testConfig, type SettlementDouble } from './helpers.ts'

/**
 * R4.1 — el camino feliz del cobro.
 *
 * Lo que `app.test.ts` ya cubría era lo que el callback **rechaza** (hash inválido,
 * open-redirect). Aquí se cubre lo contrario: que un pago aprobado de verdad llega a
 * escribirse. El modo de fallo que esto vigila es dinero cobrado sin servicio — la
 * membresía no se activa porque la liquidación nunca se invocó, o se invocó sin los
 * campos que el RPC necesita para validar el monto.
 */

let app: FastifyInstance
let db: SettlementDouble

beforeEach(async () => {
  db = createSettlementDouble()
  app = await buildApp(testConfig, { settlementDb: db.db })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('callback aprobado (membresía)', () => {
  it('liquida el pago y redirige a payment=approved', async () => {
    const res = await app.inject({ method: 'GET', url: signedCallbackUrl() })

    expect(db.calls).toHaveLength(1)
    expect(db.calls[0].fn).toBe('azul_settle_membership_payment')
    expect(db.calls[0].params).toMatchObject({
      p_order_number: 'ASI-260809-abc123',
      p_approved: true
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe(
      'https://asidominicana.do/account/membership?payment=approved&order=ASI-260809-abc123'
    )
  })

  it('reenvía Amount e IsoCode al RPC — sin ellos la validación server-side no puede correr', async () => {
    // `p0_azul_settlement_probe` verifica en SQL que una aprobación sin `Amount`
    // se marca `failed`. Esa defensa solo sirve si el servicio manda el campo.
    await app.inject({ method: 'GET', url: signedCallbackUrl() })

    const response = db.calls[0].params.p_response as Record<string, unknown>
    expect(response.Amount).toBe('250000')
    expect(response.IsoCode).toBe('00')
    expect(response.AuthorizationCode).toBe('OK4321')
    expect(response.RRN).toBe('260809000123')
  })

  it('nunca escribe el PAN completo: la tarjeta llega enmascarada', async () => {
    await app.inject({
      method: 'GET',
      url: signedCallbackUrl({}, { extra: { CardNumber: '4035874000424977' } })
    })

    const response = db.calls[0].params.p_response as Record<string, unknown>
    expect(response.CardNumber).toBe('403587****4977')
    expect(JSON.stringify(response)).not.toContain('4035874000424977')
  })

  it('acepta la aprobación por ResponseMessage=APROBADA con ResponseCode ISO8583', async () => {
    // AZUL usa los dos formatos según el canal; tratar uno de ellos como declinado
    // deja el pago cobrado y la membresía sin activar.
    await app.inject({
      method: 'GET',
      url: signedCallbackUrl({ ResponseCode: 'ISO8583', ResponseMessage: 'APROBADA', IsoCode: '00' })
    })

    expect(db.calls[0].params.p_approved).toBe(true)
  })

  it('si la escritura falla, redirige a payment=error y no dice aprobado', async () => {
    db.respond = () => ({ error: { message: 'permission denied for function' } })

    const res = await app.inject({ method: 'GET', url: signedCallbackUrl() })

    expect(db.calls).toHaveLength(1)
    expect(res.headers.location).toBe(
      'https://asidominicana.do/account/membership?payment=error&order=ASI-260809-abc123'
    )
  })
})

describe('callback declinado y cancelado', () => {
  it('una declinación firmada se registra como intento fallido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: signedCallbackUrl({ ResponseCode: 'Declined', IsoCode: '05', ResponseMessage: 'DECLINADA' })
    })

    expect(db.calls[0].params.p_approved).toBe(false)
    expect(res.headers.location).toContain('payment=declined')
  })

  it('la cancelación se liquida como fallida para que el usuario pueda reintentar', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/payments/azul/callback?outcome=cancelled&order=ASI-260809-abc123'
    })

    expect(db.calls).toHaveLength(1)
    expect(db.calls[0].params).toMatchObject({
      p_order_number: 'ASI-260809-abc123',
      p_approved: false,
      p_response: { outcome: 'cancelled' }
    })
    expect(res.headers.location).toContain('payment=cancelled')
  })
})

describe('anti-tamper: qué NO llega a la base', () => {
  it('un Amount cambiado tras la firma no toca la base', async () => {
    const res = await app.inject({
      method: 'GET',
      url: signedCallbackUrl({}, { tamper: { Amount: '1' } })
    })

    expect(db.calls).toEqual([])
    expect(res.headers.location).toContain('payment=error')
  })

  it('una respuesta firmada con otra AuthKey no toca la base', async () => {
    const res = await app.inject({
      method: 'GET',
      url: signedCallbackUrl({}, { authKey: 'llave-del-atacante' })
    })

    expect(db.calls).toEqual([])
    expect(res.headers.location).toContain('payment=error')
  })

  it('una respuesta sin AuthHash no toca la base', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/payments/azul/callback?OrderNumber=ASI-1&Amount=250000&ResponseCode=Approved&IsoCode=00'
    })

    expect(db.calls).toEqual([])
    expect(res.headers.location).toContain('payment=error')
  })
})

describe('callback de donación', () => {
  it('usa el RPC de donaciones y vuelve a /donate', async () => {
    db.respond = () => ({ data: [{ status: 'verified', donor_user_id: null, donation_id: null }] })

    const res = await app.inject({
      method: 'GET',
      url: signedCallbackUrl({ OrderNumber: 'DON-260809-xyz789', Amount: '100000' })
    })

    expect(db.calls[0].fn).toBe('azul_settle_donation_payment')
    expect(db.calls[0].params).toMatchObject({ p_order_number: 'DON-260809-xyz789', p_approved: true })
    expect(res.headers.location).toBe('https://asidominicana.do/donate?payment=approved&order=DON-260809-xyz789')
  })

  it('el flujo se decide por el OrderNumber firmado, no por el de la query', async () => {
    // `?order=` lo controla quien construye la URL; `OrderNumber` va dentro del hash.
    const res = await app.inject({
      method: 'GET',
      url: `${signedCallbackUrl({ OrderNumber: 'DON-260809-xyz789' })}&order=ASI-falsificado`
    })

    expect(db.calls[0].fn).toBe('azul_settle_donation_payment')
    expect(db.calls[0].params.p_order_number).toBe('DON-260809-xyz789')
    expect(res.headers.location).toContain('/donate?')
  })
})

describe('retorno al SPA', () => {
  it('un pago aprobado desde local vuelve a local', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${signedCallbackUrl()}&return=${encodeURIComponent('http://localhost:5173')}`
    })

    expect(res.headers.location).toBe(
      'http://localhost:5173/account/membership?payment=approved&order=ASI-260809-abc123'
    )
  })

  it('un return fuera de la allowlist no redirige fuera aunque el pago sea válido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${signedCallbackUrl()}&return=${encodeURIComponent('https://evil.com')}`
    })

    expect(res.headers.location).toBe(
      'https://asidominicana.do/account/membership?payment=approved&order=ASI-260809-abc123'
    )
  })
})
