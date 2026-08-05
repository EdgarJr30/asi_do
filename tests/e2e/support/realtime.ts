import { createClient } from '@supabase/supabase-js'

import { loadLocalEnv } from './env'

/**
 * Soporte para la prueba e2e de datos en vivo (Supabase Realtime).
 *
 * Esta suite necesita el `service_role` para simular cambios "de otra empresa"
 * en la BD. Por seguridad NO se ejecuta a menos que el entorno esté configurado;
 * `realtimeEnvReady()` decide el skip. En local, los valores se toman de
 * `.env.local` automáticamente; en CI, de variables de entorno reales.
 */

loadLocalEnv()

export const realtimeConfig = {
  supabaseUrl: process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
  serviceRoleKey: process.env.E2E_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  // Tenant/empresa semilla ("Empresa Demo") usados como dueños de la vacante de prueba.
  tenantId: process.env.E2E_REALTIME_TENANT_ID ?? 'ac2fe711-a642-4010-b6ee-5b67fe0a8937',
  companyProfileId: process.env.E2E_REALTIME_COMPANY_PROFILE_ID ?? '3f26fb90-5089-4b4e-b31e-5d280a0c1034',
  candidatePassword: process.env.E2E_REALTIME_PASSWORD ?? 'RealtimeTest!2026'
}

export function realtimeEnvReady() {
  return Boolean(realtimeConfig.supabaseUrl && realtimeConfig.serviceRoleKey)
}

export function createServiceClient() {
  return createClient(realtimeConfig.supabaseUrl, realtimeConfig.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export type ServiceClient = ReturnType<typeof createServiceClient>

/** `role` de una llave legacy, para distinguir la `service_role` de la `anon`. */
function legacyJwtRole(key: string) {
  try {
    const payload: unknown = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'))
    const role = (payload as { role?: unknown }).role
    return typeof role === 'string' ? role : null
  } catch {
    return null
  }
}

/**
 * Describe la llave configurada SIN exponer su valor: solo prefijo y longitud.
 *
 * Basta para separar los tres errores que ocurren de verdad —llave vacía, la
 * publishable pegada en su lugar, o la legacy de un proyecto que ya migró a las
 * API keys nuevas— sin volcar un secreto al log de CI, que es público.
 */
function describeServiceRoleKey() {
  const key = realtimeConfig.serviceRoleKey

  if (!key) {
    return 'está vacía'
  }
  if (key.startsWith('sb_secret_')) {
    return `es una secret key nueva (sb_secret_…, ${key.length} chars), así que apunta a otro proyecto o fue rotada`
  }
  if (key.startsWith('sb_publishable_')) {
    return 'es la publishable key (sb_publishable_…), no la secret'
  }
  if (key.split('.').length === 3) {
    const role = legacyJwtRole(key)
    return `es una JWT legacy${role ? ` (role=${role})` : ''}, y este proyecto usa las API keys nuevas`
  }
  return `tiene un formato no reconocido (${key.length} chars)`
}

/**
 * Traduce un fallo de credenciales a algo accionable.
 *
 * Con la llave mal configurada, supabase-js lanza `AuthApiError: Invalid API
 * key` desde dentro del `beforeAll`: un stack que apunta a `auth-js` y no dice
 * ni qué variable revisar ni contra qué proyecto falló. Averiguarlo costó una
 * corrida de CI entera, así que el diagnóstico se queda escrito aquí.
 */
export function explainAdminError(error: unknown): unknown {
  const status = (error as { status?: unknown } | null)?.status
  const message = (error as { message?: unknown } | null)?.message
  const looksLikeBadKey =
    status === 401 || (typeof message === 'string' && /invalid api key|no api key/i.test(message))

  if (!looksLikeBadKey) {
    return error
  }

  let host = realtimeConfig.supabaseUrl
  try {
    host = new URL(realtimeConfig.supabaseUrl).host
  } catch {
    host = realtimeConfig.supabaseUrl || '(sin URL)'
  }

  return new Error(
    [
      `Supabase rechazó las credenciales de administrador contra ${host}: "${String(message)}".`,
      `La llave de E2E_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY ${describeServiceRoleKey()}.`,
      'Debe ser la secret key del mismo proyecto que E2E_SUPABASE_URL.',
      'En CI se configura en Settings → Secrets and variables → Actions; en local, en .env.local.'
    ].join('\n')
  )
}

export interface ProvisionedCandidate {
  userId: string
  email: string
  password: string
}

/**
 * Crea un candidato temporal con acceso ASI (vía `manual_access_override_until`,
 * que saltea el pipeline de membresía) para poder ver el job board en la prueba.
 */
export async function provisionRealtimeCandidate(admin: ServiceClient): Promise<ProvisionedCandidate> {
  const email = `rt-e2e+${Date.now()}@asido.test`
  const password = realtimeConfig.candidatePassword

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Realtime E2E' }
  })
  if (createError) {
    throw explainAdminError(createError)
  }
  const userId = created.user.id

  // El trigger de sync crea la fila public.users en el alta; esperamos a verla.
  let synced = false
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data } = await admin.from('users').select('id').eq('id', userId).maybeSingle()
    if (data) {
      synced = true
      break
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
  }
  if (!synced) {
    throw new Error('La fila public.users no se creó tras el alta del usuario de prueba.')
  }

  const overrideUntil = new Date(Date.now() + 1000 * 60 * 60).toISOString() // +1h
  const { error: grantError } = await admin
    .from('users')
    .update({ status: 'active', manual_access_override_until: overrideUntil })
    .eq('id', userId)
  if (grantError) {
    throw grantError
  }

  return { userId, email, password }
}

export async function cleanupRealtimeCandidate(admin: ServiceClient, candidate: ProvisionedCandidate | null) {
  if (!candidate) {
    return
  }
  await admin.auth.admin.deleteUser(candidate.userId).catch(() => {})
}
