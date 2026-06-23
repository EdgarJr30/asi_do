import cron from 'node-cron'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FastifyBaseLogger } from 'fastify'

import type { AppConfig } from '../config.ts'
import { isApproved, settlePaymentViaRpc } from '../azul/settle.ts'
import { serviceClient } from '../supabase.ts'

interface StalePaymentRow {
  order_number: string
  amount: number | null
  created_at: string
}

/**
 * Consulta el estado de una transacción al Webservice de AZUL (conciliación
 * server-to-server). El contrato exacto debe confirmarse con AZUL; por eso queda
 * detrás de configuración opcional. Devuelve null si no se pudo determinar.
 *
 * TODO(azul): ajustar payload/parseo cuando se obtengan credenciales del webservice.
 */
async function queryAzulTransaction(
  config: AppConfig,
  orderNumber: string,
  log: FastifyBaseLogger
): Promise<{ approved: boolean; response: Record<string, unknown> } | null> {
  if (!config.azul.verifyApiUrl || !config.azul.verifyApiKey) {
    return null
  }

  try {
    const res = await fetch(config.azul.verifyApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Auth1: config.azul.merchantId,
        Auth2: config.azul.verifyApiKey
      },
      body: JSON.stringify({ Channel: 'EC', Store: config.azul.merchantId, OrderNumber: orderNumber })
    })

    if (!res.ok) {
      log.warn({ orderNumber, status: res.status }, 'Consulta AZUL devolvió estado no-OK')
      return null
    }

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const responseCode = String(payload.ResponseCode ?? payload.responseCode ?? '')
    const isoCode = String(payload.IsoCode ?? payload.ISOCode ?? payload.isoCode ?? '')
    const responseMessage = String(payload.ResponseMessage ?? payload.responseMessage ?? '')

    // Solo conciliamos cuando AZUL da un veredicto definitivo.
    if (!responseCode) {
      return null
    }

    return {
      approved: isApproved({ ResponseCode: responseCode, IsoCode: isoCode, ResponseMessage: responseMessage }),
      response: payload
    }
  } catch (error) {
    log.error({ err: error, orderNumber }, 'Error consultando transacción a AZUL')
    return null
  }
}

async function reconcileOnce(config: AppConfig, service: SupabaseClient, log: FastifyBaseLogger): Promise<void> {
  const cutoff = new Date(Date.now() - config.reconcile.staleMinutes * 60_000).toISOString()

  const { data, error } = await service
    .from('membership_payments')
    .select('order_number, amount, created_at')
    .eq('gateway', 'azul')
    .eq('status', 'initiated')
    .lt('created_at', cutoff)
    .not('order_number', 'is', null)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    log.error({ err: error }, 'Conciliación: no se pudieron leer pagos pendientes')
    return
  }

  const rows = (data ?? []) as StalePaymentRow[]
  if (rows.length === 0) {
    return
  }

  log.info({ count: rows.length }, 'Conciliación: pagos initiated estancados')

  for (const row of rows) {
    const verdict = await queryAzulTransaction(config, row.order_number, log)

    if (!verdict) {
      // Sin webservice (o sin veredicto): no forzamos estado, solo dejamos rastro para admins.
      log.warn({ orderNumber: row.order_number, createdAt: row.created_at }, 'Pago estancado sin veredicto AZUL — revisar manualmente')
      continue
    }

    try {
      const result = await settlePaymentViaRpc(service, {
        orderNumber: row.order_number,
        approved: verdict.approved,
        response: { ...verdict.response, reconciledBy: 'cron' }
      })
      log.info({ orderNumber: row.order_number, approved: verdict.approved, settleStatus: result.status }, 'Conciliado vía cron')
    } catch (settleError) {
      log.error({ err: settleError, orderNumber: row.order_number }, 'Error liquidando en conciliación')
    }
  }
}

/** Programa el cron de conciliación. Devuelve una función para detenerlo. */
export function startReconciliationJob(config: AppConfig, log: FastifyBaseLogger): () => void {
  if (!config.reconcile.enabled) {
    log.info('Conciliación deshabilitada (RECONCILE_ENABLED=false)')
    return () => {}
  }

  if (!cron.validate(config.reconcile.cron)) {
    log.error({ cron: config.reconcile.cron }, 'RECONCILE_CRON inválido — conciliación no programada')
    return () => {}
  }

  const service = serviceClient(config)
  let running = false

  const task = cron.schedule(config.reconcile.cron, async () => {
    if (running) {
      return
    }
    running = true
    try {
      await reconcileOnce(config, service, log)
    } finally {
      running = false
    }
  })

  log.info({ cron: config.reconcile.cron, staleMinutes: config.reconcile.staleMinutes }, 'Conciliación AZUL programada')
  return () => task.stop()
}
