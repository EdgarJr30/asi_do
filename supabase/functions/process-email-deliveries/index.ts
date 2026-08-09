import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

import { corsHeaders } from '../_shared/cors.ts'
import { resolveServiceKey } from '../_shared/supabase-keys.ts'

/**
 * Duración de la reserva. Si el worker no cierra la entrega en este tiempo se
 * asume que murió y otra ejecución puede reclamarla. Debe superar con holgura
 * lo que tarda una llamada al proveedor.
 */
const LEASE_SECONDS = 300

/** Tope de intentos antes de dar la entrega por fallida de forma definitiva. */
const MAX_ATTEMPTS = 5

/**
 * Fila devuelta por `claim_email_deliveries`, que reserva la entrega de forma
 * atómica (`for update skip locked`) en lugar de solo leerla. Trae el token de
 * la reserva y la clave de idempotencia, que son los que hacen seguro el envío.
 */
interface ClaimedEmailDeliveryRow {
  delivery_id: string
  claim_token: string
  idempotency_key: string
  attempt_count: number
  notification_id: string
  notification_type: string
  title: string
  body: string
  action_url: string | null
  payload: Record<string, unknown> | null
  recipient_email: string | null
  recipient_display_name: string | null
  recipient_full_name: string | null
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return 'Unexpected email processor error.'
}

function normalizeActionUrl(actionUrl: string | null | undefined, appUrl: string) {
  if (!actionUrl || actionUrl.trim().length === 0) {
    return appUrl
  }

  if (actionUrl.startsWith('http://') || actionUrl.startsWith('https://')) {
    return actionUrl
  }

  return `${appUrl.replace(/\/+$/, '')}/${actionUrl.replace(/^\/+/, '')}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatHtmlParagraphs(value: string) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#586680;">${paragraph.replaceAll('\n', '<br />')}</p>`)
    .join('')
}

