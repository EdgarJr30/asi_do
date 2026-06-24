import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { authenticate, AuthError } from '../auth.ts'
import { buildSaleForm, resolveReturnBase, type BeginPaymentRecord } from '../azul/client.ts'
import type { AppConfig } from '../config.ts'
import { userClient } from '../supabase.ts'

const createBodySchema = z.object({
  applicationId: z.string().uuid(),
  intent: z.enum(['initial', 'renewal']).default('initial'),
  years: z.coerce.number().int().min(1).max(5).default(1)
})

/**
 * POST /payments/azul/create
 * Inicia un pago de membresía: valida la sesión, crea el registro `initiated` vía RPC
 * (autorización + cuota en SQL con RLS) y devuelve el formulario firmado para AZUL.
 */
export function registerCreateRoute(app: FastifyInstance, config: AppConfig): void {
  app.post('/payments/azul/create', async (request, reply) => {
    let user
    try {
      user = await authenticate(config, request)
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(401).send({ error: error.message })
      }
      throw error
    }

    const parsed = createBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Cuerpo inválido.', details: parsed.error.flatten() })
    }

    const client = userClient(config, user.accessToken)
    const { data, error } = await client.rpc('azul_begin_membership_payment', {
      p_application_id: parsed.data.applicationId,
      p_intent: parsed.data.intent,
      p_years: parsed.data.years
    })

    if (error) {
      request.log.warn({ err: error, userId: user.id }, 'azul_begin_membership_payment falló')
      // Errores de negocio del RPC (no autorizado, sin cuota, ya pagado) → 422.
      return reply.code(422).send({ error: error.message })
    }

    const record = (Array.isArray(data) ? data[0] : data) as BeginPaymentRecord | undefined
    if (!record?.order_number) {
      return reply.code(422).send({ error: 'No se pudo iniciar el pago.' })
    }

    const returnBase = resolveReturnBase(config, request.headers.origin)
    const form = buildSaleForm(config, record, returnBase)
    request.log.info(
      { userId: user.id, orderNumber: record.order_number, amount: record.amount, intent: parsed.data.intent, years: parsed.data.years, returnBase },
      'Pago AZUL iniciado'
    )

    return reply.send({
      orderNumber: record.order_number,
      amount: record.amount,
      currency: record.currency,
      ...form
    })
  })
}
