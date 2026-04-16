import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { exportApplicationsCsv } from '@/features/applications/lib/applications-api'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  addApplicationNote,
  fetchApplicationActivity,
  fetchPipelineBoard,
  moveApplicationStage,
  upsertApplicationRating
} from '@/features/pipeline/lib/pipeline-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

export function PipelineBoardPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const tenantId = session.activeTenantId
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null)
  const [stageNote, setStageNote] = useState('')
  const [newNote, setNewNote] = useState('')
  const [score, setScore] = useState('4')
  const [candidateQuery, setCandidateQuery] = useState('')
  const [jobFilter, setJobFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const boardQuery = useQuery({
    queryKey: ['pipeline-board', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => fetchPipelineBoard(tenantId!)
  })

  const activityQuery = useQuery({
    queryKey: ['pipeline-activity', selectedApplicationId],
    enabled: Boolean(selectedApplicationId),
    queryFn: async () => fetchApplicationActivity(selectedApplicationId!)
  })

  const selectedApplication = boardQuery.data?.applications.find((application) => application.id === selectedApplicationId) ?? null
  const canExportApplications = session.permissions.includes('application:export')

  const moveMutation = useMutation({
    mutationFn: moveApplicationStage,
    onSuccess: async () => {
      setStageNote('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pipeline-board', tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['applications'] }),
        queryClient.invalidateQueries({ queryKey: ['pipeline-activity', selectedApplicationId] })
      ])
      toast.success('Stage actualizado', {
        description: 'El applicant ya se movio en el pipeline y el historial quedo auditado.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos mover el applicant de stage',
        source: 'pipeline.move-stage',
        route: surfacePaths.workspace.pipeline,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const noteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedApplicationId || !session.authUser) {
        throw new Error('Debes seleccionar una application y tener sesion activa para agregar notas.')
      }

      return addApplicationNote({
        applicationId: selectedApplicationId,
        authorUserId: session.authUser.id,
        body: newNote
      })
    },
    onSuccess: async () => {
      setNewNote('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pipeline-board', tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['pipeline-activity', selectedApplicationId] })
      ])
      toast.success('Nota agregada', {
        description: 'La colaboracion del equipo ya quedo asociada al applicant.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos guardar la nota',
        source: 'pipeline.add-note',
        route: surfacePaths.workspace.pipeline,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const ratingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedApplicationId || !session.authUser) {
        throw new Error('Debes seleccionar una application y tener sesion activa para calificar.')
      }

      return upsertApplicationRating({
        applicationId: selectedApplicationId,
        authorUserId: session.authUser.id,
        score: Number(score)
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pipeline-board', tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['pipeline-activity', selectedApplicationId] })
      ])
      toast.success('Rating actualizado', {
        description: 'La evaluacion del applicant ya quedo guardada.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos guardar el rating',
        source: 'pipeline.rate',
        route: surfacePaths.workspace.pipeline,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  if (!tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No tienes un workspace operativo activo</CardTitle>
          <CardDescription>El pipeline ATS-lite se habilita para tenants aprobados con acceso de coordinador.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (boardQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando pipeline</CardTitle>
          <CardDescription>Estamos recuperando stages y applicants para este tenant.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (boardQuery.error || !boardQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No pudimos cargar el pipeline</CardTitle>
          <CardDescription>{toErrorMessage(boardQuery.error)}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const filteredApplications = boardQuery.data.applications.filter((application) => {
    const normalizedCandidateQuery = candidateQuery.trim().toLowerCase()
    const candidateMatches =
      normalizedCandidateQuery.length === 0 ||
      application.candidate_display_name_snapshot.toLowerCase().includes(normalizedCandidateQuery) ||
      (application.candidate_email_snapshot ?? '').toLowerCase().includes(normalizedCandidateQuery)

    const jobMatches = jobFilter.length === 0 || application.job_posting?.id === jobFilter
    const stageMatches = stageFilter.length === 0 || application.current_stage_id === stageFilter
    const statusMatches = statusFilter.length === 0 || application.status_public === statusFilter

    return candidateMatches && jobMatches && stageMatches && statusMatches
  })

  const stageNameById = Object.fromEntries(boardQuery.data.stages.map((stage) => [stage.id, stage.name]))
  const tenantJobs = Array.from(
    new Map(
      boardQuery.data.applications
        .flatMap((application) => (application.job_posting?.id ? [[application.job_posting.id, application.job_posting]] : []))
    ).values()
  )
  const visibleSelectedApplication = filteredApplications.find((application) => application.id === selectedApplicationId) ?? selectedApplication

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pipeline"
        title="Mueve candidatos por etapa sin perder contexto del proceso"
        description="Filtra rápido, revisa actividad y registra decisiones del equipo desde un pipeline más compacto y accionable."
      />

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtros del pipeline</CardTitle>
              <CardDescription>Reduce la vista por candidato, vacante, etapa o estado antes de revisar detalle o exportar.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Input
                placeholder="Buscar candidato o email"
                value={candidateQuery}
                onChange={(event) => setCandidateQuery(event.target.value)}
              />
              <Select value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
                <option value="">Todas las vacantes</option>
                {tenantJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </Select>
              <Select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                <option value="">Todos los stages</option>
                {boardQuery.data.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </Select>
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos los estados</option>
                <option value="submitted">submitted</option>
                <option value="in_review">in_review</option>
                <option value="interview">interview</option>
                <option value="offer">offer</option>
                <option value="hired">hired</option>
                <option value="rejected">rejected</option>
              </Select>
              {canExportApplications ? (
                <Button
                  variant="outline"
                  onClick={() => exportApplicationsCsv(filteredApplications, stageNameById)}
                  disabled={filteredApplications.length === 0}
                >
                  Exportar CSV
                </Button>
              ) : (
                <div className="rounded-2xl border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-3 text-sm text-(--app-text-muted)">
                  `application:export` habilita export.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {boardQuery.data.stages.map((stage) => {
            const stageApplications = filteredApplications.filter((application) => application.current_stage_id === stage.id)

            return (
              <Card key={stage.id} className="min-h-[240px]">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg">{stage.name}</CardTitle>
                    <Badge variant="outline">{stageApplications.length}</Badge>
                  </div>
                  <CardDescription>{stage.code}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stageApplications.length > 0 ? (
                    stageApplications.map((application) => (
                      <button
                        key={application.id}
                        type="button"
                        onClick={() => setSelectedApplicationId(application.id)}
                        className={`grid w-full gap-2 rounded-[24px] border px-4 py-4 text-left transition ${
                          selectedApplicationId === application.id
                            ? 'border-primary-300 bg-primary-50/70 shadow-[0_16px_32px_rgba(79,110,216,0.08)] hover:border-primary-400 hover:bg-primary-50/90 dark:border-primary-500/30 dark:bg-primary-500/12 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/16'
                            : 'border-(--app-border) bg-(--app-surface-muted) hover:border-primary-300 hover:bg-(--app-surface-elevated) hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] dark:hover:border-primary-500/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-(--app-text)">
                              {application.candidate_display_name_snapshot}
                            </p>
                            <p className="mt-1 text-sm text-(--app-text-muted)">
                              {application.job_posting?.title || 'Vacante'}
                            </p>
                          </div>
                          <Badge variant="outline">{application.status_public}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-(--app-text-subtle)">
                          <span>{application.application_notes?.length ?? 0} notas</span>
                          <span>{application.application_ratings?.length ?? 0} ratings</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-6 text-sm text-(--app-text-muted)">
                      Sin applicants en este stage.
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Actividad del applicant</CardTitle>
            <CardDescription>Selecciona una application para moverla, anotar contexto o asignar rating.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!visibleSelectedApplication ? (
              <div className="rounded-[24px] border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-8 text-sm text-(--app-text-muted)">
                Elige un applicant del tablero para operar el pipeline.
              </div>
            ) : (
              <>
                <div className="rounded-[24px] border border-(--app-border) bg-(--app-surface-muted) p-4">
                  <p className="text-lg font-semibold text-(--app-text)">
                    {visibleSelectedApplication.candidate_display_name_snapshot}
                  </p>
                  <p className="mt-1 text-sm text-(--app-text-muted)">{visibleSelectedApplication.job_posting?.title}</p>
                </div>

                <div className="grid gap-3 rounded-[24px] border border-(--app-border) bg-(--app-surface-muted) p-4">
                  <p className="text-sm font-semibold text-(--app-text)">Mover stage</p>
                  <Select
                    value={visibleSelectedApplication.current_stage_id ?? ''}
                    onChange={(event) => {
                      const nextStageId = event.target.value
                      if (nextStageId) {
                        moveMutation.mutate({
                          applicationId: visibleSelectedApplication.id,
                          toStageId: nextStageId,
                          note: stageNote
                        })
                      }
                    }}
                  >
                    <option value="">Selecciona stage</option>
                    {boardQuery.data.stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </Select>
                  <Textarea
                    rows={3}
                    value={stageNote}
                    onChange={(event) => setStageNote(event.target.value)}
                    placeholder="Nota opcional del movimiento"
                  />
                </div>

                <div className="grid gap-3 rounded-[24px] border border-(--app-border) bg-(--app-surface-muted) p-4">
                  <p className="text-sm font-semibold text-(--app-text)">Agregar nota</p>
                  <Textarea rows={4} value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Contexto, decision o siguiente paso" />
                  <Button onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending || newNote.trim().length === 0}>
                    {noteMutation.isPending ? 'Guardando nota...' : 'Guardar nota'}
                  </Button>
                </div>

                <div className="grid gap-3 rounded-[24px] border border-(--app-border) bg-(--app-surface-muted) p-4">
                  <p className="text-sm font-semibold text-(--app-text)">Rating</p>
                  <Select value={score} onChange={(event) => setScore(event.target.value)}>
                    <option value="1">1/5</option>
                    <option value="2">2/5</option>
                    <option value="3">3/5</option>
                    <option value="4">4/5</option>
                    <option value="5">5/5</option>
                  </Select>
                  <Button onClick={() => ratingMutation.mutate()} disabled={ratingMutation.isPending}>
                    {ratingMutation.isPending ? 'Guardando rating...' : 'Guardar rating'}
                  </Button>
                </div>

                <div className="grid gap-3">
                  <p className="text-sm font-semibold text-(--app-text)">Historial</p>
                  {activityQuery.isLoading ? (
                    <p className="text-sm text-(--app-text-muted)">Cargando actividad...</p>
                  ) : (
                    <>
                      {activityQuery.data?.history.map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-4 py-3 text-sm">
                          <p className="font-semibold text-(--app-text)">
                            {entry.from_stage?.name || 'Inicio'} → {entry.to_stage?.name}
                          </p>
                          <p className="mt-1 text-(--app-text-muted)">{entry.note || 'Sin nota adicional'}</p>
                        </div>
                      ))}
                      {activityQuery.data?.notes.map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-4 py-3 text-sm">
                          <p className="font-semibold text-(--app-text)">Nota</p>
                          <p className="mt-1 text-(--app-text-muted)">{entry.body}</p>
                        </div>
                      ))}
                      {activityQuery.data?.ratings.map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-4 py-3 text-sm">
                          <p className="font-semibold text-(--app-text)">Rating</p>
                          <p className="mt-1 text-(--app-text-muted)">{entry.score}/5</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
