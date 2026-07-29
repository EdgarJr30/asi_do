import { supabase } from '@/lib/supabase/client'

export type CandidateDirectorySort = 'relevance' | 'score' | 'name' | 'experience'

export interface CandidateDirectoryPageParams {
  tenantId: string
  query?: string
  countryCode?: string
  language?: string
  skill?: string
  sort?: CandidateDirectorySort
  /** Limita la búsqueda al banco de talento del workspace (pestaña "Guardados"). */
  savedOnly?: boolean
  limit: number
  offset: number
}

export interface CandidateDirectoryPage {
  rows: CandidateDirectoryRow[]
  totalCount: number
  nextOffset: number | null
}

export interface CandidateDirectoryRow {
  candidate_profile_id: string
  user_id: string
  full_name: string
  display_name: string
  avatar_path: string | null
  headline: string | null
  desired_role: string | null
  city_name: string | null
  country_code: string | null
  summary: string | null
  completeness_score: number
  latest_role_title: string | null
  total_experiences: number
  skill_names: string[]
  language_names: string[]
}

export interface CandidateDirectoryDetail {
  profile: {
    id: string
    user_id: string
    full_name: string
    display_name: string
    email: string
    locale: string | null
    avatar_path: string | null
    headline: string | null
    summary: string | null
    city_name: string | null
    country_code: string | null
    desired_role: string | null
    completeness_score: number
    updated_at: string
  }
  experiences: Array<{
    id: string
    company_name: string
    role_title: string
    employment_type: string | null
    city_name: string | null
    country_code: string | null
    start_date: string
    end_date: string | null
    is_current: boolean
    summary: string | null
  }>
  educations: Array<{
    id: string
    institution_name: string
    degree_name: string
    field_of_study: string | null
    start_date: string | null
    end_date: string | null
    is_current: boolean
    summary: string | null
  }>
  skills: Array<{
    id: string
    skill_name: string
    proficiency_label: string | null
  }>
  languages: Array<{
    id: string
    language_name: string
    proficiency_label: string
  }>
  links: Array<{
    id: string
    link_type: string
    label: string | null
    url: string
  }>
  resumes: Array<{
    id: string
    filename: string
    mime_type: string
    file_size_bytes: number
    is_default: boolean
    created_at: string
  }>
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

export async function searchCandidateDirectoryPage(
  params: CandidateDirectoryPageParams
): Promise<CandidateDirectoryPage> {
  const client = requireSupabase()
  const response = await (client as typeof client & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('search_candidate_profiles', {
    p_tenant_id: params.tenantId,
    p_query: params.query?.trim() || null,
    p_country_code: params.countryCode?.trim() || null,
    p_language: params.language?.trim() || null,
    p_skill: params.skill?.trim() || null,
    p_limit: params.limit,
    p_offset: params.offset,
    p_sort: params.sort ?? 'relevance',
    p_saved_only: params.savedOnly ?? false
  })

  if (response.error) {
    throw response.error
  }

  const rows = (response.data ?? []) as Array<CandidateDirectoryRow & { total_count?: number }>
  const totalCount = rows[0]?.total_count ?? rows.length
  const loadedCount = params.offset + rows.length

  return {
    rows,
    totalCount,
    nextOffset: loadedCount < totalCount ? loadedCount : null
  }
}

export async function fetchCandidateDirectoryDetail(tenantId: string, candidateProfileId: string) {
  const client = requireSupabase()
  const response = await (client as typeof client & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('get_candidate_profile_for_tenant', {
    p_tenant_id: tenantId,
    p_candidate_profile_id: candidateProfileId
  })

  if (response.error) {
    throw response.error
  }

  return response.data as unknown as CandidateDirectoryDetail
}

/**
 * Guarda un candidato en el banco de talento del workspace. El banco es del
 * tenant (lo ve todo el equipo), no del usuario que lo guarda.
 */
export async function saveCandidateToTalentPool(params: {
  tenantId: string
  candidateProfileId: string
  userId: string
}) {
  const client = requireSupabase()
  const { error } = await client.from('talent_pool_entries').insert({
    tenant_id: params.tenantId,
    candidate_profile_id: params.candidateProfileId,
    saved_by_user_id: params.userId
  })

  // 23505: ya estaba guardado (otro miembro del equipo se adelantó). No es error.
  if (error && error.code !== '23505') {
    throw error
  }
}

export async function removeCandidateFromTalentPool(params: {
  tenantId: string
  candidateProfileId: string
}) {
  const client = requireSupabase()
  const { error } = await client
    .from('talent_pool_entries')
    .delete()
    .eq('tenant_id', params.tenantId)
    .eq('candidate_profile_id', params.candidateProfileId)

  if (error) {
    throw error
  }
}

/**
 * Ids de los candidatos guardados por el workspace. Es la fuente de verdad del
 * estado "guardado" en la UI (marca de cada card, badge de la pestaña y toggle
 * del panel de detalle), así no hay dos representaciones que puedan divergir.
 */
export async function fetchTalentPoolCandidateIds(tenantId: string): Promise<string[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('talent_pool_entries')
    .select('candidate_profile_id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map((entry) => entry.candidate_profile_id)
}