function getEmailTheme(type: string) {
  if (type === 'application.submitted') {
    return {
      eyebrow: 'Nuevo talento en revisión',
      accent: '#4f6ed8',
      accentSoft: '#eef3ff',
      accentBorder: '#dfe7ff',
      badgeLabel: 'Applicant recibido',
      actionLabel: 'Revisar aplicaciones',
      summaryTitle: 'Qué sucede ahora',
      summaryItems: [
        'Accede al panel para revisar el perfil y el CV del candidato.',
        'Mantén el proceso claro actualizando etapas y feedback en la plataforma.'
      ],
      supportTitle: 'Flujo recomendado',
      supportBody: 'Mantén el seguimiento dentro del workspace para conservar contexto, trazabilidad y colaboración del equipo.'
    }
  }

  if (type === 'application.status_updated') {
    return {
      eyebrow: 'Actualización de tu proceso',
      accent: '#3955b8',
      accentSoft: '#eef4ff',
      accentBorder: '#d5e0ff',
      badgeLabel: 'Estado actualizado',
      actionLabel: 'Ver mi aplicación',
      summaryTitle: 'Tu siguiente paso',
      summaryItems: [
        'Consulta el estado más reciente y cualquier instrucción nueva del equipo.',
        'Mantén tu perfil y documentos al día para responder con rapidez.'
      ],
      supportTitle: 'Seguimiento centralizado',
      supportBody: 'Tus cambios de proceso llegan también a tu centro de notificaciones para que no pierdas continuidad.'
    }
  }

  if (type === 'recruiter_request.reviewed') {
    return {
      eyebrow: 'Revisión de acceso employer',
      accent: '#2b418f',
      accentSoft: '#f4f7ff',
      accentBorder: '#dfe7ff',
      badgeLabel: 'Solicitud revisada',
      actionLabel: 'Abrir solicitud',
      summaryTitle: 'Próximo paso',
      summaryItems: [
        'Revisa el resultado de la validación y cualquier nota que haya dejado el equipo.',
        'Si fue aprobada, ya puedes continuar la configuración del workspace employer.'
      ],
      supportTitle: 'Acceso gobernado',
      supportBody: 'Este flujo protege el entorno multi-tenant y garantiza que cada workspace mantenga permisos y trazabilidad correctos.'
    }
  }

  if (type === 'membership.application_submitted') {
    return {
      eyebrow: 'Pipeline de membresía',
      accent: '#2b418f',
      accentSoft: '#f4f7ff',
      accentBorder: '#dfe7ff',
      badgeLabel: 'Solicitud por revisar',
      actionLabel: 'Revisar solicitud',
      summaryTitle: 'Qué sucede ahora',
      summaryItems: [
        'Abre la cola de membresía para revisar la categoría, la iglesia y los datos del solicitante.',
        'Aprueba, pide más información o rechaza; tu decisión avanza el pipeline automáticamente.'
      ],
      supportTitle: 'Separación de funciones',
      supportBody: 'La aprobación de la referencia pastoral y la verificación del pago se gestionan en pasos distintos para conservar control y trazabilidad.'
    }
  }

  if (type === 'membership.payment_submitted') {
    return {
      eyebrow: 'Pipeline de membresía',
      accent: '#3955b8',
      accentSoft: '#eef4ff',
      accentBorder: '#d5e0ff',
      badgeLabel: 'Pago por verificar',
      actionLabel: 'Verificar pago',
      summaryTitle: 'Tu siguiente paso',
      summaryItems: [
        'Abre la consola de membresía para revisar el comprobante de transferencia.',
        'Verifica o rechaza el pago; la activación de la cuenta queda habilitada con el pago verificado.'
      ],
      supportTitle: 'Validación admin-only',
      supportBody: 'Solo los administradores validan pagos, lo que mantiene la separación de funciones del pipeline de membresía.'
    }
  }

  if (type === 'membership.reviewed') {
    return {
      eyebrow: 'Tu solicitud de membresía',
      accent: '#3955b8',
      accentSoft: '#eef4ff',
      accentBorder: '#d5e0ff',
      badgeLabel: 'Solicitud revisada',
      actionLabel: 'Ver mi panel de membresía',
      summaryTitle: 'Tu siguiente paso',
      summaryItems: [
        'Abre tu panel de membresía para ver el detalle de la decisión y las notas del revisor.',
        'Si te pidieron más información, podrás responder y reenviar tu solicitud desde el mismo panel.'
      ],
      supportTitle: 'Seguimiento centralizado',
      supportBody: 'Tu progreso se actualiza en vivo en el panel de membresía y en tu centro de notificaciones.'
    }
  }

  if (type === 'membership.payment_reviewed') {
    return {
      eyebrow: 'Tu pago de membresía',
      accent: '#2b418f',
      accentSoft: '#f4f7ff',
      accentBorder: '#dfe7ff',
      badgeLabel: 'Pago revisado',
      actionLabel: 'Ver mi panel de membresía',
      summaryTitle: 'Tu siguiente paso',
      summaryItems: [
        'Revisa el estado de tu pago en el panel de membresía.',
        'Si fue rechazado, podrás subir un nuevo comprobante desde el mismo panel.'
      ],
      supportTitle: 'Activación gobernada',
      supportBody: 'Con tu solicitud aprobada y tu pago verificado, un administrador habilitará tu acceso completo a la plataforma.'
    }
  }

  if (type === 'membership.activated') {
    return {
      eyebrow: 'Bienvenido a ASI Rep. Dominicana',
      accent: '#4f6ed8',
      accentSoft: '#eef3ff',
      accentBorder: '#dfe7ff',
      badgeLabel: 'Membresía activa',
      actionLabel: 'Entrar a la plataforma',
      summaryTitle: 'Ya tienes acceso',
      summaryItems: [
        'Tu cuenta está activa y tu membresía es válida por un año.',
        'Ingresa a la plataforma para completar tu perfil y aprovechar todas las herramientas.'
      ],
      supportTitle: 'Renovación',
      supportBody: 'Te avisaremos antes del vencimiento para que renueves tu membresía sin interrupciones.'
    }
  }

  if (type === 'membership.renewed') {
    return {
      eyebrow: 'Renovación de membresía',
      accent: '#2b418f',
      accentSoft: '#f4f7ff',
      accentBorder: '#dfe7ff',
      badgeLabel: 'Membresía renovada',
      actionLabel: 'Ver membresías',
      summaryTitle: 'Qué cambió',
      summaryItems: [
        'El pago con tarjeta fue confirmado por AZUL.',
        'La vigencia del miembro fue extendida automáticamente y el comprobante quedó registrado.'
      ],
      supportTitle: 'Seguimiento administrativo',
      supportBody: 'Puedes revisar el pago y la nueva fecha de vencimiento desde la consola de membresía.'
    }
  }

  if (type === 'donation.receipt_issued') {
    return {
      eyebrow: 'Donación confirmada',
      accent: '#047857',
      accentSoft: '#ecfdf5',
      accentBorder: '#bbf7d0',
      badgeLabel: 'Donación aprobada',
      actionLabel: 'Ver comprobante',
      summaryTitle: 'Detalle importante',
      summaryItems: [
        'AZUL confirmó el pago y ASI registró tu aporte institucional.',
        'Conserva este correo como comprobante junto con la referencia de la transacción.'
      ],
      supportTitle: 'Gracias por apoyar',
      supportBody: 'Tu donación ayuda a sostener la misión y los proyectos de ASI Rep. Dominicana.'
    }
  }

  return {
    eyebrow: 'Notificación oficial',
    accent: '#4f6ed8',
    accentSoft: '#eef3ff',
    accentBorder: '#dfe7ff',
    badgeLabel: 'Notificación',
    actionLabel: 'Abrir en la app',
    summaryTitle: 'Qué puedes hacer',
    summaryItems: [
      'Abre la plataforma para revisar el detalle completo de esta actualización.',
      'Continúa el flujo desde la app para mantener el contexto y la trazabilidad.'
    ],
    supportTitle: 'Experiencia unificada',
    supportBody: 'Todas las notificaciones del sistema se diseñan para conservar claridad, seguimiento y continuidad entre email e inbox.'
  }
}

