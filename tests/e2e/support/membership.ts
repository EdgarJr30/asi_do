import {
  createServiceClient,
  realtimeEnvReady,
  type ServiceClient,
} from './realtime'

/**
 * Soporte para las pruebas e2e del pipeline de membresía. Reusa el cliente
 * `service_role` de `realtime.ts` (que carga `.env.local` automáticamente) para
 * dejar el estado del solicitante en cero y así correr el flujo de forma repetible.
 */

export { createServiceClient, realtimeEnvReady }
export type { ServiceClient }

export const membershipConfig = {
  applicantEmail: process.env.E2E_APPLICANT_EMAIL ?? '',
  applicantPassword: process.env.E2E_APPLICANT_PASSWORD ?? 'Applicant123!',
}

export function membershipEnvReady() {
  return Boolean(membershipConfig.applicantEmail && realtimeEnvReady())
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

/**
 * Inserta una solicitud "viva" mínima para probar el guard anti-duplicado.
 * Usa `under_review` a propósito: el trigger de notificación solo dispara al ENTRAR
 * en `submitted`, así que sembrar `under_review` NO envía correos a los admins reales,
 * pero cuenta como solicitud viva (redirige `/membership/apply` → panel de estado).
 */
export async function seedLiveApplication(admin: ServiceClient, userId: string): Promise<string> {
  const { data, error } = await admin
    .from('institutional_membership_applications')
    .insert({
      requester_user_id: userId,
      status: 'under_review',
      category_slug: 'retired',
      category_name: 'Profesional o Empresario Jubilado',
      dues: 'DOP 9,000',
      applicant_first_name: 'Ana',
      applicant_last_name: 'Solicitante',
      applicant_email: membershipConfig.applicantEmail,
      applicant_phone: '8090000000',
      pastor_name: 'Pedro Pastor',
      pastor_email: 'pastor@asido.test',
      pastor_phone: '8090000000',
      home_church_name: 'Iglesia Central',
      church_city: 'Santo Domingo',
      church_state_province: 'Distrito Nacional',
      conference_name: 'Asociación Central Dominicana',
    })
    .select('id')
    .single()
  if (error) {
    throw error
  }
  return data.id as string
}
