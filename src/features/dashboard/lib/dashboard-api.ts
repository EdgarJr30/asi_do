import { supabase } from '@/lib/supabase/client'

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

function getPeriodStart(periodDays?: number, offsetDays = 0) {
  if (!periodDays) {
    return null
  }

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - periodDays - offsetDays + 1)
  return start
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

/**
 * Métricas del dashboard del workspace.
 *
 * Antes se descargaba el tablero completo —todas las postulaciones del tenant
 * con notas, calificaciones y usuario anidados— más todas las vacantes, para
 * calcular nueve números y dos listas de treinta. El coste crecía con el
 * histórico aunque la pantalla mostrara siempre lo mismo. Ahora agrega la base
 * y aquí solo queda decidir el periodo (TASK-276).
 *
 * Las fronteras se calculan en el cliente **a propósito**: salen de la
 * medianoche local del navegador, y resolverlas en la base las movería a
 * medianoche UTC — en República Dominicana (UTC-4), las cuatro primeras horas
 * de cada día caerían en el periodo equivocado.
 */
export async function fetchWorkspaceDashboardMetrics(
  tenantId: string,
  options?: { periodDays?: number }
): Promise<WorkspaceDashboardMetrics> {
  const client = requireSupabase()
  const periodStart = getPeriodStart(options?.periodDays)
  const previousPeriodStart = getPeriodStart(options?.periodDays, options?.periodDays)

  const response = await client.rpc('workspace_dashboard_metrics', {
    p_tenant_id: tenantId,
    p_period_start: periodStart ? periodStart.toISOString() : null,
    p_previous_period_start: previousPeriodStart ? previousPeriodStart.toISOString() : null
  })

  if (response.error) {
    throw response.error
  }

  return response.data as unknown as WorkspaceDashboardMetrics
}