function buildEmailContent(input: {
  appUrl: string
  type: string
  title: string
  body: string
  actionUrl: string | null
  recipientName: string
}) {
  const ctaUrl = normalizeActionUrl(input.actionUrl, input.appUrl)
  const theme = getEmailTheme(input.type)
  const escapedTitle = escapeHtml(input.title)
  const escapedRecipientName = escapeHtml(input.recipientName)
  const escapedCtaUrl = escapeHtml(ctaUrl)
  const escapedEyebrow = escapeHtml(theme.eyebrow)
  const escapedBadgeLabel = escapeHtml(theme.badgeLabel)
  const escapedSummaryTitle = escapeHtml(theme.summaryTitle)
  const escapedSupportTitle = escapeHtml(theme.supportTitle)
  const escapedSupportBody = escapeHtml(theme.supportBody)
  const escapedActionLabel = escapeHtml(theme.actionLabel)
  const logoUrl = `${input.appUrl.replace(/\/+$/, '')}/brand/asi-logo-light.no-bg.png`
  const contentHtml = formatHtmlParagraphs(input.body)
  const summaryItemsHtml = theme.summaryItems
    .map(
      (item) => `
        <tr>
          <td style="padding:0 0 12px; vertical-align:top;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:999px; background:${theme.accent}; margin-top:9px;"></span>
          </td>
          <td style="padding:0 0 12px 12px; font-size:15px; line-height:1.7; color:#586680;">
            ${escapeHtml(item)}
          </td>
        </tr>
      `.trim()
    )
    .join('')
  const text = [
    'ASI Rep. Dominicana',
    '',
    theme.eyebrow,
    input.title,
    '',
    `Hola ${input.recipientName},`,
    '',
    input.body,
    '',
    `${theme.summaryTitle}:`,
    ...theme.summaryItems.map((item) => `- ${item}`),
    '',
    `${theme.actionLabel}: ${ctaUrl}`,
    '',
    `${theme.supportTitle}: ${theme.supportBody}`
  ].join('\n')
  const html = `
    <div style="margin:0; padding:0; background:#f4f7ff;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
        ${escapedTitle}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; background:
        radial-gradient(circle at top left, rgba(159,182,255,0.24) 0%, rgba(159,182,255,0) 34%),
        linear-gradient(180deg, #f4f7ff 0%, #ffffff 42%, #f8faff 100%);">
        <tr>
          <td style="padding:24px 16px 40px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; margin:0 auto; border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 18px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="font-size:0; line-height:0; padding:0 0 14px; border-top:4px solid ${theme.accent};"></td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 22px;">
                        <img src="${logoUrl}" alt="ASI Rep. Dominicana" width="160" style="display:block; width:160px; max-width:100%; height:auto;" />
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="border:1px solid #dfe7ff; border-radius:28px; background:#ffffff; box-shadow:0 24px 60px rgba(25,42,86,0.10); overflow:hidden;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:36px 32px 18px; background:
                        linear-gradient(180deg, rgba(244,247,255,0.96) 0%, rgba(255,255,255,0.98) 100%);">
                        <span style="display:inline-block; padding:8px 12px; border-radius:999px; background:${theme.accentSoft}; border:1px solid ${theme.accentBorder}; color:${theme.accent}; font-size:12px; line-height:1; letter-spacing:0.12em; text-transform:uppercase; font-weight:700;">
                          ${escapedBadgeLabel}
                        </span>
                        <p style="margin:20px 0 0; font-size:12px; line-height:1.5; letter-spacing:0.22em; text-transform:uppercase; color:#8290ab; font-weight:700;">
                          ${escapedEyebrow}
                        </p>
                        <h1 style="margin:12px 0 0; font-family:Manrope, Segoe UI, sans-serif; font-size:38px; line-height:1.02; letter-spacing:-0.03em; color:#15203b;">
                          ${escapedTitle}
                        </h1>
                        <p style="margin:18px 0 0; font-size:16px; line-height:1.7; color:#586680;">
                          Hola ${escapedRecipientName},
                        </p>
                        <div style="margin-top:14px;">
                          ${contentHtml}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:4px 32px 0;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; border-top:1px solid #e8edf5;">
                          <tr>
                            <td style="padding:24px 0 0;">
                              <p style="margin:0 0 16px; font-size:12px; line-height:1.5; letter-spacing:0.22em; text-transform:uppercase; color:#8290ab; font-weight:700;">
                                ${escapedSummaryTitle}
                              </p>
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                                ${summaryItemsHtml}
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px 32px 0;">
                        <a href="${escapedCtaUrl}" style="display:inline-block; min-width:220px; border-radius:18px; background:${theme.accent}; color:#ffffff; text-decoration:none; text-align:center; padding:16px 24px; font-size:14px; font-weight:700; letter-spacing:0.04em; box-shadow:0 18px 34px rgba(43,65,143,0.22);">
                          ${escapedActionLabel}
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px 32px 0;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; border-top:1px solid #e8edf5;">
                          <tr>
                            <td style="padding:24px 0 0;">
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0 12px;">
                                <tr>
                                  <td style="width:50%; vertical-align:top; padding:18px 18px 18px 0;">
                                    <p style="margin:0 0 8px; font-size:12px; line-height:1.5; letter-spacing:0.18em; text-transform:uppercase; color:#8290ab; font-weight:700;">
                                      Enlace manual
                                    </p>
                                    <p style="margin:0; font-size:14px; line-height:1.7; color:#586680;">
                                      Si el botón no funciona, abre este enlace:
                                    </p>
                                    <p style="margin:8px 0 0; font-size:13px; line-height:1.7; word-break:break-word;">
                                      <a href="${escapedCtaUrl}" style="color:${theme.accent}; text-decoration:none;">${escapedCtaUrl}</a>
                                    </p>
                                  </td>
                                  <td style="width:50%; vertical-align:top; padding:18px 0 18px 18px;">
                                    <p style="margin:0 0 8px; font-size:12px; line-height:1.5; letter-spacing:0.18em; text-transform:uppercase; color:#8290ab; font-weight:700;">
                                      ${escapedSupportTitle}
                                    </p>
                                    <p style="margin:0; font-size:14px; line-height:1.7; color:#586680;">
                                      ${escapedSupportBody}
                                    </p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px 32px 34px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; border-top:1px solid #e8edf5;">
                          <tr>
                            <td style="padding:24px 0 0; font-size:12px; line-height:1.8; color:#8290ab;">
                              Este correo fue enviado por ASI Rep. Dominicana como parte de la experiencia oficial de asi_do.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `.trim()

  return { html, text }
}

