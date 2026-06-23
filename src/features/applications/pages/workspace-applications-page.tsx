import { useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { fetchPipelineBoard } from '@/features/pipeline/lib/pipeline-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'

const STATUS_META: Record<string, { label: string; variant: 'default' | 'soft' | 'outline' }> = {
  submitted: { label: 'Aplicó', variant: 'outline' },
  in_review: { label: 'En revisión', variant: 'soft' },
  interviewing: { label: 'Entrevista', variant: 'soft' },
  offer: { label: 'Oferta', variant: 'default' },
  hired: { label: 'Contratado', variant: 'default' },
  rejected: { label: 'Descartado', variant: 'outline' },
  withdrawn: { label: 'Retirado', variant: 'outline' }
}

function initialsFrom(value: string) {
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

function relativeDays(value: string) {
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000))
  if (days === 0) {
    return 'hoy'
  }
  if (days === 1) {
    return 'hace 1 día'
  }
  return `hace ${days} días`
}

export function WorkspaceApplicationsPage() {
  const session = useAppSession()
  const tenantId = session.activeTenantId
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const boardQuery = useQuery({
    queryKey: ['pipeline-board', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => fetchPipelineBoard(tenantId!)
  })

  // En vivo: nuevas postulaciones y cambios de etapa aparecen sin recargar.
  useRealtimeSync(
    'workspace-applications',
    [
      { table: 'applications', invalidate: [['pipeline-board', tenantId]] },
      { table: 'application_stage_history', invalidate: [['pipeline-board', tenantId]] }
    ],
    { enabled: Boolean(tenantId) }
  )

  const stageNameById = useMemo(
    () => new Map((boardQuery.data?.stages ?? []).map((stage) => [stage.id, stage.name])),
    [boardQuery.data]
  )

  const rows = useMemo(() => {
    const applications = boardQuery.data?.applications ?? []
    const normalized = query.trim().toLowerCase()

    return applications
      .filter((application) => {
        const matchesQuery =
          normalized.length === 0 ||
          application.candidate_display_name_snapshot.toLowerCase().includes(normalized) ||
          (application.job_posting?.title ?? '').toLowerCase().includes(normalized)
        const matchesStatus = statusFilter.length === 0 || application.status_public === statusFilter
        return matchesQuery && matchesStatus
      })
      .sort((left, right) => new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime())
  }, [boardQuery.data, query, statusFilter])

  if (!tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No tienes un workspace operativo activo</CardTitle>
          <CardDescription>Las aplicaciones se habilitan para tenants aprobados con acceso de reclutamiento.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.7rem] font-semibold tracking-tight text-(--app-text) sm:text-[2rem]">Aplicaciones</h1>
        <p className="mt-1 text-sm text-(--app-text-muted)">{rows.length} postulaciones en tus vacantes</p>
      </div>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-(--app-border) bg-(--app-surface) px-3.5">
          <Search aria-hidden="true" className="size-4 text-(--app-text-subtle)" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por candidato o posición..."
            className="h-11 w-full bg-transparent text-sm text-(--app-text) outline-none placeholder:text-(--app-text-subtle)"
          />
        </div>
        <Select className="lg:w-56" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {boardQuery.isLoading ? (
          <div className="px-6 py-10 text-sm text-(--app-text-muted)">Cargando aplicaciones…</div>
        ) : rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-(--app-border) bg-(--app-surface-muted) text-left text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-(--app-text-subtle)">
                  <th className="px-5 py-3 font-semibold">Candidato</th>
                  <th className="px-4 py-3 font-semibold">Posición</th>
                  <th className="px-4 py-3 font-semibold">Etapa</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 text-right font-semibold">Aplicó</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((application) => {
                  const statusMeta = STATUS_META[application.status_public] ?? { label: application.status_public, variant: 'outline' as const }
                  const stageName = application.current_stage_id ? stageNameById.get(application.current_stage_id) : null

                  return (
                    <tr key={application.id} className="border-b border-(--app-border)/70 last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--app-surface-muted) text-[11px] font-semibold text-(--app-text-muted)">
                            {initialsFrom(application.candidate_display_name_snapshot)}
                          </span>
                          <span className="truncate font-medium text-(--app-text)">{application.candidate_display_name_snapshot}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-(--app-text-muted)">{application.job_posting?.title ?? 'Vacante'}</td>
                      <td className="px-4 py-3.5">
                        {stageName ? <Badge variant="outline">{stageName}</Badge> : <span className="text-(--app-text-subtle)">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-(--app-text-muted)">{relativeDays(application.submitted_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            <EmptyState title="Sin aplicaciones" description="Aún no hay postulaciones que coincidan con este criterio." />
          </div>
        )}
      </Card>
    </div>
  )
}
