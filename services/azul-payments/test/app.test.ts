import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'

import { buildApp } from '../src/app.ts'
import type { AppConfig } from '../src/config.ts'

const config: AppConfig = {
  port: 0,
  allowedOrigin: 'https://asi-do.netlify.app',
  servicePublicUrl: 'https://svc.example.com',
  appUrl: 'https://asi-do.netlify.app',
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon',
  supabaseServiceRoleKey: 'service',
  azul: {
    merchantId: '39038540035',
    merchantName: 'ASI Rep. Dominicana',
    merchantType: 'ECommerce',
    authKey: 'test-auth-key-xyz',
    paymentUrl: 'https://pruebas.azul.com.do/PaymentPage/',
    paymentAltUrl: '',
    environment: 'test',
    currencyCode: '$',
    showTransactionResult: false,
    verifyApiUrl: '',
    verifyApiKey: ''
  },
  reconcile: { cron: '*/5 * * * *', staleMinutes: 15, enabled: false }
}

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp(config)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('rutas del servicio', () => {
  it('GET /healthz responde ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', service: 'azul-payments' })
  })

  it('POST /create sin Authorization → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/payments/azul/create',
      payload: { applicationId: '00000000-0000-0000-0000-000000000000' }
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /donations/create sin monto → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/payments/azul/donations/create',
      payload: { donorName: 'Ana Donante', donorEmail: 'ana@example.com' }
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /callback con AuthHash inválido → redirect a payment=error (no toca DB)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/payments/azul/callback?outcome=approved&order=ASI-1&OrderNumber=ASI-1&Amount=15000&ResponseCode=Approved&IsoCode=00&AuthHash=deadbeef'
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('https://asi-do.netlify.app/account/membership?payment=error')
  })

  it('GET /callback de donación con AuthHash inválido → redirect a /donate', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/payments/azul/callback?outcome=approved&order=DON-1&OrderNumber=DON-1&Amount=1000000&ResponseCode=Approved&IsoCode=00&AuthHash=deadbeef'
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('https://asi-do.netlify.app/donate?payment=error')
  })

  it('GET /callback cancelado sin order → redirect a payment=cancelled', async () => {
    const res = await app.inject({ method: 'GET', url: '/payments/azul/callback?outcome=cancelled' })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('https://asi-do.netlify.app/account/membership?payment=cancelled')
  })
})
