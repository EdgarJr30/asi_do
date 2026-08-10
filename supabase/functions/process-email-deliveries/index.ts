import { createClient } from 'npm:@supabase/supabase-js@2'

import { corsHeaders } from '../_shared/cors.ts'
import { resolveResendConfig } from '../_shared/resend-config.ts'
import { resolveServiceKey } from '../_shared/supabase-keys.ts'
import { fetchWithTimeout } from '../_shared/fetch-with-timeout.ts'
import { processEmailDeliveries } from './process.ts'

export const MAX_DELIVERIES_PER_RUN = 20
export const DATABASE_REQUEST_TIMEOUT_MS = 8_000
export const PROVIDER_REQUEST_TIMEOUT_MS = 15_000

/**
 * Shell HTTP: autentica al llamante, resuelve la configuración del entorno y
 * delega en `processEmailDeliveries`. Todo lo que decide a quién se le envía
 * un correo vive en `process.ts`, que sí es ejecutable desde un test.
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return 'Unexpected email processor error.'
}

Deno.serve(async (req) => {
  let leaseToken = ''
  let releaseLease: (() => Promise<void>) | null = null

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const secret = Deno.env.get('EMAIL_PROCESSOR_SECRET') ?? ''
    const providedSecret = req.headers.get('x-email-processor-secret') ?? ''

    if (!secret || providedSecret !== secret) {
      return jsonResponse({ error: 'Unauthorized.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = resolveServiceKey()
    const { apiKey: resendApiKey, fromAddress: fromEmail } = resolveResendConfig((name) => Deno.env.get(name))
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
    }

    const body = (await req.json().catch(() => ({}))) as { leaseToken?: unknown }
    leaseToken = typeof body.leaseToken === 'string' ? body.leaseToken : ''

    const requestedLimit = Number(new URL(req.url).searchParams.get('limit') ?? MAX_DELIVERIES_PER_RUN)
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : MAX_DELIVERIES_PER_RUN, 1),
      MAX_DELIVERIES_PER_RUN
    )
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      },
      global: { fetch: fetchWithTimeout(fetch, DATABASE_REQUEST_TIMEOUT_MS) }
    })
    if (leaseToken) {
      releaseLease = async () => {
        const release = await supabase.rpc('release_email_dispatch_lease', {
          p_lease_token: leaseToken
        })
        if (release.error) {
          console.error('Email dispatcher lease could not be released.', {
            errorCode: release.error.code
          })
        }
      }
    }

    const result = await processEmailDeliveries({
      database: supabase,
      fetch: fetchWithTimeout(fetch, PROVIDER_REQUEST_TIMEOUT_MS),
      resendApiKey,
      fromEmail,
      appUrl,
      limit
    })

    return jsonResponse(result)
  } catch (error) {
    return jsonResponse(
      {
        error: toErrorMessage(error)
      },
      500
    )
  } finally {
    if (releaseLease) {
      try {
        await releaseLease()
      } catch {
        // El lease vence solo. No se prolonga la caída intentando liberarlo.
      }
    }
  }
})
