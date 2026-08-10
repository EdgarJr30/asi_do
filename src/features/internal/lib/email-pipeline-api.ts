import { supabase } from '@/lib/supabase/client'

// Estados de entrega que modela asi_do (constraint de notification_deliveries).
export type EmailDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'read' | 'clicked'
export type EmailStatusFilter = EmailDeliveryStatus | 'all' | 'problem'

/**
 * Eventos del proveedor que se pueden filtrar (TASK-255, F4).
 *
 * Solo estos cuatro, y no los nueve que el visor sabe etiquetar, porque el
 * filtro opera sobre `latest_provider_event` y **eso limita lo que se puede
 * afirmar sin mentir**: un rebote, una queja y una supresión son terminales, así
 * que "el último evento fue X" equivale a "le pasó X". Un `opened` seguido de un
 * `clicked` deja de ser el último, de modo que filtrar aperturas por aquí
 * perdería justo las que más interesan — y para eso ya existen los estados
 * agregados `read` y `clicked`, que el pipeline mantiene aparte.
 *
 * `delivery_delayed` se ofrece como *retraso vigente* por la misma razón: si el
 * correo terminó entregándose, deja de aparecer, que es la lectura útil.
 */
export type EmailProviderEventFilter =
  | 'email.bounced'
  | 'email.complained'
  | 'email.suppressed'
  | 'email.delivery_delayed'
export type SimulateScenario = 'send' | 'fail' | 'hang'

export interface EmailDeliveryEventRow {
  id: string
  provider_event_id: string
  event_type: string
  event_created_at: string
  payload: Record<string, unknown>
}

const PROBLEM_STATUSES: EmailDeliveryStatus[] = ['failed']
const DELIVERED_STATUSES: EmailDeliveryStatus[] = ['sent', 'read', 'clicked']

export interface EmailDeliveryRow {
  id: string
  notification_id: string
  delivery_status: EmailDeliveryStatus
  provider_name: string
  provider_message_id: string | null
  latest_provider_event: string | null
  latest_provider_event_at: string | null
  response_code: number | null
  response_payload: Record<string, unknown> | null
  attempt_count: number
  last_attempt_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
  is_test: boolean
  events: EmailDeliveryEventRow[] | null
  notification: {
    type: string
    title: string
    body: string
    action_url: string | null
    payload: Record<string, unknown> | null
    recipient_user: {
      email: string | null
      display_name: string | null
      full_name: string | null
    } | null
  } | null
}

export interface EmailDeliveryStats {
  total: number
  delivered: number
  problem: number
}

export interface PageResult<T> {
  rows: T[]
  total: number
}

const SELECT = `
  id,
  notification_id,
  delivery_status,
  provider_name,
  provider_message_id,
  latest_provider_event,
  latest_provider_event_at,
  response_code,
  response_payload,
  attempt_count,
  last_attempt_at,
  delivered_at,
  failed_at,
  created_at,
  is_test,
  events:email_delivery_events (
    id,
    provider_event_id,
    event_type,
    event_created_at,
    payload
  ),
  notification:notifications!notification_deliveries_notification_id_fkey (
    type,
    title,
    body,
    action_url,
    payload,
    recipient_user:users!notifications_recipient_user_id_fkey (
      email,
      display_name,
      full_name
    )
  )
` as const

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no está configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

/** Página del outbox real (excluye correos de prueba). */
export async function fetchEmailDeliveriesPage(params: {
  page: number
  pageSize: number
  search?: string
  status?: EmailStatusFilter
  event?: EmailProviderEventFilter
}): Promise<PageResult<EmailDeliveryRow>> {
  const client = requireSupabase()
  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  let query = client
    .from('notification_deliveries')
    .select(SELECT, { count: 'exact' })
    .eq('channel', 'email')
    .eq('is_test', false)
    .order('created_at', { ascending: false })

  if (params.status === 'problem') {
    query = query.in('delivery_status', PROBLEM_STATUSES)
  } else if (params.status && params.status !== 'all') {
    query = query.eq('delivery_status', params.status)
  }

  // El filtro por evento va contra `latest_provider_event` y no contra un join a
  // `email_delivery_events`: un `!inner` con `eq` sobre la tabla embebida
  // devolvería solo el evento que casó, y la cronología del detalle —que se pinta
  // desde esta misma fila— quedaría reducida a un punto.
  if (params.event) {
    query = query.eq('latest_provider_event', params.event)
  }

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  let rows = (data ?? []) as unknown as EmailDeliveryRow[]

  // Búsqueda client-side sobre los campos de la notificación embebida
  // (PostgREST no filtra por columnas de tablas embebidas en `.or`).
  const term = params.search?.trim().toLowerCase()
  if (term) {
    rows = rows.filter((row) => {
      const to = row.notification?.recipient_user?.email ?? ''
      const subject = row.notification?.title ?? ''
      const type = row.notification?.type ?? ''
      return [to, subject, type].some((value) => value.toLowerCase().includes(term))
    })
  }

  return { rows, total: count ?? 0 }
}

/** Conteos del pipeline real (head-only, excluye pruebas). */
export async function fetchEmailDeliveryStats(): Promise<EmailDeliveryStats> {
  const client = requireSupabase()
  const base = () =>
    client
      .from('notification_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('channel', 'email')
      .eq('is_test', false)

  const [total, delivered, problem] = await Promise.all([
    base(),
    base().in('delivery_status', DELIVERED_STATUSES),
    base().in('delivery_status', PROBLEM_STATUSES)
  ])

  if (total.error) throw total.error
  if (delivered.error) throw delivered.error
  if (problem.error) throw problem.error

  return {
    total: total.count ?? 0,
    delivered: delivered.count ?? 0,
    problem: problem.count ?? 0
  }
}

/** Solo los correos del módulo de prueba (aislados). */
export async function fetchTestEmailDeliveries(limit = 100): Promise<EmailDeliveryRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('notification_deliveries')
    .select(SELECT)
    .eq('channel', 'email')
    .eq('is_test', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as EmailDeliveryRow[]
}

export interface SendTestEmailInput {
  to: string
  subject: string
  message: string
  simulate: SimulateScenario
}

/** Lanza un correo de prueba (aislado). Para 'send' dispara el procesador. */
export async function sendTestEmail(input: SendTestEmailInput): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('email_test_send', {
    p_to: input.to.trim(),
    p_subject: input.subject,
    p_message: input.message,
    p_simulate: input.simulate
  })
  if (error) throw error

  if (input.simulate === 'send') {
    await triggerEmailDispatch()
  }
}

/** Fuerza un estado en un correo de prueba (replica los eventos del webhook). */
export async function forceTestStatus(deliveryId: string, status: EmailDeliveryStatus): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('email_test_force_status', {
    p_delivery_id: deliveryId,
    p_status: status
  })
  if (error) throw error
}

/** Limpia todos los correos de prueba. Devuelve cuántos se eliminaron. */
export async function clearTestEmails(): Promise<number> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('email_test_clear')
  if (error) throw error
  return data ?? 0
}

/** Reenvía una entrega: la vuelve a 'pending' y dispara el procesador. */
export async function resendDelivery(deliveryId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('email_resend_delivery', { p_delivery_id: deliveryId })
  if (error) throw error
  await triggerEmailDispatch()
}

/** Dispara el procesador de email bajo demanda (server-side, sin exponer el secret). */
export async function triggerEmailDispatch(): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('trigger_email_dispatch')
  if (error) throw error
}
