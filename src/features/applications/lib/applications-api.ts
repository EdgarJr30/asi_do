import { toControlledError } from '@/lib/errors/error-utils'
import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/shared/types/database'
import {
  applicationStatusesForFilter,
  type ApplicationFilter,
  type PublicApplicationStatus
} from '@/features/applications/lib/application-overview-filters'

export interface ApplicationAnswerDraft {
  screeningQuestionId: string
  answerText?: string
  answerJson?: Record<string, unknown> | null
}

export interface ListMyApplicationsPageInput {
  userId: string
  limit: number
  offset: number
  filter?: ApplicationFilter
  query?: string
}

export interface CountMyApplicationsInput {
  userId: string
  query?: string
}

const MY_APPLICATIONS_SELECT = `
  *,
  job_posting:job_postings!applications_job_posting_id_fkey (
    id,
    title,
    slug,
    employment_type,
    workplace_type,
    city_name,
    country_code,
    company_profile:company_profiles!job_postings_company_profile_id_fkey (
      display_name,
      logo_path
    )
  )
`

const emptyApplicationCounts = { all: 0, sent: 0, review: 0, hired: 0 }

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

async function getCandidateProfileId(userId: string) {
  const client = requireSupabase()
  const profileResponse = await client.from('candidate_profiles').select('id').eq('user_id', userId).maybeSingle()

  if (profileResponse.error) {
    throw profileResponse.error
  }

  return profileResponse.data?.id ?? null
}

async function findJobPostingIdsForApplicationSearch(query: string) {
  const client = requireSupabase()
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return null
  }

  const pattern = `%${normalizedQuery}%`
  const titleResponse = await client.from('job_postings').select('id').ilike('title', pattern).limit(500)

  if (titleResponse.error) {
    throw titleResponse.error
  }

  const companyResponse = await client.from('company_profiles').select('id').ilike('display_name', pattern).limit(200)

  if (companyResponse.error) {
    throw companyResponse.error
  }

  const matchingIds = new Set((titleResponse.data ?? []).map((job) => job.id))
  const companyIds = (companyResponse.data ?? []).map((company) => company.id)

  if (companyIds.length > 0) {
    const companyJobsResponse = await client.from('job_postings').select('id').in('company_profile_id', companyIds).limit(500)

    if (companyJobsResponse.error) {
      throw companyJobsResponse.error
    }

    for (const job of companyJobsResponse.data ?? []) {
      matchingIds.add(job.id)
    }
  }

  return Array.from(matchingIds)
}

function applyApplicationFilter<
  TQuery extends {
    in: (column: string, values: string[]) => TQuery
  }
>(query: TQuery, filter: ApplicationFilter) {
  const statuses = applicationStatusesForFilter(filter)

  return statuses ? query.in('status_public', statuses) : query
}

