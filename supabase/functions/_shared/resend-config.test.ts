import { assertEquals } from 'jsr:@std/assert@1'

import { resolveResendConfig, resolveResendWebhookSecret } from './resend-config.ts'

Deno.test('usa exclusivamente las variables canónicas de Resend', () => {
  const values: Record<string, string> = {
    RESEND_API_KEY: 're_production',
    EMAIL_FROM_ADDRESS: 'ASI Dominicana <notificaciones@asidominicana.do>',
    RESEND_API_KEY_DEV: 're_obsoleta',
    EMAIL_FROM_ADDRESS_DEV: 'Remitente obsoleto <old@example.com>'
  }

  assertEquals(resolveResendConfig((name) => values[name]), {
    apiKey: 're_production',
    fromAddress: 'ASI Dominicana <notificaciones@asidominicana.do>'
  })
})

Deno.test('no acepta los nombres DEV antiguos como fallback', () => {
  const values: Record<string, string> = {
    RESEND_API_KEY_DEV: 're_obsoleta',
    EMAIL_FROM_ADDRESS_DEV: 'Remitente obsoleto <old@example.com>'
  }

  assertEquals(resolveResendConfig((name) => values[name]), {
    apiKey: '',
    fromAddress: ''
  })
})

Deno.test('el webhook usa exclusivamente RESEND_WEBHOOK_SECRET', () => {
  const values: Record<string, string> = {
    RESEND_WEBHOOK_SECRET: 'whsec_production',
    RESEND_WEBHOOK_SECRET_DEV: 'whsec_obsoleto'
  }

  assertEquals(resolveResendWebhookSecret((name) => values[name]), 'whsec_production')
  assertEquals(
    resolveResendWebhookSecret((name) =>
      name === 'RESEND_WEBHOOK_SECRET_DEV' ? values.RESEND_WEBHOOK_SECRET_DEV : undefined
    ),
    ''
  )
})
