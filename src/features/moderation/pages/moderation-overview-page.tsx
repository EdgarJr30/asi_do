import { useMemo, useState } from 'react'

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loader'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AdminPage, AdminTabs } from '@/features/internal/components/admin-redesign'
import {
  applyModerationAction,
  listModerationCasesPage,
  openModerationCase,
  type ModerationStatusFilter
} from '@/features/moderation/lib/moderation-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { useInfiniteScroll } from '@/shared/ui/use-infinite-scroll'

const MODERATION_PAGE_SIZE = 12

const moderationGuardrails = [
  'OSINT solo con fuentes publicas y proposito legitimo.',
  'No usar atributos protegidos para decisiones de contratación.',
  'Las acciones de riesgo deben ser auditables.',
  'Seguridad web, RLS y reglas de negocio son capas inseparables.'
] as const

export function ModerationOverviewPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const canAct = session.permissions.includes('moderation:act')
  const [entityType, setEntityType] = useState('tenant')
  const [entityId, setEntityId] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [reason, setReason] = useState('')
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<ModerationStatusFilter>('open')

  const casesQuery = useInfiniteQuery({
    queryKey: ['moderation-cases', statusFilter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listModerationCasesPage({ filter: statusFilter, limit: MODERATION_PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextOffset
  })

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = casesQuery
  const casePages = useMemo(() => casesQuery.data?.pages ?? [], [casesQuery.data])
  const cases = useMemo(() => casePages.flatMap((entry) => entry.rows), [casePages])
  const totalCases = casePages[0]?.totalCount ?? 0

  const sentinelRef = useInfiniteScroll({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: () => void fetchNextPage(),
    deps: [cases.length]
  })

  const openCaseMutation = useMutation({
    mutationFn: openModerationCase,
    onSuccess: async () => {
      setEntityId('')
      setTenantId('')
      setReason('')
      await queryClient.invalidateQueries({ queryKey: ['moderation-cases'] })
      toast.success('Caso de moderacion creado', {
        description: 'El caso ya queda visible para seguimiento y acciones auditables.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos crear el caso de moderacion',
        source: 'moderation.case-open',
        route: surfacePaths.admin.moderation,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const actionMutation = useMutation({
    mutationFn: applyModerationAction,
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['moderation-cases'] })
      toast.success('Acción aplicada', {
        description: `La acción ${variables.actionType} ya quedó auditada en el caso.`
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos aplicar la acción',
        source: 'moderation.case-action',
        route: surfacePaths.admin.moderation,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  return (
    <AdminPage
      eyebrow="Admin · Moderación"
      title="Moderación y trust operations"
      description="Abre casos de trust & safety, ejecuta acciones seguras y deja toda decisión registrada en auditoría."
    >
      <div className="space-y-4">
        <Card className="overflow-hidden bg-(--app-surface-muted)">
          <CardContent className="mt-0 grid gap-2 md:grid-cols-2">
          {moderationGuardrails.map((rule) => (
            <div key={rule} className="rounded-control border border-white/70 bg-white/80 px-3 py-2.5 text-[0.8rem] leading-snug text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-300">
              {rule}
            </div>
          ))}
          </CardContent>
        </Card>

      <section className="grid gap-3 xl:grid-cols-[0.88fr_1.12fr]">
        <Card>
          <CardHeader>
            <CardTitle>Abrir caso</CardTitle>
            <CardDescription>Usa entity type + id para registrar una investigación o acción operativa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={entityType} onChange={(event) => setEntityType(event.target.value)}>
              <option value="tenant">tenant</option>
              <option value="job_posting">job_posting</option>
              <option value="recruiter_request">recruiter_request</option>
              <option value="application">application</option>
              <option value="user">user</option>
            </Select>
            <Input placeholder="Entity UUID" value={entityId} onChange={(event) => setEntityId(event.target.value)} />
            <Input placeholder="Tenant UUID opcional" value={tenantId} onChange={(event) => setTenantId(event.target.value)} />
            <Select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </Select>
            <Textarea
              rows={5}
              placeholder="Motivo, evidencia o contexto operativo"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <Button
              className="w-full"
              disabled={!canAct || openCaseMutation.isPending || entityId.trim().length === 0 || reason.trim().length < 6}
              onClick={() =>
                openCaseMutation.mutate({
                  entityType,
                  entityId: entityId.trim(),
                  tenantId: tenantId.trim() || null,
                  severity,
                  reason
                })
              }
            >
              {!canAct ? 'Sin permiso para actuar' : openCaseMutation.isPending ? 'Creando caso...' : 'Crear caso de moderacion'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle>Casos recientes</CardTitle>
                <CardDescription>Abre, resuelve o descarta casos segun el riesgo y el tipo de entidad.</CardDescription>
              </div>
            </div>
            <div className="mt-3">
              <AdminTabs
                value={statusFilter}
                onChange={setStatusFilter}
                tabs={[
                  { value: 'open', label: 'Abiertos' },
                  { value: 'resolved', label: 'Resueltos' },
                  { value: 'all', label: 'Todos', count: totalCases }
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {casesQuery.isLoading ? (
              <p className="inline-flex items-center gap-2 py-4 text-sm text-(--app-text-muted)">
                <Spinner size="sm" /> Cargando casos…
              </p>
            ) : cases.length === 0 ? (
              <p className="py-4 text-sm text-(--app-text-muted)">No hay casos para este filtro.</p>
            ) : null}
            {cases.map((caseItem) => (
              <div key={caseItem.id} className="rounded-card border border-(--app-border) bg-(--app-surface-muted)/60 px-3 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.82rem] font-semibold text-(--app-text)">
                      {caseItem.entity_type} · <span className="font-mono text-[0.76rem] text-(--app-text-muted)">{caseItem.entity_id}</span>
                    </p>
                    <p className="mt-0.5 text-[0.8rem] leading-snug text-(--app-text-muted)">{caseItem.reason}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">{caseItem.severity}</Badge>
                    <Badge variant={caseItem.status === 'open' ? 'soft' : 'outline'}>{caseItem.status}</Badge>
                  </div>
                </div>

                <Textarea
                  className="mt-2.5"
                  rows={2}
                  placeholder="Nota operativa para la acción"
                  value={actionNotes[caseItem.id] ?? ''}
                  onChange={(event) =>
                    setActionNotes((previous) => ({
                      ...previous,
                      [caseItem.id]: event.target.value
                    }))
                  }
                />

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Button
                    variant="outline"
                    className="h-8 rounded-control px-2.5 text-[0.78rem]"
                    disabled={!canAct || actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({
                        caseId: caseItem.id,
                        actionType: 'warn',
                        note: actionNotes[caseItem.id]
                      })
                    }
                  >
                    Warn
                  </Button>
                  {caseItem.entity_type === 'job_posting' ? (
                    <Button
                      variant="outline"
                      className="h-8 rounded-control px-2.5 text-[0.78rem]"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          caseId: caseItem.id,
                          actionType: 'close_job',
                          note: actionNotes[caseItem.id]
                        })
                      }
                    >
                      Close job
                    </Button>
                  ) : null}
                  {caseItem.entity_type === 'tenant' ? (
                    <>
                      <Button
                        variant="outline"
                        className="h-8 rounded-control px-2.5 text-[0.78rem]"
                        disabled={!canAct || actionMutation.isPending}
                        onClick={() =>
                          actionMutation.mutate({
                            caseId: caseItem.id,
                            actionType: 'suspend_tenant',
                            note: actionNotes[caseItem.id]
                          })
                        }
                      >
                        Suspend tenant
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 rounded-control px-2.5 text-[0.78rem]"
                        disabled={!canAct || actionMutation.isPending}
                        onClick={() =>
                          actionMutation.mutate({
                            caseId: caseItem.id,
                            actionType: 'restore_tenant',
                            note: actionNotes[caseItem.id]
                          })
                        }
                      >
                        Restore tenant
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="outline"
                    className="h-8 rounded-control px-2.5 text-[0.78rem]"
                    disabled={!canAct || actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({
                        caseId: caseItem.id,
                        actionType: 'dismiss_case',
                        note: actionNotes[caseItem.id]
                      })
                    }
                  >
                    Dismiss
                  </Button>
                </div>

                {caseItem.actions && caseItem.actions.length > 0 ? (
                  <div className="mt-2.5 grid gap-1.5">
                    {caseItem.actions.slice(0, 3).map((action) => (
                      <div key={action.id} className="rounded-control bg-(--app-surface) px-2.5 py-1.5 text-[0.76rem] text-(--app-text-muted)">
                        <span className="font-semibold text-(--app-text)">{action.action_type}</span>
                        {action.note ? ` · ${action.note}` : ''}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            <div ref={sentinelRef} aria-hidden className="h-px w-full" />
            {isFetchingNextPage ? (
              <div className="flex items-center justify-center gap-2 py-3 text-[0.78rem] text-(--app-text-subtle)">
                <Spinner size="sm" /> Cargando más casos…
              </div>
            ) : !hasNextPage && cases.length > 0 ? (
              <p className="py-3 text-center text-[0.74rem] text-(--app-text-subtle)">No hay más casos</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
      </div>
    </AdminPage>
  )
}
