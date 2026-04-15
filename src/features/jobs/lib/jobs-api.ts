import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/shared/types/database'

interface JobPostingQueryRow extends Tables<'job_postings'> {
  company_profile: Pick<Tables<'company_profiles'>, 'display_name' | 'logo_path' | 'industry'> | null
  saved_jobs?: Array<Pick<Tables<'saved_jobs'>, 'id' | 'candidate_profile_id' | 'job_posting_id'>> | null
}

export interface JobPostingBundle {
  jobs: JobPostingQueryRow[]
  savedJobIds: string[]
}

export interface JobAlertDraft {
  label: string
  frequency: string
  query?: string
  workplaceType?: string
  countryCode?: string
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

export async function listPublicJobs(input?: {
  query?: string
  workplaceType?: Tables<'job_postings'>['workplace_type']
  countryCode?: string
  candidateProfileId?: string | null
}) {
  const client = requireSupabase()
  let query = client
    .from('job_postings')
    .select(
      `
        *,
        company_profile:company_profiles!job_postings_company_profile_id_fkey (
          display_name,
          logo_path,
          industry
        ),
        saved_jobs (
          id,
          candidate_profile_id,
          job_posting_id
        )
      `
    )
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (input?.workplaceType) {
    query = query.eq('workplace_type', input.workplaceType)
  }

  if (input?.countryCode) {
    query = query.eq('country_code', input.countryCode.toUpperCase())
  }

  if (input?.query?.trim()) {
    const normalized = input.query.trim()
    query = query.or(
      `title.ilike.%${normalized}%,summary.ilike.%${normalized}%,description.ilike.%${normalized}%,experience_level.ilike.%${normalized}%`
    )
  }

  const response = await query

  if (response.error) {
    throw response.error
  }

  const jobs = (response.data ?? []) as unknown as JobPostingQueryRow[]

  return {
    jobs,
    savedJobIds:
      input?.candidateProfileId
        ? jobs
            .filter((job) => job.saved_jobs?.some((savedJob) => savedJob.candidate_profile_id === input.candidateProfileId))
            .map((job) => job.id)
        : []
  } satisfies JobPostingBundle
}

export async function listTenantJobs(tenantId: string) {
  const client = requireSupabase()
  const response = await client
    .from('job_postings')
    .select(
      `
        *,
        company_profile:company_profiles!job_postings_company_profile_id_fkey (
          display_name,
          logo_path,
          industry
        )
      `
    )
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })

  if (response.error) {
    throw response.error
  }

  return (response.data ?? []) as unknown as JobPostingQueryRow[]
}

export async function listOpportunityStageTemplates(opportunityType: Tables<'opportunity_stage_templates'>['opportunity_type']) {
  const client = requireSupabase()
  const response = await client
    .from('opportunity_stage_templates')
    .select('*')
    .eq('opportunity_type', opportunityType)
    .order('position', { ascending: true })

  if (response.error) {
    throw response.error
  }

  return response.data ?? []
}

export async function getPublicJobBySlug(slug: string, candidateProfileId?: string | null) {
  const client = requireSupabase()
  const response = await client
    .from('job_postings')
    .select(
      `
        *,
        company_profile:company_profiles!job_postings_company_profile_id_fkey (
          display_name,
          logo_path,
          industry,
          description,
          website_url
        ),
        job_screening_questions (*),
        saved_jobs (
          id,
          candidate_profile_id,
          job_posting_id
        )
      `
    )
    .eq('slug', slug)
    .maybeSingle()

  if (response.error) {
    throw response.error
  }

  const job = response.data as
    | (JobPostingQueryRow & {
        job_screening_questions: Tables<'job_screening_questions'>[] | null
        company_profile:
          | (Pick<Tables<'company_profiles'>, 'display_name' | 'logo_path' | 'industry' | 'description' | 'website_url'>)
          | null
      })
    | null

  if (!job) {
    return null
  }

  return {
    ...job,
    isSaved: candidateProfileId
      ? job.saved_jobs?.some((savedJob) => savedJob.candidate_profile_id === candidateProfileId) ?? false
      : false
  }
}

