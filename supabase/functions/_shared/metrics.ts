// Recolector de métricas de latencia/throughput para el arnés de estrés.
// Puro y sin dependencias de runtime (sirve en Deno y Node).

export type LatencySample = {
  // ms transcurridos de la operación individual
  durationMs: number
  ok: boolean
  timedOut: boolean
}

export type MetricsSummary = {
  label: string
  count: number
  ok: number
  errors: number
  timeouts: number
  errorRate: number
  durationsMs: {
    min: number
    p50: number
    p95: number
    p99: number
    max: number
    mean: number
  }
  wallClockMs: number
  // operaciones completadas por segundo respecto al tiempo total de pared
  throughputPerSec: number
  // mensajes de error agrupados (message → cuántas veces ocurrió), top primeros
  errorSamples: { message: string; count: number }[]
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0
  // Método "nearest-rank" sobre muestras ya ordenadas.
  const rank = Math.ceil((p / 100) * sortedAsc.length)
  const index = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1))
  return sortedAsc[index]
}

export class MetricsCollector {
  readonly label: string
  private samples: LatencySample[] = []
  private wallStart = 0
  private wallEnd = 0
  private firstError: string | null = null
  private errorCounts = new Map<string, number>()

  constructor(label: string) {
    this.label = label
  }

  start(): void {
    this.wallStart = Date.now()
  }

  stop(): void {
    this.wallEnd = Date.now()
  }

  record(sample: LatencySample): void {
    this.samples.push(sample)
  }

  noteError(message: string): void {
    if (this.firstError === null) {
      this.firstError = message
    }
    // Normaliza un poco para agrupar errores equivalentes (quita ids/uuids/números largos).
    const normalized = message
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
      .replace(/\b\d{3,}\b/g, '<n>')
      .slice(0, 240)
    this.errorCounts.set(normalized, (this.errorCounts.get(normalized) ?? 0) + 1)
  }

  get firstErrorMessage(): string | null {
    return this.firstError
  }

  summary(): MetricsSummary {
    const durations = this.samples.map((s) => s.durationMs).sort((a, b) => a - b)
    const ok = this.samples.filter((s) => s.ok).length
    const timeouts = this.samples.filter((s) => s.timedOut).length
    const errors = this.samples.length - ok
    const wallClockMs = Math.max(0, (this.wallEnd || Date.now()) - (this.wallStart || Date.now()))
    const sum = durations.reduce((acc, value) => acc + value, 0)

    return {
      label: this.label,
      count: this.samples.length,
      ok,
      errors,
      timeouts,
      errorRate: this.samples.length === 0 ? 0 : errors / this.samples.length,
      durationsMs: {
        min: durations[0] ?? 0,
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
        p99: percentile(durations, 99),
        max: durations[durations.length - 1] ?? 0,
        mean: durations.length === 0 ? 0 : sum / durations.length
      },
      wallClockMs,
      throughputPerSec: wallClockMs === 0 ? 0 : (this.samples.length / wallClockMs) * 1000,
      errorSamples: Array.from(this.errorCounts.entries())
        .map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    }
  }
}

// Ejecuta `tasks` con una concurrencia acotada, cronometrando cada una y
// aplicando un timeout por operación. Devuelve cuando todas terminan.
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  options: { concurrency: number; timeoutMs: number; collector: MetricsCollector }
): Promise<void> {
  const { concurrency, timeoutMs, collector } = options
  let cursor = 0

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= tasks.length) return

      const startedAt = Date.now()
      let timedOut = false
      try {
        await withTimeout(tasks[index](), timeoutMs, () => {
          timedOut = true
        })
        collector.record({ durationMs: Date.now() - startedAt, ok: true, timedOut: false })
      } catch (error) {
        collector.record({ durationMs: Date.now() - startedAt, ok: false, timedOut })
        collector.noteError(error instanceof Error ? error.message : String(error))
      }
    }
  }

  collector.start()
  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker())
  await Promise.all(workers)
  collector.stop()
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout()
      reject(new Error(`timeout after ${timeoutMs}ms`))
    }, timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
