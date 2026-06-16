import { useQuery } from '@tanstack/react-query'
import { FileText, Star, UserPlus } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { fetchWorkspaceDashboardMetrics, type DashboardActivityItem } from '@/features/dashboard/lib/dashboard-api'

function relativeTime(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
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
  return `hace ${Math.round(hours / 24)} d`
}

function activityIcon(kind: DashboardActivityItem['kind']) {
  if (kind === 'note') {
    return FileText
  }
  if (kind === 'rating') {
    return Star
  }
  return UserPlus
}

export function WorkspaceActivityPage() {
  const session = useAppSession()
  const tenantId = session.activeTenantId

  const metricsQuery = useQuery({
    queryKey: ['workspace', 'dashboard', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => fetchWorkspaceDashboardMetrics(tenantId!)
  })

  if (!tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No tienes un workspace operativo activo</CardTitle>
          <CardDescription>La actividad se habilita para tenants aprobados con acceso de reclutamiento.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const activity = metricsQuery.data?.recentActivity ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.7rem] font-semibold tracking-tight text-(--app-text) sm:text-[2rem]">Mi actividad</h1>
        <p className="mt-1 text-sm text-(--app-text-muted)">Eventos recientes de tu pipeline de reclutamiento.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Línea de tiempo</CardTitle>
          <CardDescription>Aplicaciones, notas y calificaciones más recientes.</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsQuery.isLoading ? (
            <p className="text-sm text-(--app-text-muted)">Cargando actividad…</p>
          ) : activity.length > 0 ? (
            <ul className="space-y-4">
              {activity.map((item) => {
                const Icon = activityIcon(item.kind)
                return (
                  <li key={item.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-(--app-surface-muted) text-(--app-text-muted)">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 border-b border-(--app-border)/70 pb-4">
                      <p className="text-sm leading-5 text-(--app-text)">
                        <span className="font-semibold">{item.candidateName}</span> {item.summary}
                      </p>
                      <p className="mt-0.5 text-xs text-(--app-text-subtle)">{relativeTime(item.occurredAt)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState title="Sin actividad" description="Cuando trabajes el pipeline, tu actividad reciente aparecerá aquí." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
