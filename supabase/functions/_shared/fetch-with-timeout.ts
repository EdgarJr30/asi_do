export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

/**
 * Presupuesto de tiempo para una frontera remota que **no** pasa por `fetch` y
 * por tanto no acepta un `AbortSignal` —el SDK de web-push, por ejemplo—.
 *
 * No cancela el trabajo de fondo, que no es cancelable: corta la *espera*. Eso
 * basta para lo que importa, que es no quedarse colgado del fallo de otro.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.()
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

/**
 * Impone un presupuesto local a una frontera HTTP. No reintenta: quien recibe
 * el error conserva la decisión de reencolar con su clave idempotente.
 */
export function fetchWithTimeout(baseFetch: FetchLike, timeoutMs: number): FetchLike {
  return async (input, init = {}) => {
    const controller = new AbortController()
    const upstreamSignal = init.signal
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason)

    if (upstreamSignal?.aborted) {
      abortFromUpstream()
    } else {
      upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true })
    }

    const timeout = setTimeout(
      () => controller.abort(new DOMException('timeout', 'AbortError')),
      timeoutMs
    )

    try {
      return await baseFetch(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timeout)
      upstreamSignal?.removeEventListener('abort', abortFromUpstream)
    }
  }
}