async function insertDeliveryLog(
  client: SupabaseClient,
  input: {
    deliveryId: string
    logLevel: 'info' | 'warn' | 'error'
    message: string
    metadata?: Record<string, unknown>
  }
) {
  const response = await client.from('notification_delivery_logs').insert({
    delivery_id: input.deliveryId,
    log_level: input.logLevel,
    message: input.message,
    metadata: input.metadata ?? {}
  })

  if (response.error) {
    throw response.error
  }
}

/**
 * Cierra la reserva y escribe el resultado. El token es la guarda: si el lease
 * venció y otro worker ya reclamó la entrega, el RPC no aplica nada y devuelve
 * `false`, de modo que un worker zombi no puede pisar el resultado del vivo.
 *
 * Devuelve si el cierre se aplicó, para poder registrarlo cuando no.
 */
async function completeDelivery(
  client: SupabaseClient,
  input: {
    deliveryId: string
    claimToken: string
    status: 'sent' | 'failed' | 'pending'
    responseCode?: number | null
    providerMessageId?: string | null
    responsePayload?: Record<string, unknown>
  }
): Promise<boolean> {
  const response = await client.rpc('complete_email_delivery', {
    p_delivery_id: input.deliveryId,
    p_claim_token: input.claimToken,
    p_status: input.status,
    p_response_code: input.responseCode ?? null,
    p_provider_message_id: input.providerMessageId ?? null,
    p_response_payload: input.responsePayload ?? {}
  })

  if (response.error) {
    throw response.error
  }

  return response.data === true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const secret = Deno.env.get('EMAIL_PROCESSOR_SECRET') ?? ''
    const providedSecret = req.headers.get('x-email-processor-secret') ?? ''

    if (!secret || providedSecret !== secret) {
      return jsonResponse({ error: 'Unauthorized.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = resolveServiceKey()
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('RESEND_API_KEY_DEV') ?? ''
    const fromEmail = Deno.env.get('EMAIL_FROM_ADDRESS') ?? Deno.env.get('EMAIL_FROM_ADDRESS_DEV') ?? ''
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
    }

    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? '20') || 20, 50)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    })

    // Reserva atómica: marca las filas como 'processing' y devuelve solo las que
    // este worker consiguió. Otra ejecución concurrente recibe un conjunto
    // disjunto, así que el mismo correo no puede enviarse dos veces. También
    // recupera reservas cuyo lease venció porque el worker anterior murió.
    const pendingResponse = await supabase.rpc('claim_email_deliveries', {
      p_limit: limit,
      p_lease_seconds: LEASE_SECONDS,
      p_max_attempts: MAX_ATTEMPTS
    })

    if (pendingResponse.error) {
      throw pendingResponse.error
    }

    const deliveries = (pendingResponse.data ?? []) as unknown as ClaimedEmailDeliveryRow[]

    if (deliveries.length === 0) {
      return jsonResponse({
        processedCount: 0,
        sentCount: 0,
        failedCount: 0
      })
    }

    let sentCount = 0
    let failedCount = 0

    for (const delivery of deliveries) {
      // Override del destinatario (lo usa el módulo de prueba de /admin/correos para
      // enviar a una dirección arbitraria). El pipeline real no setea payload.to.
      const overrideTo =
        typeof delivery.payload?.to === 'string' ? (delivery.payload.to as string).trim() : ''
      const overrideRecipientName =
        typeof delivery.payload?.recipientName === 'string'
          ? (delivery.payload.recipientName as string).trim()
          : ''
      const recipientEmail = overrideTo || (delivery.recipient_email?.trim() ?? '')
      const recipientName =
        overrideRecipientName ||
        delivery.recipient_display_name?.trim() ||
        delivery.recipient_full_name?.trim() ||
        'usuario'

      // El contador de intentos ya lo incrementó la reserva, dentro de la misma
      // sentencia que tomó la fila. Hacerlo aquí era un read-then-write que
      // perdía incrementos y marcaba 'processing' demasiado tarde.

      if (!resendApiKey || !fromEmail) {
        failedCount += 1
        await completeDelivery(supabase, {
          deliveryId: delivery.delivery_id,
          claimToken: delivery.claim_token,
          status: 'failed',
          responseCode: 503,
          responsePayload: {
            missingConfig: [
              !resendApiKey ? 'RESEND_API_KEY' : null,
              !fromEmail ? 'EMAIL_FROM_ADDRESS' : null
            ].filter(Boolean)
          }
        })
        await insertDeliveryLog(supabase, {
          deliveryId: delivery.delivery_id,
          logLevel: 'error',
          message: 'Email delivery failed because the email provider configuration is missing.',
          metadata: {
            provider: 'resend',
            recipientEmail
          }
        })
        continue
      }

      if (recipientEmail.length === 0) {
        failedCount += 1
        await completeDelivery(supabase, {
          deliveryId: delivery.delivery_id,
          claimToken: delivery.claim_token,
          status: 'failed',
          responseCode: 422,
          responsePayload: {
            recipientEmail
          }
        })
        await insertDeliveryLog(supabase, {
          deliveryId: delivery.delivery_id,
          logLevel: 'error',
          message: 'Email delivery failed because the notification payload or recipient email is incomplete.',
          metadata: {
            notificationId: delivery.notification_id
          }
        })
        continue
      }

      const emailContent = buildEmailContent({
        appUrl,
        type: delivery.notification_type,
        title: delivery.title,
        body: delivery.body,
        actionUrl: delivery.action_url,
        recipientName
      })

      const providerResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          // Si la respuesta se pierde (timeout, corte) y el lease expira, el
          // reintento llega con la misma clave y el proveedor no reenvía. La
          // clave solo se renueva en un reenvío deliberado desde /admin/correos.
          'Idempotency-Key': delivery.idempotency_key
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipientEmail],
          subject: delivery.title,
          html: emailContent.html,
          text: emailContent.text
        })
      })

      const providerPayload = (await providerResponse.json().catch(() => ({}))) as Record<string, unknown>

      if (!providerResponse.ok) {
        failedCount += 1
        // Se deja en 'pending' para que el siguiente ciclo lo reintente con la
        // misma clave de idempotencia, hasta agotar MAX_ATTEMPTS. Marcarlo
        // 'failed' aquí convertía un fallo transitorio del proveedor en
        // definitivo y el correo no se enviaba nunca.
        await completeDelivery(supabase, {
          deliveryId: delivery.delivery_id,
          claimToken: delivery.claim_token,
          status: delivery.attempt_count >= MAX_ATTEMPTS ? 'failed' : 'pending',
          responseCode: providerResponse.status,
          responsePayload: providerPayload
        })
        await insertDeliveryLog(supabase, {
          deliveryId: delivery.delivery_id,
          logLevel: 'error',
          message: 'Email delivery failed at provider level.',
          metadata: {
            responseCode: providerResponse.status,
            attemptCount: delivery.attempt_count,
            providerPayload
          }
        })
        continue
      }

      sentCount += 1
      await completeDelivery(supabase, {
        deliveryId: delivery.delivery_id,
        claimToken: delivery.claim_token,
        status: 'sent',
        responseCode: providerResponse.status,
        providerMessageId: typeof providerPayload.id === 'string' ? providerPayload.id : null,
        responsePayload: providerPayload
      })
      await insertDeliveryLog(supabase, {
        deliveryId: delivery.delivery_id,
        logLevel: 'info',
        message: 'Email delivery sent successfully.',
        metadata: {
          provider: 'resend',
          providerMessageId: providerPayload.id ?? null,
          recipientEmail
        }
      })
    }

    return jsonResponse({
      processedCount: deliveries.length,
      sentCount,
      failedCount
    })
  } catch (error) {
    return jsonResponse(
      {
        error: toErrorMessage(error)
      },
      500
    )
  }
})
