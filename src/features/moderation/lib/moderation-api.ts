import { supabase } from '@/lib/supabase/client'
import { toControlledError } from '@/lib/errors/error-utils'

export interface ModerationCaseRecord {
  id: string
  entity_type: string
  entity_id: string
  tenant_id: string | null
  status: 'open' | 'under_review' | 'resolved' | 'dismissed'
  severity: 'low' | 'medium' | 'high' | 'critical'
  reason: string
  opened_by_user_id: string
  assigned_to_user_id: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
  actions?: ModerationActionRecord[]
}

export interface ModerationActionRecord {
  id: string
  moderation_case_id: string
  action_type: 'note' | 'warn' | 'close_job' | 'suspend_tenant' | 'restore_tenant' | 'dismiss_case'
  actor_user_id: string
  note: string | null
  payload: Record<string, unknown>
  created_at: string
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

export async function listModerationCases() {
  const client = requireSupabase()
  const response = await client
    .from('moderation_cases' as never)
    .select(
      `
        *,
        actions:moderation_actions (
          id,
          moderation_case_id,
          action_type,
          actor_user_id,
          note,
          payload,
          created_at
        )
      `
    )
    .order('created_at', { ascending: false })
    .limit(24)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return (response.data ?? []) as ModerationCaseRecord[]
}

export type ModerationStatusFilter = 'open' | 'resolved' | 'all'

export interface ModerationCasePage {
  rows: ModerationCaseRecord[]
  totalCount: number
  nextOffset: number | null
}

/**
 * Paginación real de servidor para los casos de moderación vía `range` + count
 * exacto de PostgREST, filtrando por estado en el backend para el scroll infinito.
 */
export async function listModerationCasesPage(params: {
  filter: ModerationStatusFilter
  limit: number
  offset: number
}): Promise<ModerationCasePage> {
  const client = requireSupabase()
  let query = client
    .from('moderation_cases' as never)
    .select(
      `
        *,
        actions:moderation_actions (
          id,
          moderation_case_id,
          action_type,
          actor_user_id,
          note,
          payload,
          created_at
        )
      `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1)

  if (params.filter === 'open') {
    query = query.in('status', ['open', 'under_review'] as never)
  } else if (params.filter === 'resolved') {
    query = query.in('status', ['resolved', 'dismissed'] as never)
  }

  const response = await query

  if (response.error) {
    throw toControlledError(response.error)
  }

  const rows = (response.data ?? []) as ModerationCaseRecord[]
  const totalCount = response.count ?? rows.length
  const loadedCount = params.offset + rows.length

  return {
    rows,
    totalCount,
    nextOffset: loadedCount < totalCount ? loadedCount : null
  }
}

export async function openModerationCase(input: {
  entityType: string
  entityId: string
  tenantId?: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  reason: string
}) {
  const client = requireSupabase()
  const response = await client.rpc('open_moderation_case' as never, {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_tenant_id: input.tenantId ?? null,
    p_reason: input.reason.trim(),
    p_severity: input.severity,
    p_metadata: {}
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as ModerationCaseRecord
}

export async function applyModerationAction(input: {
  caseId: string
  actionType: ModerationActionRecord['action_type']
  note?: string
}) {
  const client = requireSupabase()
  const response = await client.rpc('apply_moderation_action' as never, {
    p_case_id: input.caseId,
    p_action_type: input.actionType,
    p_note: input.note?.trim() || null
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as ModerationCaseRecord
}
