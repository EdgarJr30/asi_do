/**
 * Dobles de las dos fronteras del pipeline de correo: la base de datos y
 * Resend.
 *
 * Existen porque `process-email-deliveries` corre por `pg_cron`, sin humano en
 * el bucle, y un correo enviado no tiene botón de deshacer. Con estos dobles un
 * test puede aseverar **qué se habría enviado y a quién** sin que salga nada, y
 * puede provocar a voluntad los fallos del proveedor que en producción solo se
 * ven cuando ya ocurrieron.
 *
 * Solo los usan los `.test.ts`: ningún módulo de producción los importa, así
 * que no entran en el bundle que se despliega.
 */

// ── Doble de Supabase ────────────────────────────────────────────────────────

export interface RecordedRpcCall {
  name: string
  args: Record<string, unknown>
}

export interface RecordedInsert {
  table: string
  values: Record<string, unknown>
}

export interface RpcOutcome {
  data?: unknown
  error?: unknown
}

/** `callIndex` es 0 en la primera llamada a *esa* RPC, no en la primera del test. */
export type RpcHandler = (args: Record<string, unknown>, callIndex: number) => RpcOutcome

export interface DatabaseDouble {
  /** Satisface estructuralmente la superficie que consume el procesador. */
  client: {
    rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>
    from(table: string): {
      insert(values: Record<string, unknown>): Promise<{ error: unknown }>
    }
  }
  rpcCalls: RecordedRpcCall[]
  inserts: RecordedInsert[]
  /** Argumentos de cada llamada a una RPC concreta, en orden. */
  argsFor(name: string): Record<string, unknown>[]
  /** Hace fallar los INSERT a partir de la siguiente llamada. */
  failInsertsWith(error: unknown): void
}

export function createDatabaseDouble(handlers: Record<string, RpcHandler> = {}): DatabaseDouble {
  const rpcCalls: RecordedRpcCall[] = []
  const inserts: RecordedInsert[] = []
  const callCounts = new Map<string, number>()
  let insertError: unknown = null

  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args })
      const callIndex = callCounts.get(name) ?? 0
      callCounts.set(name, callIndex + 1)

      const handler = handlers[name]
      if (!handler) {
        // Una RPC sin doble declarado es un descuido del test. Devolver `null`
        // en silencio dejaría pasar como verde un procesador que llama a algo
        // que nadie previó.
        return Promise.resolve({
          data: null,
          error: { message: `El test no declaró un doble para la RPC '${name}'.` }
        })
      }

      const outcome = handler(args, callIndex)
      return Promise.resolve({ data: outcome.data ?? null, error: outcome.error ?? null })
    },
    from(table: string) {
      return {
        insert(values: Record<string, unknown>) {
          inserts.push({ table, values })
          return Promise.resolve({ error: insertError })
        }
      }
    }
  }

  return {
    client,
    rpcCalls,
    inserts,
    argsFor(name: string) {
      return rpcCalls.filter((call) => call.name === name).map((call) => call.args)
    },
    failInsertsWith(error: unknown) {
      insertError = error
    }
  }
}

// ── Doble de Resend ──────────────────────────────────────────────────────────

const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails'

/** Lo que el procesador *habría* enviado, ya desempaquetado. */
export interface RecordedEmail {
  to: string[]
  /** Vacío salvo en los correos que traen `payload.reply_to` (formulario de contacto). */
  replyTo: string[]
  from: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
  authorization: string
}

export interface ResendOutcome {
  status: number
  body?: Record<string, unknown>
  /**
   * Cuerpo crudo, para lo que un proveedor real devuelve cuando algo se rompe
   * delante de él: el HTML de un 502 de la CDN, o una respuesta vacía. Gana
   * sobre `body`.
   */
  rawBody?: string
}

export type ResendResponder = (email: RecordedEmail, callIndex: number) => ResendOutcome

export interface ResendDouble {
  fetch: (input: string, init: RequestInit) => Promise<Response>
  /** Un elemento por correo que habría salido, en orden. */
  sent: RecordedEmail[]
}

/**
 * Por defecto responde como Resend en el camino feliz: 202 con un id de
 * mensaje. Pásale un responder para simular rechazos del proveedor.
 */
export function createResendDouble(respond?: ResendResponder): ResendDouble {
  const sent: RecordedEmail[] = []

  const fetchDouble = (input: string, init: RequestInit): Promise<Response> => {
    if (input !== RESEND_EMAILS_ENDPOINT) {
      // Si el procesador deja de apuntar a Resend, el test debe romperse aquí y
      // no seguir como si nada.
      return Promise.reject(new Error(`El doble de Resend recibió una URL inesperada: ${input}`))
    }

    const headers = new Headers(init.headers)
    const payload = JSON.parse(typeof init.body === 'string' ? init.body : '{}') as Record<string, unknown>

    const email: RecordedEmail = {
      to: Array.isArray(payload.to) ? (payload.to as string[]) : [],
      replyTo: Array.isArray(payload.reply_to) ? (payload.reply_to as string[]) : [],
      from: typeof payload.from === 'string' ? payload.from : '',
      subject: typeof payload.subject === 'string' ? payload.subject : '',
      html: typeof payload.html === 'string' ? payload.html : '',
      text: typeof payload.text === 'string' ? payload.text : '',
      idempotencyKey: headers.get('Idempotency-Key') ?? '',
      authorization: headers.get('Authorization') ?? ''
    }

    const callIndex = sent.length
    sent.push(email)

    const outcome = respond?.(email, callIndex) ?? {
      status: 202,
      body: { id: `resend-message-${callIndex + 1}` }
    }

    const isRaw = typeof outcome.rawBody === 'string'

    return Promise.resolve(
      new Response(isRaw ? outcome.rawBody : JSON.stringify(outcome.body ?? {}), {
        status: outcome.status,
        headers: { 'Content-Type': isRaw ? 'text/html' : 'application/json' }
      })
    )
  }

  return { fetch: fetchDouble, sent }
}
