import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FastifyBaseLogger } from 'fastify'

import { reconcileOnce } from '../src/jobs/reconcile.ts'
import type { AppConfig } from '../src/config.ts'
import { testConfig, type RpcCall } from './helpers.ts'

/**
 * R4.2 — la red de seguridad del cobro.
 *
 * `reconcile` es lo único que recupera un pago cobrado en AZUL cuyo callback nunca
 * llegó (el usuario cerró el navegador, se cayó la red). Sin él, el modo de fallo es
 * dinero cobrado con la membresía sin activar; por eso son 164 líneas que no pueden
 * quedar sin ejercitar.
 */

interface QueryRecord {
  table: string
  columns: string
  filters: string[]
  limit: number | null
}

interface StaleRow {
  order_number: string
  amount: number
  created_at: string
}

/**
 * Doble del cliente de Supabase que registra la consulta en vez de ejecutarla.
 *
 * A diferencia de `SettlementDatabase` (declarado estructuralmente), aquí hace falta
 * un cast: comparar el encadenado `from().select().eq()…` contra una interfaz propia
 * hace que `tsc` aborte con TS2589 ("type instantiation is excessively deep") por los
 * genéricos de `PostgrestFilterBuilder`. Comprobado antes de escribir esto.
 */
function createReconcileDouble(options: {
  membership?: StaleRow[]
  donations?: StaleRow[]
  membershipError?: unknown
  donationError?: unknown
  rpcError?: (call: RpcCall) => unknown
} = {}) {
  const queries: QueryRecord[] = []
  const rpcCalls: RpcCall[] = []

  const client = {
    from(table: string) {
      const record: QueryRecord = { table, columns: '', filters: [], limit: null }
      queries.push(record)

      const builder = {
        select(columns: string) {
          record.columns = columns
          return builder
        },
        eq(column: string, value: unknown) {
          record.filters.push(`eq:${column}=${String(value)}`)
          return builder
        },
        lt(column: string, value: unknown) {
          record.filters.push(`lt:${column}=${String(value)}`)
          return builder
        },
        not(column: string, operator: string, value: unknown) {
          record.filters.push(`not:${column} ${operator} ${String(value)}`)
          return builder
        },
        order(column: string, opts: { ascending: boolean }) {
          record.filters.push(`order:${column}=${opts.ascending ? 'asc' : 'desc'}`)
          return builder
        },
        limit(count: number) {
          record.limit = count
          const isMembership = table === 'membership_payments'
          return Promise.resolve({
            data: isMembership ? (options.membership ?? []) : (options.donations ?? []),
            error: isMembership ? (options.membershipError ?? null) : (options.donationError ?? null)
          })
        }
      }

      return builder
    },
    rpc(fn: string, params: Record<string, unknown>) {
      const call = { fn, params }
      rpcCalls.push(call)
      const error = options.rpcError?.(call) ?? null
      return Promise.resolve({ data: error ? null : [{ status: 'verified' }], error })
    }
  }

  return { client: client as unknown as SupabaseClient, queries, rpcCalls }
}

interface LogEntry {
  level: 'info' | 'warn' | 'error'
  context: Record<string, unknown>
  message: string
}

function createLogger() {
  const entries: LogEntry[] = []
  const record = (level: LogEntry['level']) => (context: unknown, message?: string) => {
    entries.push({ level, context: (context ?? {}) as Record<string, unknown>, message: message ?? '' })
  }
  const log = {
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    debug: () => undefined,
    trace: () => undefined,
    fatal: () => undefined,
    silent: () => undefined,
    level: 'info',
    child: () => log
  }
  return { log: log as unknown as FastifyBaseLogger, entries }
}

/** Config con el webservice de verificación activo (sin él nunca hay veredicto). */
const verifiableConfig: AppConfig = {
  ...testConfig,
  azul: { ...testConfig.azul, verifyApiUrl: 'https://verify.azul.test/query', verifyApiKey: 'verify-key' },
  reconcile: { ...testConfig.reconcile, staleMinutes: 15 }
}

function staleRow(orderNumber: string): StaleRow {
  return { order_number: orderNumber, amount: 2500, created_at: '2026-08-09T17:00:00.000Z' }
}

function azulSays(payload: Record<string, unknown>, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(payload), { status }))
}

