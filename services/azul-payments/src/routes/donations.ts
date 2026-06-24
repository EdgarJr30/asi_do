import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { authenticate } from '../auth.ts'
import { buildSaleForm, resolveReturnBase, type BeginPaymentRecord } from '../azul/client.ts'
import type { AppConfig } from '../config.ts'
import { serviceClient } from '../supabase.ts'

const donationBodySchema = z
  .object({
    amountOptionId: z.string().uuid().optional(),
    customAmount: z.coerce.number().min(100).max(1_000_000).optional(),
    donorName: z.string().trim().max(120).optional(),
    donorEmail: z.string().trim().email().max(160).optional(),
    donorPhone: z.string().trim().max(40).optional(),
    campaignSlug: z.string().trim().max(80).optional(),
    designation: z.string().trim().max(160).optional()
  })
  .refine((value) => Boolean(value.amountOptionId) || typeof value.customAmount === 'number', {
    message: 'Selecciona un monto o escribe un monto personalizado.',
    path: ['customAmount']
  })

/**
 * POST /payments/azul/donations/create
 * Crea un intento de donación y devuelve el form firmado para la Página de Pago.
 * La ruta acepta visitantes anónimos; si llega Authorization válido, conserva el
 * donor_user_id para historial personal.
 */
export function registerDonationRoutes(app: FastifyInstance, config: AppConfig): void {
  const service = serviceClient(config)

  app.post('/payments/azul/donations/create', async (request, reply) => {
    const parsed = donationBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Cuerpo inválido.', details: parsed.error.flatten() })
    }

    let donorUserId: string | null = null
    if (request.headers.authorization) {
      try {
        donorUserId = (await authenticate(config, request)).id
      } catch {
        donorUserId = null
      }
    }

    const { data, error } = await service.rpc('azul_begin_donation', {
      p_amount_option_id: parsed.data.amountOptionId ?? null,
      p_custom_amount: parsed.data.amountOptionId ? null : parsed.data.customAmount ?? null,
      p_donor_name: parsed.data.donorName ?? null,
      p_donor_email: parsed.data.donorEmail ?? null,
      p_donor_phone: parsed.data.donorPhone ?? null,
      p_donor_user_id: donorUserId,
      p_campaign_slug: parsed.data.campaignSlug ?? 'general',
      p_designation: parsed.data.designation ?? null
    })

    if (error) {
      request.log.warn({ err: error, donorUserId }, 'azul_begin_donation falló')
      return reply.code(422).send({ error: error.message })
    }

    const record = (Array.isArray(data) ? data[0] : data) as BeginPaymentRecord | undefined
    if (!record?.order_number) {
      return reply.code(422).send({ error: 'No se pudo iniciar la donación.' })
    }

    const returnBase = resolveReturnBase(config, request.headers.origin)
    const form = buildSaleForm(
      config,
      {
        payment_id: record.donation_id ?? record.payment_id,
        order_number: record.order_number,
        amount: record.amount,
        currency: record.currency,
        category_label: record.label ?? 'Donación'
      },
      returnBase
    )

    request.log.info({ donorUserId, orderNumber: record.order_number, amount: record.amount }, 'Donación AZUL iniciada')

    return reply.send({
      orderNumber: record.order_number,
      amount: record.amount,
      currency: record.currency,
      ...form
    })
  })
}
