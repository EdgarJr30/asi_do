import { assertEquals } from 'jsr:@std/assert@1'

import { WEBHOOK_RETRY_WINDOW_MS, evaluateRetryBudget } from './retry-budget.ts'

const now = Date.UTC(2026, 7, 10, 14, 0, 0)

function svixTimestamp(msBefore: number) {
  return String(Math.floor((now - msBefore) / 1000))
}

Deno.test('un evento recién emitido conserva su presupuesto', () => {
  const budget = evaluateRetryBudget(svixTimestamp(5_000), now)

  assertEquals(budget.exhausted, false)
  assertEquals(budget.ageMs, 5_000)
})

Deno.test('un evento dentro de la ventana todavía puede reintentarse', () => {
  const budget = evaluateRetryBudget(svixTimestamp(WEBHOOK_RETRY_WINDOW_MS - 1_000), now)

  assertEquals(budget.exhausted, false)
})

Deno.test('pasada la ventana el presupuesto se agota', () => {
  // El caso del incidente: el proveedor sigue reintentando un evento de hace
  // horas contra una base que no responde. Sin este corte, cada reintento
  // volvía a golpear la base caída.
  const budget = evaluateRetryBudget(svixTimestamp(2 * 60 * 60_000), now)

  assertEquals(budget.exhausted, true)
})

Deno.test('una cabecera ausente o ilegible no agota el presupuesto', () => {
  // No es un evento viejo sino una petición malformada: rechazarla es trabajo
  // de la verificación de firma, no de este corte.
  for (const header of [null, '', 'ayer', 'NaN']) {
    const budget = evaluateRetryBudget(header, now)

    assertEquals(budget.exhausted, false, `cabecera ${JSON.stringify(header)}`)
    assertEquals(budget.ageMs, null)
  }
})

Deno.test('un reloj adelantado no descarta el evento', () => {
  const budget = evaluateRetryBudget(svixTimestamp(-30_000), now)

  assertEquals(budget.exhausted, false)
})
