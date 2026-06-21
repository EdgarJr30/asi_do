import { supabase } from '@/lib/supabase/client'

export interface CandidateDirectorySearchParams {
  tenantId: string
  query?: string
  countryCode?: string
  language?: string
  skill?: string
  limit?: number
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

export async function searchCandidateDirectory(params: CandidateDirectorySearchParams) {
  const client = requireSupabase()
  const response = await (client as typeof client & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('search_candidate_profiles', {
    p_tenant_id: params.tenantId,
    p_query: params.query?.trim() || null,
    p_country_code: params.countryCode?.trim() || null,
    p_language: params.language?.trim() || null,
    p_skill: params.skill?.trim() || null,
    p_limit: params.limit ?? 24
  })

  if (response.error) {
    throw response.error
  }

  return (response.data ?? []) as CandidateDirectoryRow[]
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
