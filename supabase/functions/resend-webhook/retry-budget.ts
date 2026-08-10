/**
 * Presupuesto de reintentos del webhook de Resend.
 *
 * Incidente 2026-08-10 (12:06–14:14 UTC): con PostgreSQL sin aceptar
 * conexiones, cada reintento del proveedor volvía a entrar, abría un cliente y
 * esperaba a una base que no contestaba. Responder 4xx/5xx *pide* otro
 * reintento, así que el endpoint mantenía viva una tormenta contra una base ya
 * moribunda: 46 llamadas a `record_resend_webhook_event` en los 23 minutos
 * exportados, ninguna registrable.
 *
 * El único freno era el calendario de reintentos del proveedor, que ni
 * controlamos ni probamos. Aquí el tope es nuestro y se mide contra el reloj
 * del evento, no contra un contador de intentos que el proveedor no envía.
 * Pasada la ventana el evento se acepta (200) y queda en el log: un
 * `email.delivered` de hace horas no vale lo que cuesta insistir.
 *
 * La comprobación va **antes** de verificar la firma y antes de abrir el
 * cliente: agotado el presupuesto, un reintento no toca la base ni gasta CPU
 * en criptografía.
 */

/** Ventana en la que todavía merece la pena reintentar un evento. */
export const WEBHOOK_RETRY_WINDOW_MS = 10 * 60_000

export interface RetryBudget {
  /** Edad del evento, o `null` si la cabecera no trae un instante usable. */
  ageMs: number | null
  /** El evento es tan viejo que insistir cuesta más de lo que vale. */
  exhausted: boolean
}

/**
 * Evalúa la cabecera `svix-timestamp` (segundos unix) contra la ventana.
 *
 * Una cabecera ausente o ilegible **no** agota el presupuesto: eso no es un
 * evento viejo sino una petición malformada, y quien debe rechazarla es la
 * verificación de firma. Aquí solo se decide si vale la pena seguir.
 */
export function evaluateRetryBudget(
  svixTimestamp: string | null,
  now: number,
  windowMs: number = WEBHOOK_RETRY_WINDOW_MS
): RetryBudget {
  const seconds = Number(svixTimestamp)

  if (!svixTimestamp || !Number.isFinite(seconds)) {
    return { ageMs: null, exhausted: false }
  }

  // Un reloj adelantado da edad negativa; se trata como reciente, no como
  // agotado, para no descartar eventos legítimos por deriva de reloj.
  const ageMs = now - seconds * 1_000

  return { ageMs, exhausted: ageMs > windowMs }
}
