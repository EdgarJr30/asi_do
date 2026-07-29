import { supabase } from '@/lib/supabase/client'
import { toControlledError } from '@/lib/errors/error-utils'

export interface PlatformOpsSnapshot {
  activeTenants: number
  openModerationCases: number
  pendingRecruiterRequests: number
  activeSubscriptions: number
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

export interface TenantSubscriptionRecord {
  id: string
  tenant_id: string
  plan_id: string
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'ended'
  seat_count: number
  starts_at: string
  ends_at: string | null
  tenant: {
    id: string
    name: string
    slug: string
  } | null
  plan: {
    id: string
    code: string
    name: string
  } | null
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

export async function listTenantSubscriptions() {
  const client = requireSupabase()
  const response = await client
    .from('tenant_subscriptions' as never)
    .select(
      `
        *,
        tenant:tenants!tenant_subscriptions_tenant_id_fkey (
          id,
          name,
          slug
        ),
        plan:subscription_plans!tenant_subscriptions_plan_id_fkey (
          id,
          code,
          name
        )
      `
    )
    .order('starts_at', { ascending: false })
    .limit(12)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return (response.data ?? []) as TenantSubscriptionRecord[]
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
