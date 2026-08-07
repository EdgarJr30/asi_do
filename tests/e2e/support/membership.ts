import {
  cleanupUsers,
  createServiceClient,
  provisionUser,
  realtimeEnvReady,
  type ProvisionedCandidate,
  type ServiceClient,
} from './realtime'

/**
 * Fixtures del pipeline de membresía.
 *
 * Todo lo que estas pruebas necesitan —el solicitante, el pastor con alcance
 * sobre su iglesia, el admin de plataforma, la solicitud y su pago— se crea aquí
 * con `service_role` y se borra al terminar. Antes se esperaban cuentas fijas
 * por variable de entorno (`E2E_PASTOR_EMAIL`, `E2E_ADMIN_EMAIL`…) que nadie
 * define y filas sembradas a mano que ya no existen: las cuatro specs se
 * saltaban siempre, así que la mitad del pipeline no estaba probada.
 *
 * Regla de la casa: las pruebas escriben en el proyecto remoto —no hay otro—,
 * así que cada fixture se lleva lo suyo. `cleanupMembershipFixture` borra en
 * orden inverso al de creación, y borrar el usuario arrastra en cascada sus
 * solicitudes y roles.
 */

export {
  cleanupUsers,
  createServiceClient,
  provisionUser,
  realtimeEnvReady,
}
export type { ProvisionedCandidate, ServiceClient }

/** Estas pruebas solo necesitan la llave de servicio; las cuentas las crean. */
export function membershipEnvReady() {
  return realtimeEnvReady()
}

export async function findUserIdByEmail(admin: ServiceClient, email: string): Promise<string | null> {
  const { data, error } = await admin.from('users').select('id').eq('email', email).maybeSingle()
  if (error) {
    throw error
  }
  return (data?.id as string | undefined) ?? null
}

export interface MemberApplicationRow {
  id: string
  status: string
  category_slug: string
}

