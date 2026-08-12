import { describe, expect, it } from 'vitest'

import { buildSaleForm, type BeginPaymentRecord } from '../src/azul/client.ts'
import type { AppConfig } from '../src/config.ts'

const baseConfig: AppConfig = {
  port: 0,
  allowedOrigin: 'https://asidominicana.do',
  allowedOrigins: ['https://asidominicana.do'],
  servicePublicUrl: 'https://svc.example.com',
  appUrl: 'https://asidominicana.do',
  supabaseUrl: 'https://example.supabase.co',
  supabasePublishableKey: 'sb_publishable_test',
  supabaseSecretKey: 'sb_secret_test',
  azul: {
    merchantId: '39038540035',
    merchantName: 'Prueba AZUL',
    merchantType: 'ECommerce',
    authKey: 'test-auth-key-xyz',
    paymentUrl: 'https://pruebas.azul.com.do/PaymentPage/',
    paymentAltUrl: '',
    environment: 'test',
    currencyCode: '$',
    showTransactionResult: true,
    verifyApiUrl: '',
    verifyApiKey: ''
  },
  reconcile: { cron: '*/5 * * * *', staleMinutes: 15, enabled: false }
}

const record: BeginPaymentRecord = {
  payment_id: 'payment-1',
  order_number: 'ASI-1',
  amount: 1500,
  currency: 'DOP',
  category_label: 'Joven Profesional'
}

describe('buildSaleForm', () => {
  it('pide a AZUL mostrar su comprobante antes de retornar a la plataforma', () => {
    const form = buildSaleForm(baseConfig, record)

    expect(form.fields.ShowTransactionResult).toBe('1')
  })

  it('permite desactivar la pantalla de resultado si se requiere retorno inmediato', () => {
    const form = buildSaleForm(
      {
        ...baseConfig,
        azul: { ...baseConfig.azul, showTransactionResult: false }
      },
      record
    )

    expect(form.fields.ShowTransactionResult).toBe('0')
  })
})
