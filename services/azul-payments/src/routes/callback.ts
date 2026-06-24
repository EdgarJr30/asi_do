import type { FastifyInstance } from 'fastify'

import type { AppConfig } from '../config.ts'
import {
  isApproved,
  parseAzulResponse,
  settleDonationViaRpc,
  settlePaymentViaRpc,
  verifyResponseAuthHash
} from '../azul/settle.ts'
import { serviceClient } from '../supabase.ts'

type Outcome = 'approved' | 'declined' | 'cancelled' | 'error'
type PaymentFlow = 'membership' | 'donation'

/** Destino final tras el pago: la SPA lee el estado real desde la DB con este flag. */
function redirectTo(config: AppConfig, flow: PaymentFlow, outcome: Outcome, orderNumber?: string): string {
  const path = flow === 'donation' ? '/donate' : '/account/membership'
  const params = new URLSearchParams({ payment: outcome })
  if (orderNumber) {
    params.set('order', orderNumber)
  }
  return `${config.appUrl}${path}?${params.toString()}`
}

function resolveFlow(orderNumber: string): PaymentFlow {
  return orderNumber.startsWith('DON-') ? 'donation' : 'membership'
}

function readOrderNumber(query: Record<string, unknown>): string {
  for (const key of ['order', 'OrderNumber', 'orderNumber']) {
    const value = query[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim()
    }
  }
  return ''
}

async function settleByFlow(
  service: ReturnType<typeof serviceClient>,
  input: { orderNumber: string; approved: boolean; response: Record<string, unknown> }
) {
  return resolveFlow(input.orderNumber) === 'donation'
    ? settleDonationViaRpc(service, input)
    : settlePaymentViaRpc(service, input)
}

/**
 * GET /payments/azul/callback
 * Destino de Approved/Declined/CancelUrl. Verifica el AuthHash firmado por AZUL
 * (anti-tamper), liquida el pago de forma idempotente y redirige a la SPA.
 */
export function registerCallbackRoute(app: FastifyInstance, config: AppConfig): void {
  const service = serviceClient(config)

  app.get('/payments/azul/callback', async (request, reply) => {
    const query = request.query as Record<string, unknown>
    const declaredOutcome = typeof query.outcome === 'string' ? query.outcome : ''
    const orderNumber = readOrderNumber(query)
    const declaredFlow = resolveFlow(orderNumber)

    // Cancelación: AZUL no envía parámetros de respuesta (ni hash). Marcar como fallido/reintetable.
    if (declaredOutcome === 'cancelled') {
      try {
        if (orderNumber) {
          await settleByFlow(service, {
            orderNumber,
            approved: false,
            response: { outcome: 'cancelled' }
          })
        }
      } catch (error) {
        request.log.error({ err: error, orderNumber }, 'Error al liquidar cancelación')
      }
      return reply.redirect(redirectTo(config, declaredFlow, 'cancelled', orderNumber))
    }

    const response = parseAzulResponse(query)
    const effectiveOrder = response.OrderNumber || orderNumber
    const effectiveFlow = resolveFlow(effectiveOrder)

    // Verificación de integridad: el AuthHash lo firma AZUL con la AuthKey secreta.
    if (!verifyResponseAuthHash(response, config.azul.authKey)) {
      request.log.error(
        { orderNumber: effectiveOrder, responseCode: response.ResponseCode },
        'AuthHash de respuesta inválido — posible manipulación; no se liquida el pago'
      )
      return reply.redirect(redirectTo(config, effectiveFlow, 'error', effectiveOrder))
    }

    const approved = isApproved(response)

    try {
      const result = await settleByFlow(service, {
        orderNumber: effectiveOrder,
        approved,
        response: { ...response }
      })
      request.log.info(
        { orderNumber: effectiveOrder, approved, settleStatus: result.status },
        'Callback AZUL liquidado'
      )
    } catch (error) {
      request.log.error({ err: error, orderNumber: effectiveOrder }, 'Error al liquidar pago AZUL')
      return reply.redirect(redirectTo(config, effectiveFlow, 'error', effectiveOrder))
    }

    return reply.redirect(redirectTo(config, effectiveFlow, approved ? 'approved' : 'declined', effectiveOrder))
  })
}
