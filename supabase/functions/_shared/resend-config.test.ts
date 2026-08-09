import { assertEquals } from 'jsr:@std/assert@1'

import { resolveResendConfig, resolveResendWebhookSecret } from './resend-config.ts'

Deno.test('usa exclusivamente las variables DEV acordadas para Resend', () => {
  const values: Record<string, string> = {
    RESEND_API_KEY_DEV: 're_dev',
    EMAIL_FROM_ADDRESS_DEV: 'ASI Dominicana <notificaciones@asidominicana.do>',
    RESEND_API_KEY: 're_obsoleta',
    EMAIL_FROM_ADDRESS: 'Remitente obsoleto <old@example.com>'
  }

  assertEquals(resolveResendConfig((name) => values[name]), {
    apiKey: 're_dev',
    fromAddress: 'ASI Dominicana <notificaciones@asidominicana.do>'
  })
})

Deno.test('no acepta los nombres canónicos antiguos como fallback', () => {
  const values: Record<string, string> = {
    RESEND_API_KEY: 're_obsoleta',
    EMAIL_FROM_ADDRESS: 'Remitente obsoleto <old@example.com>'
  }

  assertEquals(resolveResendConfig((name) => values[name]), {
    apiKey: '',
    fromAddress: ''
  })
})

Deno.test('el webhook usa exclusivamente RESEND_WEBHOOK_SECRET_DEV', () => {
  const values: Record<string, string> = {
    RESEND_WEBHOOK_SECRET_DEV: 'whsec_dev',
    RESEND_WEBHOOK_SECRET: 'whsec_obsoleto'
  }

  assertEquals(resolveResendWebhookSecret((name) => values[name]), 'whsec_dev')
  assertEquals(
    resolveResendWebhookSecret((name) =>
      name === 'RESEND_WEBHOOK_SECRET' ? values.RESEND_WEBHOOK_SECRET : undefined
    ),
    ''
  )
})
