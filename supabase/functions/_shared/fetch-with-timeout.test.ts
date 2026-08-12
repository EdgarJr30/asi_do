import { assertEquals, assertRejects } from 'jsr:@std/assert@1'

import { fetchWithTimeout } from './fetch-with-timeout.ts'

Deno.test('fetchWithTimeout aborta una frontera remota que excede su presupuesto', async () => {
  let observedSignal: AbortSignal | undefined
  const slowFetch = (_input: string | URL | Request, init?: RequestInit) => {
    observedSignal = init?.signal ?? undefined
    return new Promise<Response>((_resolve, reject) => {
      observedSignal?.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')))
    })
  }

  await assertRejects(
    () => fetchWithTimeout(slowFetch, 5)('https://example.test'),
    DOMException,
    'timeout'
  )
  assertEquals(observedSignal?.aborted, true)
})
