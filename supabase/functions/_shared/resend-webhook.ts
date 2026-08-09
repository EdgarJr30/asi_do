export const RESEND_EMAIL_EVENT_TYPES = [
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.failed',
  'email.suppressed',
  'email.bounced',
  'email.complained',
  'email.opened',
  'email.clicked'
] as const

export type ResendEmailEventType = (typeof RESEND_EMAIL_EVENT_TYPES)[number]
export type DeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'read' | 'clicked'

export interface ResendEmailEvent {
  type: ResendEmailEventType
  createdAt: string
  providerMessageId: string
  payload: Record<string, unknown>
}

const eventTypes = new Set<string>(RESEND_EMAIL_EVENT_TYPES)
const failureEvents = new Set<string>([
  'email.failed',
  'email.suppressed',
  'email.bounced',
  'email.complained'
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseResendEmailEvent(value: unknown): ResendEmailEvent {
  if (!isRecord(value) || typeof value.type !== 'string' || !eventTypes.has(value.type)) {
    throw new Error('Unsupported Resend webhook event.')
  }

  if (typeof value.created_at !== 'string' || Number.isNaN(Date.parse(value.created_at))) {
    throw new Error('Resend webhook event has an invalid creation timestamp.')
  }

  const data = value.data
  if (!isRecord(data) || typeof data.email_id !== 'string' || data.email_id.trim().length === 0) {
    throw new Error('Resend webhook event has no email id.')
  }

  return {
    type: value.type as ResendEmailEventType,
    createdAt: value.created_at,
    providerMessageId: data.email_id,
    payload: value
  }
}

export function resolveDeliveryStatus(
  current: DeliveryStatus,
  eventType: string
): DeliveryStatus {
  if (current === 'failed' || failureEvents.has(eventType)) return 'failed'
  if (current === 'clicked' || eventType === 'email.clicked') return 'clicked'
  if (current === 'read' || eventType === 'email.opened') return 'read'
  if (eventType === 'email.sent' || eventType === 'email.delivered') return 'sent'
  return current
}
