import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { cn } from '@/lib/utils/cn'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

const STAGE_DOT_COLORS = ['bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-indigo-500']

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
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)

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
        description: 'El applicant ya se movio en el pipeline y el historial quedó auditado.'
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
        throw new Error('Debes seleccionar una application y tener sesión activa para agregar notas.')
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
        description: 'La colaboracion del equipo ya quedó asociada al applicant.'
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
        throw new Error('Debes seleccionar una application y tener sesión activa para calificar.')
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
        description: 'La evaluación del applicant ya quedó guardada.'
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
          <CardDescription>El pipeline se habilita para tenants aprobados con acceso de coordinador.</CardDescription>
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

    return candidateMatches && jobMatches && stageMatches
  })

  const stageNameById = Object.fromEntries(boardQuery.data.stages.map((stage) => [stage.id, stage.name]))
  const tenantJobs = Array.from(
    new Map(
      boardQuery.data.applications.flatMap((application) =>
        application.job_posting?.id ? [[application.job_posting.id, application.job_posting]] : []
      )
    ).values()
  )
  const visibleSelectedApplication =
    filteredApplications.find((application) => application.id === selectedApplicationId) ?? selectedApplication
  const applicationActivity = activityQuery.data

  function handleDropOnStage(stageId: string) {
    const application = boardQuery.data?.applications.find((item) => item.id === draggedId)
    setDragOverStageId(null)
    setDraggedId(null)
    if (application && application.current_stage_id !== stageId) {
      moveMutation.mutate({ applicationId: application.id, toStageId: stageId })
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[1.7rem] font-semibold tracking-tight text-(--app-text) sm:text-[2rem]">Pipeline</h1>
          <p className="mt-1 text-sm text-(--app-text-muted)">{filteredApplications.length} candidatos en proceso</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {canExportApplications ? (
            <Button
              variant="outline"
              onClick={() => exportApplicationsCsv(filteredApplications, stageNameById)}
              disabled={filteredApplications.length === 0}
            >
              Exportar CSV
            </Button>
          ) : null}
          <Button onClick={() => toast.info('Agregar candidato próximamente')}>Agregar candidato</Button>
        </div>
      </section>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-(--app-border) bg-(--app-surface) px-3.5">
          <Search aria-hidden="true" className="size-4 text-(--app-text-subtle)" />
          <input
            value={candidateQuery}
            onChange={(event) => setCandidateQuery(event.target.value)}
            placeholder="Buscar candidato o email..."
            className="h-11 w-full bg-transparent text-sm text-(--app-text) outline-none placeholder:text-(--app-text-subtle)"
          />
        </div>
        <Select className="lg:w-52" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
          <option value="">Todas las vacantes</option>
          {tenantJobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </Select>
        <Select className="lg:w-52" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
          <option value="">Todas las etapas</option>
          {boardQuery.data.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {boardQuery.data.stages.map((stage, stageIndex) => {
          const stageApplications = filteredApplications.filter((application) => application.current_stage_id === stage.id)
          const isDropTarget = dragOverStageId === stage.id

          return (
            <div
              key={stage.id}
              onDragOver={(event) => {
                event.preventDefault()
                if (dragOverStageId !== stage.id) {
                  setDragOverStageId(stage.id)
                }
              }}
              onDragLeave={() => setDragOverStageId((current) => (current === stage.id ? null : current))}
              onDrop={() => handleDropOnStage(stage.id)}
              className={cn(
                'flex min-h-104 w-[18rem] shrink-0 flex-col rounded-panel border p-3 transition',
                isDropTarget ? 'border-primary-400 bg-primary-50/70 dark:bg-primary-500/10' : 'border-(--app-border) bg-(--app-surface-muted)/70'
              )}
            >
              <div className="flex items-center justify-between px-1 pb-3">
                <div className="flex items-center gap-2">
                  <span className={cn('size-2 rounded-full', STAGE_DOT_COLORS[stageIndex % STAGE_DOT_COLORS.length])} />
                  <span className="text-sm font-semibold text-(--app-text)">{stage.name}</span>
                </div>
                <span className="rounded-full bg-(--app-surface) px-2 py-0.5 text-xs font-semibold text-(--app-text-muted)">
                  {stageApplications.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2.5">
                {stageApplications.length > 0 ? (
                  stageApplications.map((application) => (
                    <article
                      key={application.id}
                      draggable
                      onDragStart={() => setDraggedId(application.id)}
                      onDragEnd={() => {
                        setDraggedId(null)
                        setDragOverStageId(null)
                      }}
                      onClick={() => setSelectedApplicationId(application.id)}
                      className={cn(
                        'cursor-grab rounded-2xl border bg-(--app-surface) p-3 shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:shadow-[0_10px_24px_rgba(15,23,42,0.1)] active:cursor-grabbing',
                        selectedApplicationId === application.id ? 'border-primary-300 ring-1 ring-primary-200' : 'border-(--app-border)',
                        draggedId === application.id ? 'opacity-50' : ''
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2d52a8,#8aa2d8)] text-[11px] font-semibold text-white">
                          {initialsFrom(application.candidate_display_name_snapshot)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-(--app-text)">{application.candidate_display_name_snapshot}</p>
                          <p className="truncate text-xs text-(--app-text-muted)">{application.job_posting?.title || 'Vacante'}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <Badge variant="outline">{application.status_public}</Badge>
                        <span className="text-xs text-(--app-text-subtle)">
                          {application.application_notes?.length ?? 0} · {application.application_ratings?.length ?? 0}★
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-(--app-border) px-3 py-6 text-center text-xs text-(--app-text-subtle)">
                    Arrastra candidatos aquí
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {visibleSelectedApplication ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Cerrar detalle"
            type="button"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setSelectedApplicationId(null)}
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-(--app-surface) shadow-[0_0_60px_rgba(8,12,24,0.3)]">
            <header className="flex items-start justify-between gap-3 border-b border-(--app-border) px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2d52a8,#8aa2d8)] text-sm font-semibold text-white">
                  {initialsFrom(visibleSelectedApplication.candidate_display_name_snapshot)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-(--app-text)">{visibleSelectedApplication.candidate_display_name_snapshot}</p>
                  <p className="truncate text-sm text-(--app-text-muted)">{visibleSelectedApplication.job_posting?.title}</p>
                </div>
              </div>
              <button
                aria-label="Cerrar"
                type="button"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-(--app-border) text-(--app-text-muted) transition hover:bg-(--app-surface-muted)"
                onClick={() => setSelectedApplicationId(null)}
              >
                <X className="size-4.5" />
              </button>
            </header>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 rounded-panel border border-(--app-border) bg-(--app-surface-muted) p-4">
                <p className="text-sm font-semibold text-(--app-text)">Mover etapa</p>
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
                  <option value="">Selecciona etapa</option>
                  {boardQuery.data.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </Select>
                <Textarea rows={3} value={stageNote} onChange={(event) => setStageNote(event.target.value)} placeholder="Contexto opcional para el movimiento" />
              </div>

              <div className="grid gap-3 rounded-panel border border-(--app-border) bg-(--app-surface-muted) p-4">
                <p className="text-sm font-semibold text-(--app-text)">Anotar colaboración</p>
                <Textarea rows={4} value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Escribe una nota interna para el equipo..." />
                <Button onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending || newNote.trim().length === 0}>
                  {noteMutation.isPending ? 'Guardando nota...' : 'Guardar nota'}
                </Button>
              </div>

              <div className="grid gap-3 rounded-panel border border-(--app-border) bg-(--app-surface-muted) p-4">
                <p className="text-sm font-semibold text-(--app-text)">Rating rápido</p>
                <Select value={score} onChange={(event) => setScore(event.target.value)}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </Select>
                <Button variant="outline" onClick={() => ratingMutation.mutate()} disabled={ratingMutation.isPending}>
                  {ratingMutation.isPending ? 'Guardando rating...' : 'Guardar rating'}
                </Button>
              </div>

              <div className="rounded-panel border border-(--app-border) bg-(--app-surface) p-4">
                <p className="text-sm font-semibold text-(--app-text)">Actividad reciente</p>
                <div className="mt-3 space-y-3">
                  {activityQuery.isLoading ? (
                    <p className="text-sm text-(--app-text-muted)">Cargando actividad...</p>
                  ) : activityQuery.error ? (
                    <p className="text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(activityQuery.error)}</p>
                  ) : applicationActivity && (applicationActivity.history.length || applicationActivity.notes.length || applicationActivity.ratings.length) ? (
                    <>
                      {applicationActivity.history.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-3 py-3 text-sm">
                          <p className="font-medium text-(--app-text)">Cambio de etapa</p>
                          <p className="mt-1 text-(--app-text-muted)">
                            {(event.from_stage?.name ?? 'Inicio')} → {event.to_stage.name}
                          </p>
                        </div>
                      ))}
                      {applicationActivity.notes.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-3 py-3 text-sm">
                          <p className="font-medium text-(--app-text)">Nota interna</p>
                          <p className="mt-1 text-(--app-text-muted)">{event.body}</p>
                        </div>
                      ))}
                      {applicationActivity.ratings.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-3 py-3 text-sm">
                          <p className="font-medium text-(--app-text)">Rating registrado</p>
                          <p className="mt-1 text-(--app-text-muted)">Score: {event.score}/5</p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-sm text-(--app-text-muted)">Aún no hay actividad registrada para este candidato.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
