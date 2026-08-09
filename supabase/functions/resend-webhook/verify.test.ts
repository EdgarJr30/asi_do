import { assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { Webhook } from 'npm:svix@1.99.1'

import { verifyResendWebhook } from './verify.ts'

const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const body = JSON.stringify({
  type: 'email.delivered',
  created_at: new Date().toISOString(),
  data: { email_id: 'email_123' }
})

Deno.test('acepta el cuerpo crudo firmado por Resend/Svix', () => {
  const webhook = new Webhook(secret)
  const id = 'msg_123'
  const timestamp = new Date()
  const signature = webhook.sign(id, timestamp, body)

  const result = verifyResendWebhook(body, {
    id,
    timestamp: String(Math.floor(timestamp.getTime() / 1000)),
    signature,
    secret
  })

  assertEquals((result as { type: string }).type, 'email.delivered')
})

Deno.test('rechaza una firma manipulada', () => {
  assertThrows(() =>
    verifyResendWebhook(body, {
      id: 'msg_123',
      timestamp: String(Math.floor(Date.now() / 1000)),
      signature: 'v1,firma-invalida',
      secret
    })
  )
})
