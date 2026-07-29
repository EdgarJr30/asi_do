import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/shared/types/database'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

export async function fetchPipelineBoard(tenantId: string) {
  const client = requireSupabase()
  const [stagesResponse, applicationsResponse] = await Promise.all([
    client
      .from('pipeline_stages')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order('position', { ascending: true }),
    client
      .from('applications')
      .select(
        `
          *,
          job_posting:job_postings!applications_job_posting_id_fkey (
            id,
            title,
            slug,
            tenant_id
          ),
          candidate_profile:candidate_profiles!applications_candidate_profile_id_fkey (
            id,
            desired_role,
            city_name,
            country_code,
            user:users!candidate_profiles_user_id_fkey (
              id,
              full_name,
              display_name,
              email,
              avatar_path
            )
          ),
          application_notes (
            id,
            body,
            created_at
          ),
          application_ratings (
            id,
            score,
            created_at
          )
        `
      )
      .eq('job_posting.tenant_id', tenantId)
      .order('submitted_at', { ascending: false })
  ])

  if (stagesResponse.error) {
    throw stagesResponse.error
  }

  if (applicationsResponse.error) {
    throw applicationsResponse.error
  }

  return {
    stages: stagesResponse.data ?? [],
    applications: applicationsResponse.data ?? []
  }
}

export type PipelineBoard = Awaited<ReturnType<typeof fetchPipelineBoard>>
export type PipelineBoardApplication = PipelineBoard['applications'][number]

type NestedUser = {
  full_name: string | null
  display_name: string | null
  email: string | null
  avatar_path: string | null
} | null
type NestedCandidateProfile = { user: NestedUser | NestedUser[] } | null

/** Extrae el usuario anidado del postulante, tolerando objeto o arreglo. */
function applicationUser(application: PipelineBoardApplication): NestedUser {
  const candidateProfile = application.candidate_profile as
    | NestedCandidateProfile
    | NestedCandidateProfile[]
    | undefined
  const profile = Array.isArray(candidateProfile) ? candidateProfile[0] : candidateProfile
  return (Array.isArray(profile?.user) ? profile?.user[0] : profile?.user) ?? null
}

export function applicationAvatarPath(application: PipelineBoardApplication): string | null {
  return applicationUser(application)?.avatar_path ?? null
}

/**
 * Identidad vigente del candidato: el join a `users` manda porque el usuario
 * puede haber cambiado su nombre después de postular. Los snapshots de la
 * postulación se mantienen sincronizados por trigger y quedan como respaldo
 * para cuando RLS no permite leer al usuario.
 */
export function applicationCandidateName(application: PipelineBoardApplication): string {
  const user = applicationUser(application)
  return user?.display_name ?? user?.full_name ?? application.candidate_display_name_snapshot
}

export function applicationCandidateEmail(application: PipelineBoardApplication): string | null {
  return applicationUser(application)?.email ?? application.candidate_email_snapshot ?? null
}

/** Solo las etapas del pipeline del tenant (para mapear nombres sin traer todo el board). */
export async function listTenantPipelineStages(tenantId: string) {
  const client = requireSupabase()
  const response = await client
    .from('pipeline_stages')
    .select('id, name')
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order('position', { ascending: true })

  if (response.error) {
    throw response.error
  }

  return response.data ?? []
}

export async function moveApplicationStage(input: {
  applicationId: string
  toStageId: string
  note?: string
}) {
  const client = requireSupabase()
  const response = await (client as typeof client & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('move_application_stage', {
    p_application_id: input.applicationId,
    p_to_stage_id: input.toStageId,
    p_note: input.note?.trim() || null
  })

  if (response.error) {
    throw response.error
  }

  return response.data as Tables<'applications'>
}

export async function addApplicationNote(input: {
  applicationId: string
  authorUserId: string
  body: string
}) {
  const client = requireSupabase()
  const response = await client
    .from('application_notes')
    .insert({
      application_id: input.applicationId,
      author_user_id: input.authorUserId,
      body: input.body.trim()
    })
    .select('*')
    .single()

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function upsertApplicationRating(input: {
  applicationId: string
  authorUserId: string
  score: number
}) {
  const client = requireSupabase()
  const response = await client
    .from('application_ratings')
    .upsert(
      {
        application_id: input.applicationId,
        author_user_id: input.authorUserId,
        score: input.score
      },
      {
        onConflict: 'application_id,author_user_id'
      }
    )
    .select('*')
    .single()

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function fetchApplicationActivity(applicationId: string) {
  const client = requireSupabase()
  const [historyResponse, notesResponse, ratingsResponse] = await Promise.all([
    client
      .from('application_stage_history')
      .select(
        `
          *,
          from_stage:pipeline_stages!application_stage_history_from_stage_id_fkey (
            id,
            name
          ),
          to_stage:pipeline_stages!application_stage_history_to_stage_id_fkey (
            id,
            name
          )
        `
      )
      .eq('application_id', applicationId)
      .order('changed_at', { ascending: false }),
    client
      .from('application_notes')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false }),
    client
      .from('application_ratings')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
  ])

  if (historyResponse.error) {
    throw historyResponse.error
  }

  if (notesResponse.error) {
    throw notesResponse.error
  }

  if (ratingsResponse.error) {
    throw ratingsResponse.error
  }

  return {
    history: historyResponse.data ?? [],
    notes: notesResponse.data ?? [],
    ratings: ratingsResponse.data ?? []
  }
}
