import { createClient } from 'npm:@supabase/supabase-js@2'

import { corsHeaders } from '../_shared/cors.ts'
import { resolveResendConfig } from '../_shared/resend-config.ts'
import { resolveServiceKey } from '../_shared/supabase-keys.ts'
import { processEmailDeliveries } from './process.ts'

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

    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? '20') || 20, 50)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    })

    const result = await processEmailDeliveries({
      database: supabase,
      fetch: (input, init) => fetch(input, init),
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
  }
})
