import { assertEquals, assertThrows } from 'jsr:@std/assert@1'

import {
  parseResendEmailEvent,
  resolveDeliveryStatus,
  type DeliveryStatus
} from './resend-webhook.ts'

const payload = {
  type: 'email.delivered',
  created_at: '2026-08-09T16:00:00.000Z',
  data: {
    email_id: '6df30b9b-6261-4d65-bc2d-0f560291f860',
    from: 'ASI Dominicana <notificaciones@asidominicana.do>',
    to: ['miembro@example.com'],
    subject: 'Bienvenido'
  }
}

Deno.test('acepta y normaliza un evento de correo soportado', () => {
  assertEquals(parseResendEmailEvent(payload), {
    type: 'email.delivered',
    createdAt: '2026-08-09T16:00:00.000Z',
    providerMessageId: '6df30b9b-6261-4d65-bc2d-0f560291f860',
    payload
  })
})

Deno.test('rechaza eventos sin id de correo o fuera del contrato', () => {
  assertThrows(() => parseResendEmailEvent({ ...payload, type: 'domain.updated' }))
  assertThrows(() => parseResendEmailEvent({ ...payload, data: {} }))
})

Deno.test('los eventos de engagement avanzan sin degradar estados posteriores', () => {
  const cases: Array<[DeliveryStatus, string, DeliveryStatus]> = [
    ['sent', 'email.delivered', 'sent'],
    ['sent', 'email.opened', 'read'],
    ['read', 'email.clicked', 'clicked'],
    ['clicked', 'email.opened', 'clicked'],
    ['read', 'email.delivered', 'read'],
    ['clicked', 'email.sent', 'clicked']
  ]

  for (const [current, eventType, expected] of cases) {
    assertEquals(resolveDeliveryStatus(current, eventType), expected, `${current} + ${eventType}`)
  }
})

Deno.test('fallos definitivos ganan y los retrasos no inventan un estado', () => {
  for (const eventType of ['email.failed', 'email.bounced', 'email.complained', 'email.suppressed']) {
    assertEquals(resolveDeliveryStatus('sent', eventType), 'failed', eventType)
  }

  assertEquals(resolveDeliveryStatus('sent', 'email.delivery_delayed'), 'sent')
  assertEquals(resolveDeliveryStatus('failed', 'email.clicked'), 'failed')
})
