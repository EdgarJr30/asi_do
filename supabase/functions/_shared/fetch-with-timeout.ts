export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

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
