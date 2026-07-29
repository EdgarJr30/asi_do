import { supabase } from '@/lib/supabase/client'
import { toControlledError } from '@/lib/errors/error-utils'

export interface PlatformOpsSnapshot {
  activeTenants: number
  openModerationCases: number
  pendingRecruiterRequests: number
  /** Membresías vigentes: la "suscripción" real de la plataforma. */
  activeMemberships: number
  /** Membresías vencidas dentro del periodo de gracia. */
  membershipsInGrace: number
  /** Membresías vigentes que vencen en los próximos 30 días. */
  membershipsExpiringSoon: number
  pendingEmailHooks: number
  featureFlagsEnabled: number
}

/** Adopción real de una categoría de membresía (los "planes" de la plataforma). */
export interface MembershipPlanAdoption {
  /** Miembros con la solicitud aprobada en esa categoría. */
  approved: number
  /** Solicitudes en curso (enviadas o en revisión). */
  inReview: number
}

/** Una membresía vigente (o en gracia) con la categoría en la que está inscrita. */
export interface MembershipSubscriptionRecord {
  userId: string
  fullName: string
  email: string | null
  status: 'active' | 'grace_period'
  activatedAt: string | null
  expiresAt: string | null
  categorySlug: string | null
  categoryName: string | null
}

export interface FeatureFlagRecord {
  id: string
  code: string
  scope_type: 'global' | 'plan' | 'tenant'
  scope_id: string | null
  is_enabled: boolean
  description: string
  metadata: Record<string, unknown>
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

export async function fetchPlatformOpsSnapshot() {
  const client = requireSupabase()
  const response = await client.rpc('platform_ops_snapshot' as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return (response.data ?? {}) as PlatformOpsSnapshot
}

/**
 * Cuántos miembros/solicitudes tiene cada categoría de membresía. Se consulta con
 * `count: 'exact'` por categoría para no traer filas al cliente.
 */
export async function fetchMembershipPlanAdoption(categorySlugs: string[]) {
  const client = requireSupabase()

  const entries = await Promise.all(
    categorySlugs.map(async (slug) => {
      const [approvedResponse, inReviewResponse] = await Promise.all([
        client
          .from('institutional_membership_applications')
          .select('id', { count: 'exact', head: true })
          .eq('category_slug', slug)
          .eq('status', 'approved'),
        client
          .from('institutional_membership_applications')
          .select('id', { count: 'exact', head: true })
          .eq('category_slug', slug)
          .in('status', ['submitted', 'under_review', 'needs_more_info'])
      ])

      if (approvedResponse.error) {
        throw toControlledError(approvedResponse.error)
      }
      if (inReviewResponse.error) {
        throw toControlledError(inReviewResponse.error)
      }

      return [slug, { approved: approvedResponse.count ?? 0, inReview: inReviewResponse.count ?? 0 }] as const
    })
  )

  return Object.fromEntries(entries) as Record<string, MembershipPlanAdoption>
}

/**
 * Membresías vigentes y en gracia, la que vence primero de última. La categoría vive en
 * la solicitud aprobada, así que se resuelve en una segunda consulta acotada a esos
 * usuarios (PostgREST no puede unir users → applications en sentido inverso).
 */
export async function listMembershipSubscriptions(limit = 25) {
  const client = requireSupabase()

  const membersResponse = await client
    .from('users')
    .select('id, full_name, email, asi_membership_status, membership_activated_at, membership_expires_at')
    .in('asi_membership_status', ['active', 'grace_period'])
    .order('membership_expires_at', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (membersResponse.error) {
    throw toControlledError(membersResponse.error)
  }

  const members = membersResponse.data ?? []
  if (members.length === 0) {
    return [] as MembershipSubscriptionRecord[]
  }

  const applicationsResponse = await client
    .from('institutional_membership_applications')
    .select('requester_user_id, category_slug, category_name')
    .eq('status', 'approved')
    .in(
      'requester_user_id',
      members.map((member) => member.id)
    )

  if (applicationsResponse.error) {
    throw toControlledError(applicationsResponse.error)
  }

  const categoryByUserId = new Map(
    (applicationsResponse.data ?? []).flatMap((application) =>
      application.requester_user_id
        ? [[application.requester_user_id, { slug: application.category_slug, name: application.category_name }] as const]
        : []
    )
  )

  return members.map((member) => {
    const category = categoryByUserId.get(member.id) ?? null

    return {
      userId: member.id,
      fullName: member.full_name,
      email: member.email,
      status: member.asi_membership_status as MembershipSubscriptionRecord['status'],
      activatedAt: member.membership_activated_at,
      expiresAt: member.membership_expires_at,
      categorySlug: category?.slug ?? null,
      categoryName: category?.name ?? null
    }
  }) satisfies MembershipSubscriptionRecord[]
}

export async function listFeatureFlags() {
  const client = requireSupabase()
  const response = await client
    .from('feature_flags' as never)
    .select('*')
    .order('code', { ascending: true })

  if (response.error) {
    throw toControlledError(response.error)
  }

  return (response.data ?? []) as FeatureFlagRecord[]
}

export async function updateFeatureFlag(input: { id: string; isEnabled: boolean }) {
  const client = requireSupabase()
  const response = await client
    .from('feature_flags' as never)
    .update({
      is_enabled: input.isEnabled
    } as never)
    .eq('id', input.id)
    .select('*')
    .single()

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as FeatureFlagRecord
}
