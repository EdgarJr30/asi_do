import { listTenantJobs } from '@/features/jobs/lib/jobs-api'
import { fetchPipelineBoard } from '@/features/pipeline/lib/pipeline-api'

export interface DashboardFunnelStage {
  stageId: string
  name: string
  count: number
  percent: number
}

export interface DashboardRecentApplication {
  applicationId: string
  candidateName: string
  avatarPath: string | null
  position: string
  stageName: string | null
  stageCode: string | null
  score: number | null
  submittedAt: string
}

export interface DashboardActivityItem {
  id: string
  kind: 'application' | 'note' | 'rating'
  candidateName: string
  jobTitle: string
  summary: string
  occurredAt: string
}

export interface WorkspaceDashboardMetrics {
  stats: {
    openJobs: number
    activeCandidates: number
    interviews: number
    offers: number
    hired: number
  }
  deltas: {
    openJobs: number
    activeCandidates: number
    interviews: number
    offers: number
  }
  funnel: DashboardFunnelStage[]
  recentApplications: DashboardRecentApplication[]
  recentActivity: DashboardActivityItem[]
}

const TERMINAL_STATUSES = new Set(['rejected', 'withdrawn', 'hired'])

function isInterviewStage(code: string | null | undefined, name: string | null | undefined) {
  const value = `${code ?? ''} ${name ?? ''}`.toLowerCase()
  return value.includes('interview') || value.includes('entrevista')
}

function isOfferStage(code: string | null | undefined, name: string | null | undefined) {
  const value = `${code ?? ''} ${name ?? ''}`.toLowerCase()
  return value.includes('offer') || value.includes('oferta')
}

function isHiredStage(code: string | null | undefined, name: string | null | undefined) {
  const value = `${code ?? ''} ${name ?? ''}`.toLowerCase()
  return value.includes('hired') || value.includes('contrat')
}

function getPeriodStart(periodDays?: number, offsetDays = 0) {
  if (!periodDays) {
    return null
  }

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - periodDays - offsetDays + 1)
  return start
}

function inPeriod(value: string, start: Date | null, end: Date | null) {
  if (!start) {
    return true
  }

  const date = new Date(value)
  return date >= start && (!end || date < end)
}

type PipelineApplication = Awaited<ReturnType<typeof fetchPipelineBoard>>['applications'][number]
type PipelineStage = Awaited<ReturnType<typeof fetchPipelineBoard>>['stages'][number]

function isActiveApplication(application: PipelineApplication) {
  return !TERMINAL_STATUSES.has(application.status_public)
}

function isInterviewApplication(application: PipelineApplication, stageById: Map<string, PipelineStage>) {
  const stage = application.current_stage_id ? stageById.get(application.current_stage_id) : null
  return application.status_public === 'interviewing' || isInterviewStage(stage?.code, stage?.name)
}

function isOfferApplication(application: PipelineApplication, stageById: Map<string, PipelineStage>) {
  const stage = application.current_stage_id ? stageById.get(application.current_stage_id) : null
  return application.status_public === 'offer' || isOfferStage(stage?.code, stage?.name)
}

function isHiredApplication(application: PipelineApplication, stageById: Map<string, PipelineStage>) {
  const stage = application.current_stage_id ? stageById.get(application.current_stage_id) : null
  return application.status_public === 'hired' || isHiredStage(stage?.code, stage?.name)
}

type NestedAvatarUser = { avatar_path: string | null } | null
type NestedCandidateProfile = { user: NestedAvatarUser | NestedAvatarUser[] } | null

/** Extrae la ruta del avatar del postulante, tolerando objeto o arreglo anidado. */
function applicationAvatarPath(application: PipelineApplication): string | null {
  const candidateProfile = application.candidate_profile as
    | NestedCandidateProfile
    | NestedCandidateProfile[]
    | undefined
  const profile = Array.isArray(candidateProfile) ? candidateProfile[0] : candidateProfile
  const user = Array.isArray(profile?.user) ? profile?.user[0] : profile?.user
  return user?.avatar_path ?? null
}

