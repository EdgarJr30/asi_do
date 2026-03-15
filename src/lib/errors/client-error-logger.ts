import { supabase } from '@/lib/supabase/client'

interface CaptureClientErrorInput {
  source: string
  route?: string | null
  userId?: string | null
  userMessage: string
  error: unknown
  severity?: 'info' | 'warning' | 'error' | 'fatal'
  metadata?: Record<string, unknown>
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      errorCode: error.name,
      errorMessage: error.message,
      stack: error.stack ?? null
    }
  }

  if (typeof error === 'string') {
    return {
      errorCode: 'Error',
      errorMessage: error,
      stack: null
    }
  }

  return {
    errorCode: 'UnknownError',
    errorMessage: 'Unexpected non-error value captured.',
    stack: null
  }
}

export async function captureClientError(input: CaptureClientErrorInput) {
  if (!supabase) {
    return
  }

  const serializedError = serializeError(input.error)

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
        stack: serializedError.stack,
        userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent
      }
    })
  } catch {
    // Logging must never break the main UX flow.
  }
}
