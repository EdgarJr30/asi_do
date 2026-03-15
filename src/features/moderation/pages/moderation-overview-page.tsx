import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { applyModerationAction, listModerationCases, openModerationCase } from '@/features/moderation/lib/moderation-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

const moderationGuardrails = [
  'OSINT solo con fuentes publicas y proposito legitimo.',
  'No usar atributos protegidos para decisiones de contratacion.',
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

  const casesQuery = useQuery({
    queryKey: ['moderation-cases'],
    queryFn: listModerationCases
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
        route: '/admin/moderation',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const actionMutation = useMutation({
    mutationFn: applyModerationAction,
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['moderation-cases'] })
      toast.success('Accion aplicada', {
        description: `La accion ${variables.actionType} ya quedo auditada en el caso.`
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos aplicar la accion',
        source: 'moderation.case-action',
        route: '/admin/moderation',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary-100 bg-[radial-gradient(circle_at_top_left,#ffe4e6_0,transparent_30%),linear-gradient(135deg,#fff1f2,white_42%,#eff6ff_82%)] dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(225,29,72,0.18)_0,transparent_26%),linear-gradient(135deg,rgba(36,12,20,0.96),rgba(9,9,11,0.95)_44%,rgba(10,17,34,0.95))]">
        <CardHeader>
          <Badge variant="soft">Moderation ops</Badge>
          <CardTitle>Moderacion y trust operations</CardTitle>
          <CardDescription>
            Fase base para abrir casos, ejecutar acciones seguras y dejar toda decision registrada en auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {moderationGuardrails.map((rule) => (
            <div key={rule} className="rounded-[24px] border border-white/70 bg-white/80 px-4 py-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-300">
              {rule}
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
        <Card>
          <CardHeader>
            <CardTitle>Abrir caso</CardTitle>
            <CardDescription>Usa entity type + id para registrar una investigacion o accion operativa.</CardDescription>
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
            <CardTitle>Casos recientes</CardTitle>
            <CardDescription>Abre, resuelve o descarta casos segun el riesgo y el tipo de entidad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(casesQuery.data ?? []).map((caseItem) => (
              <div key={caseItem.id} className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {caseItem.entity_type} · {caseItem.entity_id}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{caseItem.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{caseItem.severity}</Badge>
                    <Badge variant={caseItem.status === 'open' ? 'soft' : 'outline'}>{caseItem.status}</Badge>
                  </div>
                </div>

                <Textarea
                  className="mt-3"
                  rows={3}
                  placeholder="Nota operativa para la accion"
                  value={actionNotes[caseItem.id] ?? ''}
                  onChange={(event) =>
                    setActionNotes((previous) => ({
                      ...previous,
                      [caseItem.id]: event.target.value
                    }))
                  }
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
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
                  <div className="mt-4 grid gap-2">
                    {caseItem.actions.slice(0, 3).map((action) => (
                      <div key={action.id} className="rounded-2xl bg-white/80 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-950/70 dark:text-zinc-400">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">{action.action_type}</span>
                        {action.note ? ` · ${action.note}` : ''}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