export async function fetchWorkspaceDashboardMetrics(
  tenantId: string,
  options?: { periodDays?: number }
): Promise<WorkspaceDashboardMetrics> {
  const [board, jobs] = await Promise.all([fetchPipelineBoard(tenantId), listTenantJobs(tenantId)])
  const { stages, applications } = board

  const stageById = new Map(stages.map((stage) => [stage.id, stage]))
  const periodStart = getPeriodStart(options?.periodDays)
  const previousPeriodStart = getPeriodStart(options?.periodDays, options?.periodDays)
  const periodApplications = applications.filter((application) => inPeriod(application.submitted_at, periodStart, null))
  const previousApplications =
    periodStart && previousPeriodStart
      ? applications.filter((application) => inPeriod(application.submitted_at, previousPeriodStart, periodStart))
      : []
  const periodOpenJobs = periodStart
    ? jobs.filter((job) => job.status === 'published' && inPeriod(job.published_at ?? job.updated_at, periodStart, null)).length
    : jobs.filter((job) => job.status === 'published').length
  const previousOpenJobs =
    periodStart && previousPeriodStart
      ? jobs.filter(
          (job) =>
            job.status === 'published' && inPeriod(job.published_at ?? job.updated_at, previousPeriodStart, periodStart)
        ).length
      : 0
  const totalApplications = periodApplications.length

  const funnel: DashboardFunnelStage[] = stages.map((stage) => {
    const count = periodApplications.filter((application) => application.current_stage_id === stage.id).length
    return {
      stageId: stage.id,
      name: stage.name,
      count,
      percent: totalApplications > 0 ? Math.round((count / totalApplications) * 100) : 0
    }
  })

  const activeCandidates = periodApplications.filter(isActiveApplication).length
  const interviews = periodApplications.filter((application) => isInterviewApplication(application, stageById)).length
  const offers = periodApplications.filter((application) => isOfferApplication(application, stageById)).length
  const hired = periodApplications.filter((application) => isHiredApplication(application, stageById)).length
  const previousActiveCandidates = previousApplications.filter(isActiveApplication).length
  const previousInterviews = previousApplications.filter((application) => isInterviewApplication(application, stageById)).length
  const previousOffers = previousApplications.filter((application) => isOfferApplication(application, stageById)).length

  const recentApplications: DashboardRecentApplication[] = [...periodApplications]
    .sort((left, right) => new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime())
    .slice(0, 30)
    .map((application) => {
      const stage = application.current_stage_id ? stageById.get(application.current_stage_id) : null
      const ratings = application.application_ratings ?? []
      const score = ratings.length
        ? Math.round((ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length) * 20)
        : null

      return {
        applicationId: application.id,
        candidateName: application.candidate_display_name_snapshot,
        avatarPath: applicationAvatarPath(application),
        position: application.job_posting?.title ?? 'Vacante',
        stageName: stage?.name ?? null,
        stageCode: stage?.code ?? null,
        score,
        submittedAt: application.submitted_at
      }
    })

  const activity: DashboardActivityItem[] = []
  for (const application of periodApplications) {
    const candidateName = application.candidate_display_name_snapshot
    const jobTitle = application.job_posting?.title ?? 'Vacante'
    activity.push({
      id: `app-${application.id}`,
      kind: 'application',
      candidateName,
      jobTitle,
      summary: 'aplicó a una vacante',
      occurredAt: application.submitted_at
    })
    for (const note of application.application_notes ?? []) {
      activity.push({
        id: `note-${note.id}`,
        kind: 'note',
        candidateName,
        jobTitle,
        summary: 'recibió una nueva nota',
        occurredAt: note.created_at
      })
    }
    for (const rating of application.application_ratings ?? []) {
      activity.push({
        id: `rating-${rating.id}`,
        kind: 'rating',
        candidateName,
        jobTitle,
        summary: `fue calificado · ${rating.score}/5`,
        occurredAt: rating.created_at
      })
    }
  }

  const recentActivity = activity
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 30)

  return {
    stats: { openJobs: periodOpenJobs, activeCandidates, interviews, offers, hired },
    deltas: {
      openJobs: periodOpenJobs - previousOpenJobs,
      activeCandidates: activeCandidates - previousActiveCandidates,
      interviews: interviews - previousInterviews,
      offers: offers - previousOffers
    },
    funnel,
    recentApplications,
    recentActivity
  }
}
