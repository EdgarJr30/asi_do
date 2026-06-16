import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { fetchWorkspaceDashboardMetrics } from '@/features/dashboard/lib/dashboard-api'

export function WorkspaceReportsPage() {
  const session = useAppSession()
  const tenantId = session.activeTenantId

  const metricsQuery = useQuery({
    queryKey: ['workspace', 'dashboard', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => fetchWorkspaceDashboardMetrics(tenantId!)
  })

  const metrics = metricsQuery.data
  const maxFunnelCount = useMemo(
    () => (metrics ? Math.max(1, ...metrics.funnel.map((stage) => stage.count)) : 1),
    [metrics]
  )

  if (!tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No tienes un workspace operativo activo</CardTitle>
          <CardDescription>Los reportes se habilitan para tenants aprobados con acceso de reclutamiento.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const totalInFunnel = metrics?.funnel.reduce((sum, stage) => sum + stage.count, 0) ?? 0
  const conversion = totalInFunnel > 0 ? Math.round(((metrics?.stats.offers ?? 0) / totalInFunnel) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.7rem] font-semibold tracking-tight text-(--app-text) sm:text-[2rem]">Reportes</h1>
        <p className="mt-1 text-sm text-(--app-text-muted)">Métricas y desempeño del reclutamiento de tu empresa.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Vacantes abiertas" value={metrics?.stats.openJobs ?? '—'} helper="Publicadas actualmente" />
        <StatCard label="Candidatos activos" value={metrics?.stats.activeCandidates ?? '—'} helper="En proceso" />
        <StatCard label="Entrevistas" value={metrics?.stats.interviews ?? '—'} helper="En etapa de entrevista" />
        <StatCard label="Tasa a oferta" value={`${conversion}%`} helper="Candidatos que llegan a oferta" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribución por etapa</CardTitle>
          <CardDescription>Volumen de candidatos en cada etapa del pipeline.</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsQuery.isLoading ? (
            <p className="text-sm text-(--app-text-muted)">Cargando métricas…</p>
          ) : metrics && metrics.funnel.length > 0 ? (
            <div className="space-y-3.5">
              {metrics.funnel.map((stage) => (
                <div key={stage.stageId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-(--app-text)">{stage.name}</span>
                    <span className="tabular-nums text-(--app-text-muted)">
                      {stage.count} · {stage.percent}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-(--app-surface-muted)">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-[width] duration-500"
                      style={{ width: `${Math.max(2, Math.round((stage.count / maxFunnelCount) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin datos" description="Aún no hay aplicaciones para generar reportes." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