export async function createOrUpdateJobPosting(input: {
  tenantId: string
  companyProfileId: string
  actorUserId: string
  jobId?: string
  opportunityType: Tables<'job_postings'>['opportunity_type']
  title: string
  slug: string
  summary: string
  description: string
  workplaceType: Tables<'job_postings'>['workplace_type']
  employmentType: Tables<'job_postings'>['employment_type']
  cityName?: string
  countryCode?: string
  compensationVisible: boolean
  compensationType: Tables<'job_postings'>['compensation_type']
  compensationMinAmount?: number | null
  compensationMaxAmount?: number | null
  compensationCurrency?: string
  opportunityMetadata?: Record<string, string | null>
  experienceLevel?: string
  expiresAt?: string
  questions: Array<{
    questionText: string
    answerType: Tables<'job_screening_questions'>['answer_type']
    helperText?: string
    isRequired: boolean
    optionsJson: string[]
  }>
}) {
  const client = requireSupabase()
  const payload = {
    tenant_id: input.tenantId,
    company_profile_id: input.companyProfileId,
    created_by_user_id: input.actorUserId,
    opportunity_type: input.opportunityType,
    title: input.title,
    slug: input.slug,
    summary: input.summary,
    description: input.description,
    workplace_type: input.workplaceType,
    employment_type: input.employmentType,
    city_name: input.cityName || null,
    country_code: input.countryCode?.toUpperCase() || null,
    compensation_type: input.compensationType,
    compensation_min_amount: input.compensationVisible ? input.compensationMinAmount ?? null : null,
    compensation_max_amount: input.compensationVisible ? input.compensationMaxAmount ?? null : null,
    compensation_currency: input.compensationVisible ? input.compensationCurrency?.toUpperCase() || null : null,
    opportunity_metadata: input.opportunityMetadata ?? {},
    salary_visible: input.compensationVisible && input.compensationType === 'salary',
    salary_min_amount: input.compensationVisible && input.compensationType === 'salary' ? input.compensationMinAmount ?? null : null,
    salary_max_amount: input.compensationVisible && input.compensationType === 'salary' ? input.compensationMaxAmount ?? null : null,
    salary_currency:
      input.compensationVisible && input.compensationType === 'salary' ? input.compensationCurrency?.toUpperCase() || null : null,
    experience_level: input.experienceLevel || null,
    expires_at: input.expiresAt || null
  }

  const response = input.jobId
    ? await client.from('job_postings').update(payload).eq('id', input.jobId).select('*').single()
    : await client.from('job_postings').insert(payload).select('*').single()

  if (response.error) {
    throw response.error
  }

  const job = response.data

  const deleteQuestionsResponse = await client.from('job_screening_questions').delete().eq('job_posting_id', job.id)

  if (deleteQuestionsResponse.error) {
    throw deleteQuestionsResponse.error
  }

  if (input.questions.length > 0) {
    const insertQuestionsResponse = await client.from('job_screening_questions').insert(
      input.questions.map((question, index) => ({
        job_posting_id: job.id,
        question_text: question.questionText,
        answer_type: question.answerType,
        helper_text: question.helperText || null,
        is_required: question.isRequired,
        options_json: question.optionsJson,
        sort_order: index
      }))
    )

    if (insertQuestionsResponse.error) {
      throw insertQuestionsResponse.error
    }
  }

  return job
}

