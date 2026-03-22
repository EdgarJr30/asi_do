import { createClient } from 'npm:@supabase/supabase-js@2'

import { corsHeaders } from '../_shared/cors.ts'

interface PendingEmailDeliveryRow {
  id: string
  attempt_count: number
  notification_id: string
  notification: {
    id: string
    type: string
    title: string
    body: string
    action_url: string | null
    payload: Record<string, unknown> | null
    recipient_user: {
      id: string
      email: string | null
      display_name: string | null
      full_name: string | null
    } | null
  } | null
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
  const logoUrl = `${input.appUrl.replace(/\/+$/, '')}/brand/asi-logo-light.png`
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
                              Este correo fue enviado por ASI Rep. Dominicana como parte de la experiencia oficial de Talent Marketplace.
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
  client: ReturnType<typeof createClient>,
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

async function updateDelivery(
  client: ReturnType<typeof createClient>,
  input: {
    deliveryId: string
    status: 'processing' | 'sent' | 'failed'
    responseCode?: number | null
    providerMessageId?: string | null
    providerName?: string
    responsePayload?: Record<string, unknown>
    delivered?: boolean
  }
) {
  const payload: Record<string, unknown> = {
    delivery_status: input.status,
    response_code: input.responseCode ?? null,
    provider_message_id: input.providerMessageId ?? null,
    provider_name: input.providerName ?? 'resend',
    response_payload: input.responsePayload ?? {},
    last_attempt_at: new Date().toISOString(),
    attempt_count: undefined,
    failed_at: input.status === 'failed' ? new Date().toISOString() : null,
    delivered_at: input.status === 'sent' || input.delivered ? new Date().toISOString() : null
  }

  const response = await client
    .from('notification_deliveries')
    .update(payload)
    .eq('id', input.deliveryId)

  if (response.error) {
    throw response.error
  }
}

async function incrementAttemptCount(client: ReturnType<typeof createClient>, deliveryId: string) {
  const readResponse = await client
    .from('notification_deliveries')
    .select('attempt_count')
    .eq('id', deliveryId)
    .single()

  if (readResponse.error) {
    throw readResponse.error
  }

  const response = await client
    .from('notification_deliveries')
    .update({
      attempt_count: (readResponse.data.attempt_count ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
      delivery_status: 'processing',
      provider_name: 'resend'
    })
    .eq('id', deliveryId)

  if (response.error) {
    throw response.error
  }
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const fromEmail = Deno.env.get('EMAIL_FROM_ADDRESS') ?? ''
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

    const pendingResponse = await supabase
      .from('notification_deliveries')
      .select(
        `
          id,
          attempt_count,
          notification_id,
          notification:notifications!notification_deliveries_notification_id_fkey (
            id,
            type,
            title,
            body,
            action_url,
            payload,
            recipient_user:users!notifications_recipient_user_id_fkey (
              id,
              email,
              display_name,
              full_name
            )
          )
        `
      )
      .eq('channel', 'email')
      .eq('delivery_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (pendingResponse.error) {
      throw pendingResponse.error
    }

    const deliveries = (pendingResponse.data ?? []) as unknown as PendingEmailDeliveryRow[]

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
      const recipientEmail = delivery.notification?.recipient_user?.email?.trim() ?? ''
      const recipientName =
        delivery.notification?.recipient_user?.display_name?.trim() ||
        delivery.notification?.recipient_user?.full_name?.trim() ||
        'usuario'

      await incrementAttemptCount(supabase, delivery.id)

      if (!resendApiKey || !fromEmail) {
        failedCount += 1
        await updateDelivery(supabase, {
          deliveryId: delivery.id,
          status: 'failed',
          responseCode: 503,
          providerName: 'email_hook',
          responsePayload: {
            missingConfig: [
              !resendApiKey ? 'RESEND_API_KEY' : null,
              !fromEmail ? 'EMAIL_FROM_ADDRESS' : null
            ].filter(Boolean)
          }
        })
        await insertDeliveryLog(supabase, {
          deliveryId: delivery.id,
          logLevel: 'error',
          message: 'Email delivery failed because the email provider configuration is missing.',
          metadata: {
            provider: 'resend',
            recipientEmail
          }
        })
        continue
      }

      if (!delivery.notification || recipientEmail.length === 0) {
        failedCount += 1
        await updateDelivery(supabase, {
          deliveryId: delivery.id,
          status: 'failed',
          responseCode: 422,
          providerName: 'resend',
          responsePayload: {
            recipientEmail
          }
        })
        await insertDeliveryLog(supabase, {
          deliveryId: delivery.id,
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
        type: delivery.notification.type,
        title: delivery.notification.title,
        body: delivery.notification.body,
        actionUrl: delivery.notification.action_url,
        recipientName
      })

      const providerResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipientEmail],
          subject: delivery.notification.title,
          html: emailContent.html,
          text: emailContent.text
        })
      })

      const providerPayload = (await providerResponse.json().catch(() => ({}))) as Record<string, unknown>

      if (!providerResponse.ok) {
        failedCount += 1
        await updateDelivery(supabase, {
          deliveryId: delivery.id,
          status: 'failed',
          responseCode: providerResponse.status,
          providerName: 'resend',
          responsePayload: providerPayload
        })
        await insertDeliveryLog(supabase, {
          deliveryId: delivery.id,
          logLevel: 'error',
          message: 'Email delivery failed at provider level.',
          metadata: {
            responseCode: providerResponse.status,
            providerPayload
          }
        })
        continue
      }

      sentCount += 1
      await updateDelivery(supabase, {
        deliveryId: delivery.id,
        status: 'sent',
        responseCode: providerResponse.status,
        providerName: 'resend',
        providerMessageId: typeof providerPayload.id === 'string' ? providerPayload.id : null,
        responsePayload: providerPayload,
        delivered: true
      })
      await insertDeliveryLog(supabase, {
        deliveryId: delivery.id,
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