export async function fetchMemberApplications(
  admin: ServiceClient,
  userId: string
): Promise<MemberApplicationRow[]> {
  const { data, error } = await admin
    .from('institutional_membership_applications')
    .select('id,status,category_slug')
    .eq('requester_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  return (data ?? []) as MemberApplicationRow[]
}

/** Borra pagos + solicitudes del miembro para dejar el flujo en cero (repetible). */
export async function resetMemberApplications(admin: ServiceClient, userId: string) {
  const apps = await fetchMemberApplications(admin, userId)
  const ids = apps.map((app) => app.id)
  if (ids.length === 0) {
    return
  }
  await admin.from('membership_payments').delete().in('application_id', ids)
  const { error } = await admin.from('institutional_membership_applications').delete().in('id', ids)
  if (error) {
    throw error
  }
}

// ── Iglesias ────────────────────────────────────────────────────────────────

export interface FixtureChurch {
  id: string
  name: string
}

/**
 * Toma iglesias reales de la jerarquía en vez de dar por sentado un nombre.
 *
 * La spec del pastor esperaba "Iglesia Central de Santo Domingo" escrita a mano;
 * si alguien renombra o borra esa fila, la prueba falla por un motivo que no es
 * el que dice medir. Lo que importa es que sean **dos iglesias distintas**, para
 * poder comprobar que un pastor no ve la cola de la otra.
 */
export async function pickChurches(admin: ServiceClient, count: number): Promise<FixtureChurch[]> {
  const { data, error } = await admin
    .from('churches')
    .select('id,name')
    .order('name', { ascending: true })
    .limit(count)
  if (error) {
    throw error
  }
  const churches = (data ?? []) as FixtureChurch[]
  if (churches.length < count) {
    throw new Error(`Se necesitan ${count} iglesias en la jerarquía y hay ${churches.length}.`)
  }
  return churches
}

// ── Cuentas con rol ─────────────────────────────────────────────────────────

/**
 * Admin de plataforma efímero.
 *
 * `platform_admin` y no `platform_owner`: es el rol más acotado que satisface a
 * la vez el guard de la ruta (`membership_payment:verify`) y a
 * `is_platform_admin()`, que es quien autoriza las RPC de revisión y activación.
 */
export async function provisionPlatformAdmin(admin: ServiceClient): Promise<ProvisionedCandidate> {
  const user = await provisionUser(admin, { prefix: 'admin-e2e', fullName: 'Admin E2E' })

  const { data: role, error: roleError } = await admin
    .from('platform_roles')
    .select('id')
    .eq('code', 'platform_admin')
    .maybeSingle<{ id: string }>()
  if (roleError) {
    throw roleError
  }
  if (!role) {
    throw new Error('No existe el rol de plataforma `platform_admin`.')
  }

  const { error } = await admin
    .from('user_platform_roles')
    .insert({ user_id: user.userId, role_id: role.id })
  if (error) {
    throw error
  }

  return user
}

/**
 * Pastor efímero con alcance sobre las iglesias indicadas.
 *
 * `source_request_id` no tiene clave foránea —solo un CHECK sobre el tipo—, así
 * que se genera uno sintético en vez de fabricar una solicitud de autoridad
 * completa: lo que la prueba necesita es el alcance ya concedido, no el trámite
 * que lo concede, que tiene su propia cobertura.
 */
export async function provisionPastor(
  admin: ServiceClient,
  churchIds: string[],
  fullName = 'Pastor E2E'
): Promise<ProvisionedCandidate> {
  const user = await provisionUser(admin, { prefix: 'pastor-e2e', fullName })

  const { error } = await admin.from('user_authority_scopes').insert({
    user_id: user.userId,
    authority_role: 'pastor_administrator',
    scope_type: 'church',
    status: 'active',
    church_ids: churchIds,
    source_request_type: 'pastor_authority_request',
    source_request_id: crypto.randomUUID(),
    granted_at: new Date().toISOString(),
  })
  if (error) {
    throw error
  }

  return user
}

// ── Solicitudes y pagos ─────────────────────────────────────────────────────

export interface SeedApplicationOptions {
  userId: string
  /** Nombre que la prueba busca en pantalla. */
  firstName: string
  lastName: string
  email: string
  status?: 'draft' | 'submitted' | 'under_review' | 'needs_more_info' | 'approved'
  /** Iglesia de la solicitud: el trigger `route_membership_application` la usa
   *  para asignarle pastor y mandarla a su cola. */
  churchId?: string
  churchName?: string
  reviewNotes?: string
  pastoralReferenceStatus?: 'pending' | 'contacted' | 'endorsed' | 'declined' | 'waived'
}

/**
 * Solicitud de membresía en el estado que pida la prueba.
 *
 * Por defecto `under_review` y no `submitted`: el trigger de notificación
 * dispara al ENTRAR en `submitted`, así que sembrar ahí mandaría correos reales
 * a los administradores de producción en cada corrida.
 */
export async function seedApplication(
  admin: ServiceClient,
  options: SeedApplicationOptions
): Promise<string> {
  const {
    userId,
    firstName,
    lastName,
    email,
    status = 'under_review',
    churchId,
    churchName = 'Iglesia Central',
    reviewNotes,
    pastoralReferenceStatus,
  } = options

  const { data, error } = await admin
    .from('institutional_membership_applications')
    .insert({
      requester_user_id: userId,
      status,
      category_slug: 'profesional',
      category_name: 'Profesional',
      dues: 'RD$2,500.00',
      applicant_first_name: firstName,
      applicant_last_name: lastName,
      applicant_email: email,
      applicant_phone: '8090000000',
      pastor_name: 'Pedro Pastor',
      pastor_email: 'pastor@asido.test',
      pastor_phone: '8090000000',
      home_church_name: churchName,
      church_city: 'Santo Domingo',
      church_state_province: 'Distrito Nacional',
      conference_name: 'Asociación Central Dominicana',
      church_id: churchId ?? null,
      review_notes: reviewNotes ?? null,
      submitted_at: new Date().toISOString(),
      // Solo si la prueba lo pide: la columna es NOT NULL con default, así que
      // mandar `null` explícito la rompe en vez de dejar que el default actúe.
      ...(pastoralReferenceStatus ? { pastoral_reference_status: pastoralReferenceStatus } : {}),
    })
    .select('id,assigned_pastor_user_id,assigned_queue')
    .single<{ id: string; assigned_pastor_user_id: string | null; assigned_queue: string }>()
  if (error) {
    throw error
  }
  return data.id
}

/**
 * Comprueba a quién enrutó el trigger. Se llama desde las pruebas del pastor
 * porque `pastor_user_for_church` elige **el alcance activo más antiguo** que
 * cubra la iglesia, y un alcance sin iglesias concretas las cubre todas: si
 * mañana existe uno así, la solicitud se iría a otra cola y la prueba fallaría
 * en un aserto de interfaz sin explicar por qué. Aquí falla diciéndolo.
 */
export async function assertRoutedToPastor(
  admin: ServiceClient,
  applicationId: string,
  pastorUserId: string
) {
  const { data, error } = await admin
    .from('institutional_membership_applications')
    .select('assigned_pastor_user_id,assigned_queue')
    .eq('id', applicationId)
    .single<{ assigned_pastor_user_id: string | null; assigned_queue: string }>()
  if (error) {
    throw error
  }
  if (data.assigned_pastor_user_id !== pastorUserId) {
    throw new Error(
      `La solicitud se enrutó a ${data.assigned_pastor_user_id ?? 'nadie'} (cola ${data.assigned_queue}) ` +
        `en vez de al pastor de la prueba. Revisa si hay un alcance de autoridad activo sin iglesias concretas.`
    )
  }
}

export interface SeedPaymentOptions {
  applicationId: string
  userId: string
  status?: 'initiated' | 'submitted' | 'verified' | 'rejected' | 'failed'
}

export async function seedPayment(admin: ServiceClient, options: SeedPaymentOptions): Promise<string> {
  const { applicationId, userId, status = 'submitted' } = options
  const { data, error } = await admin
    .from('membership_payments')
    .insert({
      application_id: applicationId,
      member_user_id: userId,
      category_slug: 'profesional',
      amount: 2500,
      currency: 'DOP',
      method: 'transfer',
      status,
      // `activate_member` lee el término del último pago verificado y, si viene
      // nulo, se niega a activar con el mensaje "A verified payment is
      // required" —que despista, porque el pago sí está verificado—. La pasarela
      // siempre lo escribe; el fixture también.
      term_months: 12,
      reference_note: 'Pago sembrado por la suite e2e.',
    })
    .select('id')
    .single<{ id: string }>()
  if (error) {
    throw error
  }
  return data.id
}

/**
 * Mueve un pago al estado indicado con `service_role`.
 *
 * Existe porque la consola no puede: `verify_membership_payment` no la llama
 * ningún componente, y el único camino real a `verified` es la liquidación de la
 * pasarela. Esto la imita en un paso, sin fingir una interfaz que no existe.
 */
export async function setPaymentStatus(
  admin: ServiceClient,
  paymentId: string,
  status: 'initiated' | 'submitted' | 'verified' | 'rejected' | 'failed'
) {
  const { error } = await admin.from('membership_payments').update({ status }).eq('id', paymentId)
  if (error) {
    throw error
  }
}

/** Deja el proyecto como estaba: borra las solicitudes y luego las cuentas. */
export async function cleanupMembershipFixture(
  admin: ServiceClient,
  users: Array<ProvisionedCandidate | null | undefined>
) {
  for (const user of users) {
    if (!user) {
      continue
    }
    await resetMemberApplications(admin, user.userId).catch(() => {})
  }
  await cleanupUsers(admin, users)
}
