import { assertAlmostEquals, assertEquals } from 'jsr:@std/assert@1'

import { MetricsCollector, runWithConcurrency } from './metrics.ts'

function collectorWith(durations: number[], ok = true) {
  const collector = new MetricsCollector('prueba')
  collector.start()
  for (const durationMs of durations) {
    collector.record({ durationMs, ok, timedOut: false })
  }
  collector.stop()

  return collector
}

// Estas metricas son las que sustentan las mediciones de rendimiento del
// checklist. Un percentil mal calculado no falla de forma visible: da un numero
// creible y equivocado, y las decisiones se toman sobre el.
Deno.test('percentiles por nearest-rank sobre 1..100', () => {
  const durations = Array.from({ length: 100 }, (_, i) => i + 1)
  const summary = collectorWith(durations).summary()

  assertEquals(summary.durationsMs.min, 1)
  assertEquals(summary.durationsMs.max, 100)
  assertEquals(summary.durationsMs.p50, 50)
  assertEquals(summary.durationsMs.p95, 95)
  assertEquals(summary.durationsMs.p99, 99)
  assertAlmostEquals(summary.durationsMs.mean, 50.5)
})

Deno.test('ordena antes de calcular: el orden de llegada no cambia el resultado', () => {
  const ordenado = collectorWith([10, 20, 30, 40, 50]).summary()
  const desordenado = collectorWith([50, 10, 40, 20, 30]).summary()

  assertEquals(desordenado.durationsMs.p50, ordenado.durationsMs.p50)
  assertEquals(desordenado.durationsMs.min, 10)
  assertEquals(desordenado.durationsMs.max, 50)
})

Deno.test('sin muestras no divide por cero', () => {
  const summary = new MetricsCollector('vacio').summary()

  assertEquals(summary.count, 0)
  assertEquals(summary.errorRate, 0)
  assertEquals(summary.durationsMs.p95, 0)
  assertEquals(summary.durationsMs.mean, 0)
  assertEquals(summary.throughputPerSec, 0)
})

Deno.test('la tasa de error cuenta fallos y timeouts', () => {
  const collector = new MetricsCollector('mixto')
  collector.start()
  collector.record({ durationMs: 10, ok: true, timedOut: false })
  collector.record({ durationMs: 20, ok: false, timedOut: false })
  collector.record({ durationMs: 30, ok: false, timedOut: true })
  collector.stop()

  const summary = collector.summary()

  assertEquals(summary.count, 3)
  assertEquals(summary.ok, 1)
  assertEquals(summary.errors, 2)
  assertEquals(summary.timeouts, 1)
  assertAlmostEquals(summary.errorRate, 2 / 3, 0.0001)
})

Deno.test('agrupa errores equivalentes normalizando uuids y numeros largos', () => {
  const collector = new MetricsCollector('errores')
  collector.noteError('fallo en la fila 550e8400-e29b-41d4-a716-446655440000')
  collector.noteError('fallo en la fila 6ba7b810-9dad-11d1-80b4-00c04fd430c8')
  collector.noteError('timeout tras 12345 ms')
  collector.noteError('timeout tras 67890 ms')

  const summary = collector.summary()

  // Sin normalizar, cuatro errores distintos; normalizados, dos grupos de dos.
  assertEquals(summary.errorSamples.length, 2)
  assertEquals(summary.errorSamples[0].count, 2)
  assertEquals(summary.errorSamples[1].count, 2)
})

Deno.test('conserva el primer error tal cual, sin normalizar', () => {
  const collector = new MetricsCollector('errores')
  collector.noteError('el primero, con id 550e8400-e29b-41d4-a716-446655440000')
  collector.noteError('el segundo')

  assertEquals(collector.firstErrorMessage, 'el primero, con id 550e8400-e29b-41d4-a716-446655440000')
})

Deno.test('runWithConcurrency respeta el tope y ejecuta todas las tareas', async () => {
  let enVuelo = 0
  let maxEnVuelo = 0
  let completadas = 0

  const tasks = Array.from({ length: 20 }, () => async () => {
    enVuelo += 1
    maxEnVuelo = Math.max(maxEnVuelo, enVuelo)
    await new Promise((resolve) => setTimeout(resolve, 5))
    enVuelo -= 1
    completadas += 1
  })

  const collector = new MetricsCollector('concurrencia')
  collector.start()
  await runWithConcurrency(tasks, { concurrency: 4, timeoutMs: 1000, collector })
  collector.stop()

  assertEquals(completadas, 20)
  assertEquals(maxEnVuelo <= 4, true, `se superó el tope: ${maxEnVuelo}`)
  assertEquals(collector.summary().count, 20)
})

Deno.test('runWithConcurrency marca timeout sin colgarse', async () => {
  const tasks = [
    () => new Promise<void>((resolve) => setTimeout(resolve, 500)),
    () => Promise.resolve()
  ]

  const collector = new MetricsCollector('timeout')
  collector.start()
  await runWithConcurrency(tasks, { concurrency: 2, timeoutMs: 25, collector })
  collector.stop()

  const summary = collector.summary()

  assertEquals(summary.count, 2)
  assertEquals(summary.timeouts, 1)
})
