import { createClient } from '@supabase/supabase-js'

import { loadLocalEnv } from './env'
import { ALLOWED_REMOTE_E2E_PROJECT_REFS, assertSafeMutatingE2ETarget } from './target-guard'

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
  // La llave pública, la misma que usa el navegador. Solo la necesita la prueba
  // de recuperación de contraseña, que canjea el token del enlace como lo haría
  // un visitante: con `service_role` el canje pasaría por alto justo la parte
  // que se quiere verificar.
  anonKey: process.env.E2E_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
  // Dueño de la vacante de prueba. Vacío = se descubre de la base al arrancar
  // (ver `resolveJobPublisher`); las variables existen para fijarlo a propósito.
  tenantId: process.env.E2E_REALTIME_TENANT_ID ?? '',
  companyProfileId: process.env.E2E_REALTIME_COMPANY_PROFILE_ID ?? '',
  candidatePassword: process.env.E2E_REALTIME_PASSWORD ?? 'RealtimeTest!2026',
  targetEnvironment: process.env.E2E_TARGET_ENV ?? '',
  productionProjectRef: process.env.PRODUCTION_SUPABASE_PROJECT_REF ?? ''
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
  assertSafeMutatingE2ETarget({
    allowedRemoteProjectRefs: ALLOWED_REMOTE_E2E_PROJECT_REFS,
    e2eSupabaseUrl: realtimeConfig.supabaseUrl,
    productionProjectRef: realtimeConfig.productionProjectRef,
    targetEnvironment: realtimeConfig.targetEnvironment
  })

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

/** Host del proyecto contra el que corre la suite, para los mensajes. */
function targetHost() {
  try {
    return new URL(realtimeConfig.supabaseUrl).host
  } catch {
    return realtimeConfig.supabaseUrl || '(sin URL)'
  }
}

/**
 * Presupuesto de una llamada de administración.
 *
 * Muy por debajo de los 90 s del `beforeAll` **a propósito**: si el proyecto no
 * responde, lo que tiene que llegar al log es el diagnóstico, no el timeout del
 * hook. Un hook agotado apunta a la línea del `beforeAll` y no distingue el
 * remoto caído del secreto mal puesto ni del trigger que no disparó.
 */
export const ADMIN_CALL_TIMEOUT_MS = 20_000

/**
 * Corre una llamada de administración con presupuesto propio.
 *
 * Nace de una corrida real: el 2026-08-10 el API admin del proyecto dejó de
 * responder y las 3 pruebas autenticadas murieron con
 * `"beforeAll" hook timeout of 90000ms exceeded` apuntando a la línea del hook.
 * Medido después a mano, `createUser` tardó **147 s** y devolvió un error vacío
 * (`{}`). Con ese material no se puede decidir si hay que mirar el proyecto, el
 * secreto o el producto.
 *
 * Es la misma lección que dejó el flake de DNS: el instrumento no veía el caso
 * en que la causa no era del producto, que es justo cuando más falta hace.
 */
export async function withAdminTimeout<T>(label: string, run: () => PromiseLike<T>): Promise<T> {
  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      run(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              [
                `El proyecto Supabase no respondió a "${label}" en ${ADMIN_CALL_TIMEOUT_MS / 1000} s.`,
                `Objetivo: ${targetHost()}.`,
                'No es un fallo del producto ni de la prueba: la API de administración no contestó.',
                'Compruébalo con:',
                `  curl -s -o /dev/null -w "%{http_code} %{time_total}s\\n" --max-time 30 \\`,
                `    "${realtimeConfig.supabaseUrl}/auth/v1/admin/users?per_page=1" \\`,
                '    -H "apikey: $KEY" -H "Authorization: Bearer $KEY"',
                'Si eso también cuelga, el proyecto está caído o degradado; reintentar la suite no arregla nada.'
              ].join('\n')
            )
          )
        }, ADMIN_CALL_TIMEOUT_MS)
      })
    ])
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('El proyecto Supabase no respondió')) {
      throw error
    }
    throw explainAdminError(error, { label, elapsedMs: Date.now() - started })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Traduce un fallo de credenciales a algo accionable.
 *
 * Con la llave mal configurada, supabase-js lanza `AuthApiError: Invalid API
 * key` desde dentro del `beforeAll`: un stack que apunta a `auth-js` y no dice
 * ni qué variable revisar ni contra qué proyecto falló. Averiguarlo costó una
 * corrida de CI entera, así que el diagnóstico se queda escrito aquí.
 */