export async function submitApplication(input: {
  jobPostingId: string
  submittedResumeId?: string | null
  coverLetter?: string
  answers: ApplicationAnswerDraft[]
}) {
  const client = requireSupabase()
  const response = await (client as typeof client & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('submit_application', {
    p_job_posting_id: input.jobPostingId,
    p_submitted_resume_id: input.submittedResumeId ?? null,
    p_cover_letter: input.coverLetter?.trim() || null,
    p_answers: input.answers.map((answer) => ({
      screening_question_id: answer.screeningQuestionId,
      answer_text: answer.answerText?.trim() || null,
      answer_json: answer.answerJson ?? null
    }))
  })

  if (response.error) {
    throw response.error
  }

  return response.data as Tables<'applications'>
}

export async function updateApplicationResume(input: {
  applicationId: string
  submittedResumeId: string
}) {
  const client = requireSupabase()
  const response = await (client as typeof client & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('update_application_resume', {
    p_application_id: input.applicationId,
    p_submitted_resume_id: input.submittedResumeId
  })

  if (response.error) {
    throw response.error
  }

  return response.data as Tables<'applications'>
}

export async function listMyApplications(userId: string) {
  const client = requireSupabase()
  const candidateProfileId = await getCandidateProfileId(userId)

  if (!candidateProfileId) {
    return []
  }

  const response = await client
    .from('applications')
    .select(MY_APPLICATIONS_SELECT)
    .eq('candidate_profile_id', candidateProfileId)
    .order('submitted_at', { ascending: false })

  if (response.error) {
    throw response.error
  }

  return response.data ?? []
}

export async function listMyApplicationsPage(input: ListMyApplicationsPageInput) {
  const client = requireSupabase()
  const candidateProfileId = await getCandidateProfileId(input.userId)
  const limit = Math.max(1, input.limit)
  const offset = Math.max(0, input.offset)

  if (!candidateProfileId) {
    return { applications: [], totalCount: 0, nextOffset: null }
  }

  const matchingJobIds = await findJobPostingIdsForApplicationSearch(input.query ?? '')

  if (matchingJobIds && matchingJobIds.length === 0) {
    return { applications: [], totalCount: 0, nextOffset: null }
  }

  let query = client
    .from('applications')
    .select(MY_APPLICATIONS_SELECT, { count: 'exact' })
    .eq('candidate_profile_id', candidateProfileId)

  query = applyApplicationFilter(query, input.filter ?? 'all')

  if (matchingJobIds) {
    query = query.in('job_posting_id', matchingJobIds)
  }

  const response = await query
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (response.error) {
    throw response.error
  }

  const totalCount = response.count ?? 0
  const nextOffset = offset + limit < totalCount ? offset + limit : null

  return {
    applications: response.data ?? [],
    totalCount,
    nextOffset
  }
}

export async function countMyApplications(input: CountMyApplicationsInput) {
  const client = requireSupabase()
  const candidateProfileId = await getCandidateProfileId(input.userId)

  if (!candidateProfileId) {
    return emptyApplicationCounts
  }

  const profileId = candidateProfileId
  const matchingJobIds = await findJobPostingIdsForApplicationSearch(input.query ?? '')

  if (matchingJobIds && matchingJobIds.length === 0) {
    return emptyApplicationCounts
  }

  async function countFor(filter: ApplicationFilter) {
    let query = client
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_profile_id', profileId)

    query = applyApplicationFilter(query, filter)

    if (matchingJobIds) {
      query = query.in('job_posting_id', matchingJobIds)
    }

    const response = await query

    if (response.error) {
      throw response.error
    }

    return response.count ?? 0
  }

  const [all, sent, review, hired] = await Promise.all([
    countFor('all'),
    countFor('sent'),
    countFor('review'),
    countFor('hired')
  ])

  return { all, sent, review, hired }
}

export type TenantApplicationsSort = 'recent' | 'oldest' | 'name'

/**
 * Posición de la última fila servida. El servidor la devuelve y el cliente la
 * reenvía tal cual: es la clave de orden (fecha o nombre) más el `id` como
 * desempate, no un número de página.
 */
export interface TenantApplicationsCursor {
  submitted_at: string
  name: string
  id: string
}

export interface ListTenantApplicationsPageInput {
  tenantId: string
  limit: number
  /** `null` = primera página; después, el `nextCursor` de la anterior. */
  cursor?: TenantApplicationsCursor | null
  /** '' = sin filtro; de lo contrario un `application_public_status`. */
  status?: string
  query?: string
  sort?: TenantApplicationsSort
}

export interface TenantApplicationRow {
  id: string
  candidate_display_name_snapshot: string
  candidate_email_snapshot: string | null
  candidate_profile_id: string
  current_stage_id: string | null
  status_public: PublicApplicationStatus
  submitted_at: string
  job_posting: { id: string; title: string; slug: string; tenant_id: string } | null
  candidate_profile: {
    id: string
    user: {
      id: string
      full_name: string | null
      display_name: string | null
      email: string | null
      avatar_path: string | null
    } | null
  } | null
}

/**
 * Identidad vigente del candidato. Los snapshots de `applications` se mantienen
 * sincronizados por trigger, pero el join a `users` es la fuente de verdad y se
 * prefiere; el snapshot queda como respaldo si RLS no deja leer al usuario.
 */
export interface CandidateIdentity {
  name: string
  email: string | null
}

export function resolveCandidateIdentity(application: {
  candidate_display_name_snapshot?: string | null
  candidate_email_snapshot?: string | null
  candidate_profile?: {
    user?: { full_name?: string | null; display_name?: string | null; email?: string | null } | null
  } | null
}): CandidateIdentity {
  const user = application.candidate_profile?.user
  const name = user?.display_name ?? user?.full_name ?? application.candidate_display_name_snapshot ?? ''
  const email = user?.email ?? application.candidate_email_snapshot ?? null

  return { name, email }
}

export interface TenantApplicationsPage {
  applications: TenantApplicationRow[]
  /** Solo llega en la primera página; la vista conserva el de `pages[0]`. */
  totalCount: number | null
  nextCursor: TenantApplicationsCursor | null
}

export interface TenantApplicationStats {
  total: number
  interviewing: number
  recent7d: number
  byStatus: Record<string, number>
}

/**
 * Postulaciones del workspace, paginadas con keyset en el servidor.
 *
 * Antes el scoping por tenant se resolvía trayendo hasta 2000 vacantes y
 * armando un `in (…)` con sus ids: pasado ese techo las postulaciones de las
 * vacantes sobrantes desaparecían del listado sin ningún error. La RPC hace el
 * join directo por `tenant_id`, así que no hay techo, y el cursor evita que el
 * coste crezca con la profundidad del scroll.
 */
export async function listTenantApplicationsPage(input: ListTenantApplicationsPageInput): Promise<TenantApplicationsPage> {
  const client = requireSupabase()
  const response = await client.rpc('tenant_applications_page' as never, {
    p_tenant_id: input.tenantId,
    p_status: input.status || null,
    p_query: input.query?.trim() || null,
    p_sort: input.sort ?? 'recent',
    p_limit: Math.max(1, input.limit),
    p_cursor: input.cursor ?? null
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  const snapshot = response.data as unknown as {
    rows: TenantApplicationRow[]
    next_cursor: TenantApplicationsCursor | null
    page: { total_count: number | null }
  }

  return {
    applications: snapshot.rows ?? [],
    totalCount: snapshot.page?.total_count ?? null,
    nextCursor: snapshot.next_cursor ?? null
  }
}

/**
 * Métricas globales del tenant (total, en entrevista, últimos 7 días) y conteo
 * por estado, resueltas con una sola agregación en vez de siete conteos.
 */
export async function countTenantApplications(tenantId: string): Promise<TenantApplicationStats> {
  const client = requireSupabase()
  const response = await client.rpc('tenant_applications_stats' as never, {
    p_tenant_id: tenantId
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  const stats = response.data as unknown as {
    total: number
    recent7d: number
    interviewing: number
    by_status: Record<string, number>
  }

  return {
    total: stats.total ?? 0,
    recent7d: stats.recent7d ?? 0,
    interviewing: stats.interviewing ?? 0,
    byStatus: stats.by_status ?? {}
  }
}

function toCsvCell(value: string | null | undefined) {
  const normalized = (value ?? '').replaceAll('"', '""')
  return `"${normalized}"`
}

export function exportApplicationsCsv(
  applications: Array<{
    candidate_display_name_snapshot?: string | null
    candidate_email_snapshot?: string | null
    submitted_at?: string | null
    status_public?: string | null
    current_stage_id?: string | null
    job_posting?: { title?: string | null } | null
    candidate_profile?: {
      desired_role?: string | null
      user?: { full_name?: string | null; display_name?: string | null; email?: string | null } | null
    } | null
  }>,
  stageNameById?: Record<string, string>
) {
  const header = [
    'candidate_name',
    'candidate_email',
    'desired_role',
    'job_title',
    'status_public',
    'stage',
    'submitted_at'
  ]

  const rows = applications.map((application) => {
    const candidate = resolveCandidateIdentity(application)

    return [
      candidate.name,
      candidate.email ?? '',
      application.candidate_profile?.desired_role ?? '',
      application.job_posting?.title ?? '',
      application.status_public ?? '',
      application.current_stage_id ? stageNameById?.[application.current_stage_id] ?? application.current_stage_id : '',
      application.submitted_at ?? ''
    ]
      .map((value) => toCsvCell(value))
      .join(',')
  })

  const csv = [header.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `applications-export-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
