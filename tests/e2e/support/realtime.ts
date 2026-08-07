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
  // Dueño de la vacante de prueba. Vacío = se descubre de la base al arrancar
  // (ver `resolveJobPublisher`); las variables existen para fijarlo a propósito.
  tenantId: process.env.E2E_REALTIME_TENANT_ID ?? '',
  companyProfileId: process.env.E2E_REALTIME_COMPANY_PROFILE_ID ?? '',
  candidatePassword: process.env.E2E_REALTIME_PASSWORD ?? 'RealtimeTest!2026'
}

export function realtimeEnvReady() {
  return Boolean(realtimeConfig.supabaseUrl && realtimeConfig.serviceRoleKey)
}

/**
 * En CI, entorno ausente es un fallo, no un skip.
 *
 * El skip existe para el portátil de quien no tiene el `service_role` a mano.
 * En CI significa otra cosa: que el secreto se borró, se renombró o llegó
 * vacío, y entonces la corrida termina en verde sin haber probado la mitad que
 * importa. Ese "verde" es peor que un rojo, porque nadie lo mira. Se comprueba
 * al importar el módulo para que ningún call site pueda saltárselo.
 */
if (!realtimeEnvReady() && process.env.CI) {
  throw new Error(
    [
      'Faltan E2E_SUPABASE_URL y/o E2E_SERVICE_ROLE_KEY en CI.',
      `Recibido: URL ${realtimeConfig.supabaseUrl ? 'presente' : 'vacía'}, service_role ${realtimeConfig.serviceRoleKey ? 'presente' : 'vacía'}.`,
      'Fuera de CI la suite se salta sin ruido; aquí no, porque un skip dejaría la corrida verde sin ejecutar las pruebas autenticadas.',
      'Configúralos en Settings → Secrets and variables → Actions.'
    ].join('\n')
  )
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
    .update({
      status: 'active',
      manual_access_override_until: overrideUntil,
      // Onboarding base completado. Sin estos cuatro campos, `RequireAuth`
      // desvía cualquier ruta autenticada a /account/profile
      // (`hasCompletedBaseOnboarding`), así que la cuenta recién creada no podía
      // llegar al job board ni al home: las pruebas medían el asistente de
      // onboarding creyendo que medían otra cosa.
      //
      // Se completa solo el mínimo del gate. El *perfil de candidato* sigue
      // vacío a propósito: es lo que hace visible el aviso "Completa tu perfil"
      // y lo que mantiene a la cuenta representando a un usuario nuevo.
      full_name: 'Realtime E2E',
      display_name: 'Realtime E2E',
      locale: 'es',
      country_code: 'DO'
    })
    .eq('id', userId)
  if (grantError) {
    throw grantError
  }

  return { userId, email, password }
}

export type JobPublisher = {
  tenantId: string
  companyProfileId: string
  /** Título de una vacante ya publicada, para saber que el board cargó. */
  baselineTitle: string
}

/**
 * Averigua bajo qué empresa publicar la vacante de la prueba, leyéndolo de la
 * base en vez de darlo por sabido.
 *
 * Antes había dos UUID incrustados aquí (la "Empresa Demo" semilla) y un título
 * de vacante literal en la prueba. Las tres filas ya no existen en el proyecto,
 * así que la prueba fallaba en el primer aserto —el board no mostraba la
 * vacante esperada— y su INSERT habría muerto después por clave foránea. Ese
 * fallo no dice nada del producto: dice que alguien borró unos datos de ejemplo
 * hace meses.
 *
 * Descubrirlo tiene además la propiedad que se quiere: la prueba comprueba que
 * el board **muestra lo que hay publicado**, sea lo que sea, y no que exista
 * una fila concreta.
 */
export async function resolveJobPublisher(admin: ServiceClient): Promise<JobPublisher | null> {
  const { data, error } = await admin
    .from('job_postings')
    .select('title, tenant_id, company_profile_id')
    .eq('status', 'published')
    .not('company_profile_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ title: string; tenant_id: string; company_profile_id: string }>()

  if (error) {
    throw error
  }
  if (!data) {
    return null
  }

  return {
    tenantId: realtimeConfig.tenantId || data.tenant_id,
    companyProfileId: realtimeConfig.companyProfileId || data.company_profile_id,
    baselineTitle: data.title
  }
}

export async function cleanupRealtimeCandidate(admin: ServiceClient, candidate: ProvisionedCandidate | null) {
  if (!candidate) {
    return
  }
  await admin.auth.admin.deleteUser(candidate.userId).catch(() => {})
}