const APPROVED_PAYLOAD = {
  ResponseCode: 'Approved',
  IsoCode: '00',
  ResponseMessage: 'APROBADA',
  AuthorizationCode: 'OK9999',
  Amount: '250000'
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-09T18:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('qué filas se consideran colgadas', () => {
  it('solo pide las initiated de AZUL más viejas que el corte — un pago ya liquidado nunca vuelve a entrar', async () => {
    const db = createReconcileDouble()
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    expect(db.queries.map((q) => q.table)).toEqual(['membership_payments', 'donations'])
    for (const query of db.queries) {
      // `status=initiated` es el mecanismo entero de "no duplicar": una orden ya
      // verificada o fallida sale del conjunto y no se puede volver a liquidar.
      expect(query.filters).toContain('eq:status=initiated')
      expect(query.filters).toContain('eq:gateway=azul')
      expect(query.filters).toContain('lt:created_at=2026-08-09T17:45:00.000Z')
      expect(query.filters).toContain('not:order_number is null')
      expect(query.limit).toBe(50)
    }
  })

  it('sin filas colgadas no consulta a AZUL ni escribe nada', async () => {
    const fetchDouble = azulSays(APPROVED_PAYLOAD)
    vi.stubGlobal('fetch', fetchDouble)
    const db = createReconcileDouble()
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    expect(fetchDouble).not.toHaveBeenCalled()
    expect(db.rpcCalls).toEqual([])
  })
})

describe('pago aprobado en AZUL pero colgado en local', () => {
  it('se concilia: se liquida como aprobado y queda marcado como venido del cron', async () => {
    vi.stubGlobal('fetch', azulSays(APPROVED_PAYLOAD))
    const db = createReconcileDouble({ membership: [staleRow('ASI-260809-colgado')] })
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    expect(db.rpcCalls).toHaveLength(1)
    expect(db.rpcCalls[0].fn).toBe('azul_settle_membership_payment')
    expect(db.rpcCalls[0].params).toMatchObject({
      p_order_number: 'ASI-260809-colgado',
      p_approved: true
    })
    // El rastro distingue una liquidación por cron de una por callback del usuario.
    expect(db.rpcCalls[0].params.p_response).toMatchObject({ reconciledBy: 'cron', Amount: '250000' })
  })

  it('pregunta a AZUL por el número de orden concreto, con las credenciales del comercio', async () => {
    const fetchDouble = azulSays(APPROVED_PAYLOAD)
    vi.stubGlobal('fetch', fetchDouble)
    const db = createReconcileDouble({ membership: [staleRow('ASI-260809-colgado')] })
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    const [url, init] = fetchDouble.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://verify.azul.test/query')
    expect((init.headers as Record<string, string>).Auth1).toBe(verifiableConfig.azul.merchantId)
    expect((init.headers as Record<string, string>).Auth2).toBe('verify-key')
    expect(JSON.parse(String(init.body))).toMatchObject({ OrderNumber: 'ASI-260809-colgado' })
  })

  it('una declinación en AZUL se concilia como fallida, no como aprobada', async () => {
    vi.stubGlobal('fetch', azulSays({ ResponseCode: 'Declined', IsoCode: '05', ResponseMessage: 'DECLINADA' }))
    const db = createReconcileDouble({ membership: [staleRow('ASI-260809-declinado')] })
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    expect(db.rpcCalls[0].params.p_approved).toBe(false)
  })

  it('una donación colgada usa el RPC de donaciones', async () => {
    vi.stubGlobal('fetch', azulSays(APPROVED_PAYLOAD))
    const db = createReconcileDouble({ donations: [staleRow('DON-260809-colgada')] })
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    expect(db.rpcCalls).toHaveLength(1)
    expect(db.rpcCalls[0].fn).toBe('azul_settle_donation_payment')
    expect(db.rpcCalls[0].params.p_order_number).toBe('DON-260809-colgada')
  })
})

describe('AZUL no responde: no se marca nada', () => {
  it('sin webservice configurado no se inventa un veredicto', async () => {
    const fetchDouble = azulSays(APPROVED_PAYLOAD)
    vi.stubGlobal('fetch', fetchDouble)
    const db = createReconcileDouble({ membership: [staleRow('ASI-1')] })
    const { log, entries } = createLogger()

    await reconcileOnce(testConfig, db.client, log)

    expect(fetchDouble).not.toHaveBeenCalled()
    expect(db.rpcCalls).toEqual([])
    expect(entries.some((e) => e.level === 'warn' && e.message.includes('revisar manualmente'))).toBe(true)
  })

  it('un 500 de AZUL deja la orden como está', async () => {
    vi.stubGlobal('fetch', azulSays({}, 500))
    const db = createReconcileDouble({ membership: [staleRow('ASI-1')] })
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    expect(db.rpcCalls).toEqual([])
  })

  it('una red caída deja la orden como está', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    const db = createReconcileDouble({ membership: [staleRow('ASI-1')] })
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    expect(db.rpcCalls).toEqual([])
  })

  it('una respuesta sin ResponseCode no cuenta como veredicto', async () => {
    vi.stubGlobal('fetch', azulSays({ IsoCode: '00', ResponseMessage: 'APROBADA' }))
    const db = createReconcileDouble({ membership: [staleRow('ASI-1')] })
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    expect(db.rpcCalls).toEqual([])
  })
})

describe('un fallo no arrastra al resto del lote', () => {
  it('si falla la lectura de membresías, las donaciones se concilian igual', async () => {
    vi.stubGlobal('fetch', azulSays(APPROVED_PAYLOAD))
    const db = createReconcileDouble({
      membershipError: { message: 'statement timeout' },
      donations: [staleRow('DON-260809-colgada')]
    })
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    expect(db.rpcCalls).toHaveLength(1)
    expect(db.rpcCalls[0].fn).toBe('azul_settle_donation_payment')
  })

  it('si una liquidación falla, la siguiente orden se intenta igual', async () => {
    vi.stubGlobal('fetch', azulSays(APPROVED_PAYLOAD))
    const db = createReconcileDouble({
      membership: [staleRow('ASI-rota'), staleRow('ASI-buena')],
      rpcError: (call) => (call.params.p_order_number === 'ASI-rota' ? { message: 'deadlock detected' } : null)
    })
    const { log } = createLogger()

    await reconcileOnce(verifiableConfig, db.client, log)

    expect(db.rpcCalls.map((c) => c.params.p_order_number)).toEqual(['ASI-rota', 'ASI-buena'])
  })
})
