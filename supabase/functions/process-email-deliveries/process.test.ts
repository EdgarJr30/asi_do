import { assertEquals } from 'jsr:@std/assert@1'

import { createDatabaseDouble, createResendDouble } from '../_shared/email-test-doubles.ts'
import { processEmailDeliveries, type ClaimedEmailDeliveryRow } from './process.ts'

function buildDelivery(overrides: Partial<ClaimedEmailDeliveryRow> = {}): ClaimedEmailDeliveryRow {
  return {
    delivery_id: '11111111-1111-4111-8111-111111111111',
    claim_token: '22222222-2222-4222-8222-222222222222',
    idempotency_key: 'delivery-11111111-attempt-1',
    attempt_count: 1,
    notification_id: '33333333-3333-4333-8333-333333333333',
    notification_type: 'membership.activated',
    title: 'Tu membresía está activa',
    body: 'Ya puedes entrar a la plataforma.',
    action_url: '/membership',
    payload: null,
    recipient_email: 'miembro@example.com',
    recipient_display_name: 'Miembro Uno',
    recipient_full_name: 'Miembro Uno Completo',
    ...overrides
  }
}

/** Configuración válida: el camino feliz no debe fallar por entorno incompleto. */
const validConfig = {
  resendApiKey: 'test-api-key',
  fromEmail: 'ASI Rep. Dominicana <notificaciones@asidominicana.do>',
  appUrl: 'https://asidominicana.do',
  limit: 20
}

Deno.test('el camino feliz envía un correo al destinatario reclamado y cierra la reserva', async () => {
  const delivery = buildDelivery()
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [delivery] }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  const result = await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  assertEquals(result, { processedCount: 1, sentCount: 1, failedCount: 0 })

  // Qué se habría enviado, y a quién.
  assertEquals(resend.sent.length, 1)
  assertEquals(resend.sent[0].to, ['miembro@example.com'])
  assertEquals(resend.sent[0].from, validConfig.fromEmail)
  assertEquals(resend.sent[0].subject, 'Tu membresía está activa')
  assertEquals(resend.sent[0].authorization, 'Bearer test-api-key')

  // La clave de idempotencia viaja tal cual la emitió la reserva: es lo que
  // impide que un reintento tras un timeout duplique el correo.
  assertEquals(resend.sent[0].idempotencyKey, 'delivery-11111111-attempt-1')

  // El cierre usa el token de la reserva y registra el id del proveedor.
  assertEquals(database.argsFor('complete_email_delivery'), [
    {
      p_delivery_id: delivery.delivery_id,
      p_claim_token: delivery.claim_token,
      p_status: 'sent',
      p_response_code: 202,
      p_provider_message_id: 'resend-message-1',
      p_response_payload: { id: 'resend-message-1' }
    }
  ])

  assertEquals(database.inserts.length, 1)
  assertEquals(database.inserts[0].table, 'notification_delivery_logs')
  assertEquals(database.inserts[0].values.log_level, 'info')
})

Deno.test('el cuerpo del correo lleva el contenido de la notificación y el enlace absoluto', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [buildDelivery()] }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  const email = resend.sent[0]
  assertEquals(email.text.includes('Ya puedes entrar a la plataforma.'), true)
  assertEquals(email.text.includes('Hola Miembro Uno,'), true)
  // `action_url` es relativo en la base; debe salir absoluto o el enlace no
  // funciona fuera de la app.
  assertEquals(email.text.includes('https://asidominicana.do/membership'), true)
  assertEquals(email.html.includes('https://asidominicana.do/membership'), true)
})

Deno.test('sin entregas reclamadas no se toca al proveedor', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [] })
  })
  const resend = createResendDouble()

  const result = await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  assertEquals(result, { processedCount: 0, sentCount: 0, failedCount: 0 })
  assertEquals(resend.sent.length, 0)
  assertEquals(database.rpcCalls.length, 1)
  assertEquals(database.inserts.length, 0)
})

Deno.test('la reserva pide el lote con el lease y el tope de intentos del contrato', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [] })
  })

  await processEmailDeliveries({
    database: database.client,
    fetch: createResendDouble().fetch,
    ...validConfig,
    limit: 7
  })

  assertEquals(database.argsFor('claim_email_deliveries'), [
    { p_limit: 7, p_lease_seconds: 300, p_max_attempts: 5 }
  ])
})
