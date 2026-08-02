import { supabase } from '@/lib/supabase/client'
import { extractErrorDetails } from '@/lib/errors/error-utils'
import { collectClientEnvironmentMetadata } from '@/lib/platform/client-environment'

export interface CaptureClientErrorInput {
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
    // La ingesta va por RPC, no por insert directo: el servidor recorta tamaños,
    // redacta PII, deduplica, aplica rate limit y toma el user_id de la sesión
    // en lugar de confiar en el que envíe el cliente.
    const response = await supabase.rpc('log_client_error', {
      p_source: input.source,
      p_error_message: serializedError.errorMessage,
      p_user_message: input.userMessage,
      p_route: input.route ?? undefined,
      p_severity: input.severity ?? 'error',
      p_error_code: serializedError.errorCode ?? undefined,
      p_metadata: {
        ...input.metadata,
        ...serializedError.metadata,
        stack: serializedError.stack,
        clientEnvironment
      }
    })

    // PostgREST devuelve el fallo en `error` en vez de lanzarlo, así que el
    // try/catch no lo veía y un registro roto pasaba inadvertido.
    if (response.error) {
      console.warn('[error-logger] no se pudo registrar el error', response.error.message)
    }
  } catch {
    // Registrar un error nunca debe romper el flujo principal de la UI.
  }
}
