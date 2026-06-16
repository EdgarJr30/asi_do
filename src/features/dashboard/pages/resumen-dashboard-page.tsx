import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import {
  fetchWorkspaceDashboardMetrics,
  type DashboardActivityItem,
  type DashboardRecentApplication
} from '@/features/dashboard/lib/dashboard-api'
import { cn } from '@/lib/utils/cn'

function greetingForNow(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) {
    return 'Buenos días'
  }
  if (hour < 19) {
    return 'Buenas tardes'
  }
  return 'Buenas noches'
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] ?? value
}

function initialsOf(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '·'
  )
}

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) {
    return 'hace un momento'
  }
  if (minutes < 60) {
    return `hace ${minutes} min`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `hace ${hours} h`
  }
  const days = Math.round(hours / 24)
  return `hace ${days} d`
}

function scoreVariant(score: number) {
  if (score >= 85) {
    return 'default' as const
  }
  if (score >= 70) {
    return 'soft' as const
  }
  return 'outline' as const
}

export function ResumenDashboardPage() {
  const session = useAppSession()
  const navigate = useNavigate()
  const tenantId = session.activeTenantId
  const displayName = session.profile?.display_name ?? session.profile?.full_name ?? session.authUser?.email ?? 'equipo'

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
          <CardDescription>El panel se habilita para tenants aprobados con acceso de reclutamiento.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const stats = metrics?.stats
  const greeting = greetingForNow()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-(--app-text-subtle)">Dashboard · Resumen</p>
          <h1 className="text-[1.7rem] font-semibold tracking-tight text-(--app-text) sm:text-[2rem]">
            {greeting}, {firstName(displayName)}
          </h1>
          <p className="text-sm text-(--app-text-muted)">Este es el estado de tu reclutamiento hoy.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={() => void navigate(surfacePaths.workspace.pipeline)}>
            Ver pipeline
          </Button>
          <Button onClick={() => void navigate(surfacePaths.workspace.jobs)}>Publicar vacante</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Vacantes abiertas" value={stats?.openJobs ?? '—'} helper="Publicadas y recibiendo aplicaciones" />
        <StatCard label="Candidatos activos" value={stats?.activeCandidates ?? '—'} helper="En proceso, sin descartar ni contratar" />
        <StatCard label="Entrevistas" value={stats?.interviews ?? '—'} helper="Candidatos en etapa de entrevista" />
        <StatCard label="Ofertas enviadas" value={stats?.offers ?? '—'} helper="Esperando respuesta del candidato" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Embudo de contratación</CardTitle>
                <CardDescription>Distribución de candidatos por etapa del pipeline.</CardDescription>
              </div>
              <Button className="h-9 rounded-full px-3 text-xs" variant="ghost" onClick={() => void navigate(surfacePaths.workspace.pipeline)}>
                Ver detalles
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {metricsQuery.isLoading ? (
              <p className="text-sm text-(--app-text-muted)">Cargando embudo…</p>
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
              <EmptyState title="Sin datos del embudo" description="Aún no hay aplicaciones para mostrar la distribución por etapa." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Últimos eventos relevantes de tu pipeline.</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsQuery.isLoading ? (
              <p className="text-sm text-(--app-text-muted)">Cargando actividad…</p>
            ) : metrics && metrics.recentActivity.length > 0 ? (
              <ul className="space-y-3.5">
                {metrics.recentActivity.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin actividad" description="Cuando tu equipo trabaje el pipeline, lo verás aquí." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Aplicaciones recientes</CardTitle>
              <CardDescription>Las postulaciones más nuevas de tu empresa.</CardDescription>
            </div>
            <Button className="h-9 rounded-full px-3 text-xs" variant="ghost" onClick={() => void navigate(surfacePaths.workspace.applications)}>
              Ver todas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {metricsQuery.isLoading ? (
            <p className="text-sm text-(--app-text-muted)">Cargando aplicaciones…</p>
          ) : metrics && metrics.recentApplications.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-(--app-border) text-left text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-(--app-text-subtle)">
                    <th className="py-2.5 pr-3 font-semibold">Candidato</th>
                    <th className="px-3 py-2.5 font-semibold">Posición</th>
                    <th className="px-3 py-2.5 font-semibold">Etapa</th>
                    <th className="px-3 py-2.5 font-semibold">Score</th>
                    <th className="py-2.5 pl-3 text-right font-semibold">Aplicó</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentApplications.map((application) => (
                    <ApplicationRow key={application.applicationId} application={application} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sin aplicaciones" description="Aún no hay postulaciones recientes en tus vacantes." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ActivityRow({ item }: { item: DashboardActivityItem }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-(--app-surface-muted) text-[11px] font-semibold text-(--app-text-muted)">
        {initialsOf(item.candidateName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 text-(--app-text)">
          <span className="font-semibold">{item.candidateName}</span> {item.summary}
        </p>
        <p className="mt-0.5 text-xs text-(--app-text-subtle)">{relativeTime(item.occurredAt)}</p>
      </div>
    </li>
  )
}

function ApplicationRow({ application }: { application: DashboardRecentApplication }) {
  return (
    <tr className="border-b border-(--app-border)/70 last:border-0">
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--app-surface-muted) text-[11px] font-semibold text-(--app-text-muted)">
            {initialsOf(application.candidateName)}
          </span>
          <span className="truncate font-medium text-(--app-text)">{application.candidateName}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-(--app-text-muted)">{application.position}</td>
      <td className="px-3 py-3">
        {application.stageName ? <Badge variant="outline">{application.stageName}</Badge> : <span className="text-(--app-text-subtle)">—</span>}
      </td>
      <td className="px-3 py-3">
        {application.score !== null ? (
          <Badge variant={scoreVariant(application.score)}>{application.score}%</Badge>
        ) : (
          <span className="text-(--app-text-subtle)">—</span>
        )}
      </td>
      <td className={cn('py-3 pl-3 text-right tabular-nums text-(--app-text-muted)')}>{relativeTime(application.submittedAt)}</td>
    </tr>
  )
}
