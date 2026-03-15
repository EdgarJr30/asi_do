import { supabase } from '@/lib/supabase/client'
import { extractErrorDetails } from '@/lib/errors/error-utils'
import { collectClientEnvironmentMetadata } from '@/lib/platform/client-environment'

interface CaptureClientErrorInput {
  source: string
  route?: string | null
  userId?: string | null
  userMessage: string
  error: unknown
  severity?: 'info' | 'warning' | 'error' | 'fatal'
  metadata?: Record<string, unknown>
}

export async function captureClientError(input: CaptureClientErrorInput) {
  if (!supabase) {
    return
  }

  const serializedError = extractErrorDetails(input.error)
  const clientEnvironment = await collectClientEnvironmentMetadata()

  try {
    await supabase.from('app_error_logs').insert({
      user_id: input.userId ?? null,
      route: input.route ?? null,
      source: input.source,
      severity: input.severity ?? 'error',
      error_code: serializedError.errorCode,
      error_message: serializedError.errorMessage,
      user_message: input.userMessage,
      metadata: {
        ...input.metadata,
        ...serializedError.metadata,
        stack: serializedError.stack,
        clientEnvironment
      }
    })
  } catch {
    // Logging must never break the main UX flow.
  }
}
