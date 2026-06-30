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

export async function fetchWorkspaceDashboardMetrics(tenantId: string): Promise<WorkspaceDashboardMetrics> {
  const [board, jobs] = await Promise.all([fetchPipelineBoard(tenantId), listTenantJobs(tenantId)])
  const { stages, applications } = board

  const stageById = new Map(stages.map((stage) => [stage.id, stage]))
  const totalApplications = applications.length

  const funnel: DashboardFunnelStage[] = stages.map((stage) => {
    const count = applications.filter((application) => application.current_stage_id === stage.id).length
    return {
      stageId: stage.id,
      name: stage.name,
      count,
      percent: totalApplications > 0 ? Math.round((count / totalApplications) * 100) : 0
    }
  })

  const openJobs = jobs.filter((job) => job.status === 'published').length
  const activeCandidates = applications.filter((application) => !TERMINAL_STATUSES.has(application.status_public)).length
  const interviews = applications.filter((application) => {
    const stage = application.current_stage_id ? stageById.get(application.current_stage_id) : null
    return application.status_public === 'interviewing' || isInterviewStage(stage?.code, stage?.name)
  }).length
  const offers = applications.filter((application) => {
    const stage = application.current_stage_id ? stageById.get(application.current_stage_id) : null
    return application.status_public === 'offer' || isOfferStage(stage?.code, stage?.name)
  }).length

  const recentApplications: DashboardRecentApplication[] = [...applications]
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
        position: application.job_posting?.title ?? 'Vacante',
        stageName: stage?.name ?? null,
        stageCode: stage?.code ?? null,
        score,
        submittedAt: application.submitted_at
      }
    })

  const activity: DashboardActivityItem[] = []
  for (const application of applications) {
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
    stats: { openJobs, activeCandidates, interviews, offers },
    funnel,
    recentApplications,
    recentActivity
  }
}