export async function updateJobPostingStatus(input: {
  jobId: string
  status: Tables<'job_postings'>['status']
}) {
  const client = requireSupabase()
  const response = await client.from('job_postings').update({ status: input.status }).eq('id', input.jobId).select('*').single()

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function toggleSavedJob(input: {
  candidateProfileId: string
  jobPostingId: string
  shouldSave: boolean
}) {
  const client = requireSupabase()

  if (input.shouldSave) {
    const response = await client.from('saved_jobs').insert({
      candidate_profile_id: input.candidateProfileId,
      job_posting_id: input.jobPostingId
    })

    if (response.error) {
      throw response.error
    }

    return
  }

  const response = await client
    .from('saved_jobs')
    .delete()
    .eq('candidate_profile_id', input.candidateProfileId)
    .eq('job_posting_id', input.jobPostingId)

  if (response.error) {
    throw response.error
  }
}

export async function fetchSavedJobs(candidateProfileId: string) {
  const client = requireSupabase()
  const response = await client
    .from('saved_jobs')
    .select(
      `
        id,
        created_at,
        job_posting:job_postings!saved_jobs_job_posting_id_fkey (
          *,
          company_profile:company_profiles!job_postings_company_profile_id_fkey (
            display_name,
            logo_path,
            industry
          )
        )
      `
    )
    .eq('candidate_profile_id', candidateProfileId)
    .order('created_at', { ascending: false })

  if (response.error) {
    throw response.error
  }

  return response.data ?? []
}

export async function listJobAlerts(candidateProfileId: string) {
  const client = requireSupabase()
  const response = await client
    .from('job_alerts')
    .select('*')
    .eq('candidate_profile_id', candidateProfileId)
    .order('created_at', { ascending: false })

  if (response.error) {
    throw response.error
  }

  return response.data ?? []
}

export async function createJobAlert(input: {
  candidateProfileId: string
  alert: JobAlertDraft
}) {
  const client = requireSupabase()
  const response = await client
    .from('job_alerts')
    .insert({
      candidate_profile_id: input.candidateProfileId,
      label: input.alert.label.trim(),
      frequency: input.alert.frequency.trim().toLowerCase(),
      criteria_json: {
        query: input.alert.query?.trim() || null,
        workplaceType: input.alert.workplaceType?.trim() || null,
        countryCode: input.alert.countryCode?.trim().toUpperCase() || null
      }
    })
    .select('*')
    .single()

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function updateJobAlert(input: {
  jobAlertId: string
  candidateProfileId: string
  patch: Partial<JobAlertDraft> & { isActive?: boolean }
}) {
  const client = requireSupabase()
  const existingResponse = await client
    .from('job_alerts')
    .select('*')
    .eq('id', input.jobAlertId)
    .eq('candidate_profile_id', input.candidateProfileId)
    .single()

  if (existingResponse.error) {
    throw existingResponse.error
  }

  const existingCriteria = (existingResponse.data.criteria_json ?? {}) as Record<string, unknown>
  const response = await client
    .from('job_alerts')
    .update({
      label: input.patch.label?.trim() || existingResponse.data.label,
      frequency: input.patch.frequency?.trim().toLowerCase() || existingResponse.data.frequency,
      is_active: input.patch.isActive ?? existingResponse.data.is_active,
      criteria_json: {
        query:
          input.patch.query !== undefined
            ? input.patch.query.trim() || null
            : (typeof existingCriteria.query === 'string' ? existingCriteria.query : null),
        workplaceType:
          input.patch.workplaceType !== undefined
            ? input.patch.workplaceType.trim() || null
            : (typeof existingCriteria.workplaceType === 'string' ? existingCriteria.workplaceType : null),
        countryCode:
          input.patch.countryCode !== undefined
            ? input.patch.countryCode.trim().toUpperCase() || null
            : (typeof existingCriteria.countryCode === 'string' ? existingCriteria.countryCode : null)
      }
    })
    .eq('id', input.jobAlertId)
    .eq('candidate_profile_id', input.candidateProfileId)
    .select('*')
    .single()

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function deleteJobAlert(input: {
  jobAlertId: string
  candidateProfileId: string
}) {
  const client = requireSupabase()
  const response = await client
    .from('job_alerts')
    .delete()
    .eq('id', input.jobAlertId)
    .eq('candidate_profile_id', input.candidateProfileId)

  if (response.error) {
    throw response.error
  }
}