export function explainAdminError(error: unknown, context?: { label: string; elapsedMs: number }): unknown {
  const status = (error as { status?: unknown } | null)?.status
  const message = (error as { message?: unknown } | null)?.message
  const looksLikeBadKey =
    status === 401 || (typeof message === 'string' && /invalid api key|no api key/i.test(message))

  if (!looksLikeBadKey) {
    // Un error sin mensaje utilizable llega al reporte como `{}` y no dice
    // nada: pasó de verdad el 2026-08-10, cuando el API admin devolvió un
    // objeto vacío tras 147 s. Se sustituye por algo que al menos nombre la
    // operación, el objetivo y lo que tardó.
    const hasUsableMessage = typeof message === 'string' && message.trim().length > 0
    if (!hasUsableMessage && context) {
      return new Error(
        [
          `"${context.label}" falló contra ${targetHost()} sin mensaje utilizable`,
          `tras ${Math.round(context.elapsedMs / 1000)} s.`,
          `Error crudo: ${JSON.stringify(error)}.`,
          'Un error opaco del API de administración suele ser el proyecto degradado, no la prueba.'
        ].join(' ')
      )
    }
    return error
  }

  const host = targetHost()

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

export interface ProvisionUserOptions {
  /** Prefijo del correo, para reconocer de qué prueba salió una cuenta huérfana. */
  prefix?: string
  /** Nombre visible. Varias pruebas lo buscan en pantalla, así que importa. */
  fullName?: string
  /** Acceso ASI sin pasar por el pipeline de membresía. Por defecto, sí. */
  withAsiAccess?: boolean
  /**
   * Onboarding base ya completado. Por defecto sí, porque casi toda la suite
   * quiere entrar a la aplicación y no al asistente. Ponlo en `false` para
   * probar justo el asistente y a dónde sale.
   */
  withBaseOnboarding?: boolean
}

/**
 * Cuenta temporal lista para usar la aplicación: correo confirmado, onboarding
 * base completo y, salvo que se pida lo contrario, acceso ASI.
 *
 * Es la base de todas las cuentas de la suite. Los roles —pastor, admin— se
 * montan encima en `support/membership.ts`, porque son filas de otras tablas y
 * no todas las pruebas los necesitan.
 */
export async function provisionUser(
  admin: ServiceClient,
  options: ProvisionUserOptions = {}
): Promise<ProvisionedCandidate> {
  const { prefix = 'rt-e2e', fullName = 'Realtime E2E', withAsiAccess = true, withBaseOnboarding = true } = options
  // El sufijo aleatorio evita colisiones entre pruebas que arrancan en el mismo
  // milisegundo; el correo tiene que ser único en `auth.users`.
  const email = `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@asido.test`
  const password = realtimeConfig.candidatePassword

  const { data: created, error: createError } = await withAdminTimeout('createUser', () =>
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })
  )
  if (createError) {
    throw explainAdminError(createError, { label: 'createUser', elapsedMs: 0 })
  }
  const userId = created.user.id

  // El trigger de sync crea la fila public.users en el alta; esperamos a verla.
  let synced = false
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data } = await withAdminTimeout('select public.users', () =>
      admin.from('users').select('id').eq('id', userId).maybeSingle()
    )
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
      manual_access_override_until: withAsiAccess ? overrideUntil : null,
      // Onboarding base completado. Sin estos cuatro campos, `RequireAuth`
      // desvía cualquier ruta autenticada a /account/profile
      // (`hasCompletedBaseOnboarding`), así que la cuenta recién creada no podía
      // llegar al job board ni al home: las pruebas medían el asistente de
      // onboarding creyendo que medían otra cosa.
      //
      // Se completa solo el mínimo del gate. El *perfil de candidato* sigue
      // vacío a propósito: es lo que hace visible el aviso "Completa tu perfil"
      // y lo que mantiene a la cuenta representando a un usuario nuevo.
      //
      // Con `withBaseOnboarding: false` se deja el perfil como el de un recién
      // registrado ("New user" sin país), que es lo que hace aparecer el
      // asistente.
      full_name: withBaseOnboarding ? fullName : 'New user',
      display_name: withBaseOnboarding ? fullName : 'New user',
      locale: 'es',
      country_code: withBaseOnboarding ? 'DO' : null
    })
    .eq('id', userId)
  if (grantError) {
    throw grantError
  }

  return { userId, email, password }
}

/**
 * Crea un candidato temporal con acceso ASI (vía `manual_access_override_until`,
 * que saltea el pipeline de membresía) para poder ver el job board en la prueba.
 */
export function provisionRealtimeCandidate(admin: ServiceClient): Promise<ProvisionedCandidate> {
  return provisionUser(admin)
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
  await cleanupUsers(admin, [candidate])
}

/** Motivo legible de un rechazo, venga como `Error` o como cualquier otra cosa. */
function describeCleanupCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/**
 * Borra cuentas de prueba. Nunca lanza: se llama desde `afterAll`, y si una
 * limpieza falla queremos ver el fallo real de la prueba, no el de la limpieza.
 * Lo que sí importa es que se intenten todas aunque una falle.
 *
 * Pero no lanzar no es lo mismo que callar. El `catch` vacío que había aquí
 * hacía que una cuenta quedara viva en el proyecto remoto **sin dejar rastro**:
 * el 2026-08-10 apareció `rt-e2e+…@asido.test` con una hora de antigüedad y no
 * hubo forma de saber si el borrado falló o si la corrida se interrumpió antes
 * del `afterAll`. Ahora el fallo se nombra —correo, id y motivo— para que la
 * próxima vez la diferencia se pueda leer.
 */
export async function cleanupUsers(
  admin: ServiceClient,
  users: Array<ProvisionedCandidate | null | undefined>
) {
  for (const user of users) {
    if (!user) {
      continue
    }
    const { error } = await withAdminTimeout('deleteUser', () => admin.auth.admin.deleteUser(user.userId)).catch(
      (cause: unknown) => ({ error: { message: describeCleanupCause(cause) } })
    )
    if (error) {
      console.warn(`[cleanup] no se pudo borrar ${user.email} (${user.userId}): ${error.message}`)
    }
  }
}
