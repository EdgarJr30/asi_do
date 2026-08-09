import { Webhook } from 'npm:svix@1.99.1'

export function verifyResendWebhook(
  payload: string,
  input: {
    id: string
    timestamp: string
    signature: string
    secret: string
  }
): unknown {
  if (!input.id || !input.timestamp || !input.signature || !input.secret) {
    throw new Error('Incomplete Resend webhook signature.')
  }

  return new Webhook(input.secret).verify(payload, {
    'svix-id': input.id,
    'svix-timestamp': input.timestamp,
    'svix-signature': input.signature
  })
}
