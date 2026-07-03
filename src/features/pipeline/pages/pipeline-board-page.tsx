import { useEffect, useRef, useState, type WheelEvent } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { Download, Plus, Search, Star } from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageLoader, Spinner } from '@/components/ui/loader'
import { Select } from '@/components/ui/select'
import { SideSheet } from '@/components/ui/side-sheet'
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
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cn } from '@/lib/utils/cn'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'

type PipelineBoard = Awaited<ReturnType<typeof fetchPipelineBoard>>
type PipelineStage = PipelineBoard['stages'][number]
type PipelineApplication = PipelineBoard['applications'][number]

const INITIAL_STAGE_CARD_COUNT = 12
const STAGE_CARD_BATCH_SIZE = 12
const STAGE_LOAD_DELAY_MS = 360

const STAGE_TONES = [
  {
    key: 'applied',
    dotClassName: 'bg-[#2f6fe0]',
    trackClassName: 'bg-[#2f6fe0]',
    pillClassName:
      'border-primary-100 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/12 dark:text-primary-200'
  },
  {
    key: 'screening',
    dotClassName: 'bg-[#8f57e6]',
    trackClassName: 'bg-[#8f57e6]',
    pillClassName:
      'border-[#d9ccfb] bg-[#efeafc] text-[#6a46c1] dark:border-[#8f57e6]/30 dark:bg-[#8f57e6]/14 dark:text-[#c7b7ff]'
  },
  {
    key: 'interview',
    dotClassName: 'bg-[#e0a13a]',
    trackClassName: 'bg-[#e0a13a]',
    pillClassName:
      'border-[#f4dfb7] bg-[#fbf2e2] text-[#a9760f] dark:border-[#e0a13a]/30 dark:bg-[#e0a13a]/14 dark:text-[#f3c56a]'
  },
  {
    key: 'offer',
    dotClassName: 'bg-[#17a7ae]',
    trackClassName: 'bg-[#17a7ae]',
    pillClassName:
      'border-[#bfe5e6] bg-[#e3f5f5] text-[#127e86] dark:border-[#17a7ae]/30 dark:bg-[#17a7ae]/14 dark:text-[#7ad8de]'
  },
  {
    key: 'hired',
    dotClassName: 'bg-[#1f9d61]',
    trackClassName: 'bg-[#1f9d61]',
    pillClassName:
      'border-[#c7ecd8] bg-[#e9f7ef] text-[#1f9d61] dark:border-[#1f9d61]/30 dark:bg-[#1f9d61]/14 dark:text-[#7ee1a8]'
  },
  {
    key: 'rejected',
    dotClassName: 'bg-[#d2455f]',
    trackClassName: 'bg-[#d2455f]',
    pillClassName:
      'border-[#f6cbd3] bg-[#fdecef] text-[#d2455f] dark:border-[#d2455f]/30 dark:bg-[#d2455f]/14 dark:text-[#f3a0ad]'
  }
] as const

function getStageTone(stage: PipelineStage, index: number) {
  const normalizedStage = `${stage.code} ${stage.name}`.toLowerCase()
  const matchedTone = STAGE_TONES.find((tone) => normalizedStage.includes(tone.key))

  return matchedTone ?? STAGE_TONES[index % STAGE_TONES.length]
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

function getLatestRating(application: PipelineApplication) {
  return (application.application_ratings ?? []).reduce<PipelineApplication['application_ratings'][number] | null>(
    (latest, rating) => {
      if (!latest) {
        return rating
      }

      return new Date(rating.created_at).getTime() > new Date(latest.created_at).getTime() ? rating : latest
    },
    null
  )
}

export function PipelineBoardPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()
  const tenantId = session.activeTenantId
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null)
  const [selectedStageId, setSelectedStageId] = useState('')
  const [stageNote, setStageNote] = useState('')
  const [newNote, setNewNote] = useState('')
  const [score, setScore] = useState('')
  const [candidateQuery, setCandidateQuery] = useState('')
  const [jobFilter, setJobFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)
  const [visibleCardsByStageId, setVisibleCardsByStageId] = useState<Record<string, number>>({})
  const [loadingStageIds, setLoadingStageIds] = useState<Record<string, boolean>>({})
  const stageLoadTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const boardScrollRef = useRef<HTMLDivElement | null>(null)

  const boardQuery = useQuery({
    queryKey: ['pipeline-board', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => fetchPipelineBoard(tenantId!)
  })

  // En vivo: el tablero refleja al instante nuevas postulaciones o movimientos de
  // etapa hechos por otra persona del equipo. RLS acota los eventos al tenant.
  useRealtimeSync(
    'pipeline-board',
    [
      { table: 'applications', invalidate: [['pipeline-board', tenantId]] },
      { table: 'application_stage_history', invalidate: [['pipeline-board', tenantId]] }
    ],
    { enabled: Boolean(tenantId) }
  )

  const activityQuery = useQuery({
    queryKey: ['pipeline-activity', selectedApplicationId],
    enabled: Boolean(selectedApplicationId),
    queryFn: async () => fetchApplicationActivity(selectedApplicationId!)
  })

  const selectedApplication = boardQuery.data?.applications.find((application) => application.id === selectedApplicationId) ?? null
  const canExportApplications = session.permissions.includes('application:export')

  useEffect(() => {
    return () => {
      Object.values(stageLoadTimersRef.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const moveMutation = useMutation({
    mutationFn: moveApplicationStage,
    onSuccess: async () => {
      setStageNote('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pipeline-board', tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['applications'] }),
        queryClient.invalidateQueries({ queryKey: ['pipeline-activity', selectedApplicationId] })
      ])
      toast.success('Etapa actualizada', {
        description: 'La persona candidata ya se movió de etapa y el historial quedó auditado.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos mover la postulación de etapa',
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
        throw new Error('Debes seleccionar una postulación y tener sesión activa para agregar notas.')
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
        description: 'La colaboración del equipo ya quedó asociada a esta postulación.'
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
        throw new Error('Debes seleccionar una postulación y tener sesión activa para calificar.')
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
        description: 'La evaluación de esta postulación ya quedó guardada.'
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
          <CardDescription>El proceso de selección se habilita para tenants aprobados con acceso de coordinador.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (boardQuery.isLoading) {
    return <PageLoader label="Cargando proceso de selección" hint="Estamos recuperando etapas y postulaciones para este tenant" />
  }

  if (boardQuery.error || !boardQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No pudimos cargar el proceso de selección</CardTitle>
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
  const visibleStages = stageFilter
    ? boardQuery.data.stages.filter((stage) => stage.id === stageFilter)
    : boardQuery.data.stages
  const visibleSelectedApplication =
    filteredApplications.find((application) => application.id === selectedApplicationId) ?? selectedApplication
  const applicationActivity = activityQuery.data
  const selectedStage = boardQuery.data.stages.find((stage) => stage.id === visibleSelectedApplication?.current_stage_id)
  const selectedStageTone = selectedStage
    ? getStageTone(selectedStage, boardQuery.data.stages.findIndex((stage) => stage.id === selectedStage.id))
    : STAGE_TONES[0]

  function resetStageCardLoading() {
    Object.values(stageLoadTimersRef.current).forEach((timer) => clearTimeout(timer))
    stageLoadTimersRef.current = {}
    setVisibleCardsByStageId({})
    setLoadingStageIds({})
  }

  function applyCandidateQuery(value: string) {
    setCandidateQuery(value)
    resetStageCardLoading()
  }

  function applyJobFilter(value: string) {
    setJobFilter(value)
    resetStageCardLoading()
  }

  function applyStageFilter(value: string) {
    setStageFilter(value)
    resetStageCardLoading()
  }

  function openApplication(application: PipelineApplication) {
    const latestRating = getLatestRating(application)
    setSelectedApplicationId(application.id)
    setSelectedStageId(application.current_stage_id ?? '')
    setStageNote('')
    setNewNote('')
    setScore(latestRating ? String(latestRating.score) : '')
  }

  function handleDropOnStage(stageId: string) {
    const application = boardQuery.data?.applications.find((item) => item.id === draggedId)
    setDragOverStageId(null)
    setDraggedId(null)
    if (application && application.current_stage_id !== stageId) {
      moveMutation.mutate({ applicationId: application.id, toStageId: stageId })
    }
  }

  function requestMoreStageCards(stageId: string, totalCards: number) {
    const visibleCount = visibleCardsByStageId[stageId] ?? INITIAL_STAGE_CARD_COUNT

    if (visibleCount >= totalCards || loadingStageIds[stageId] || stageLoadTimersRef.current[stageId]) {
      return
    }

    setLoadingStageIds((current) => ({ ...current, [stageId]: true }))
    stageLoadTimersRef.current[stageId] = setTimeout(() => {
      setVisibleCardsByStageId((current) => ({
        ...current,
        [stageId]: Math.min((current[stageId] ?? INITIAL_STAGE_CARD_COUNT) + STAGE_CARD_BATCH_SIZE, totalCards)
      }))
      setLoadingStageIds((current) => {
        const next = { ...current }
        delete next[stageId]
        return next
      })
      delete stageLoadTimersRef.current[stageId]
    }, STAGE_LOAD_DELAY_MS)
  }

  function handleStageListScroll(stageId: string, totalCards: number, element: HTMLDivElement) {
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight

    if (distanceToBottom <= 120) {
      requestMoreStageCards(stageId, totalCards)
    }
  }

  function handleStageListWheel(event: WheelEvent<HTMLDivElement>) {
    const boardElement = boardScrollRef.current
    const horizontalDelta = event.shiftKey ? event.deltaY : event.deltaX
    const hasHorizontalIntent = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)

    if (!boardElement || !hasHorizontalIntent || horizontalDelta === 0) {
      return
    }

    const maxScrollLeft = boardElement.scrollWidth - boardElement.clientWidth
    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, boardElement.scrollLeft + horizontalDelta))

    if (nextScrollLeft !== boardElement.scrollLeft) {
      event.preventDefault()
      event.stopPropagation()
      boardElement.scrollLeft = nextScrollLeft
    }
  }

  function handleMoveSelectedApplication() {
    if (!visibleSelectedApplication || !selectedStageId) {
      return
    }

    moveMutation.mutate({
      applicationId: visibleSelectedApplication.id,
      toStageId: selectedStageId,
      note: stageNote
    })
  }

  return (
    <motion.div
      className="flex h-[calc(100svh-13.5rem)] min-h-0 flex-col overflow-hidden lg:h-[calc(100svh-8.5rem)]"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.section
        variants={cardReveal}
        className="flex shrink-0 flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">
            Proceso de selección
            <span className="inline-flex rounded-full border border-(--app-border) bg-(--app-surface) px-3 py-1 text-xs font-semibold text-(--app-text-muted)">
              <span className="font-bold text-primary-700 dark:text-primary-200">{filteredApplications.length}</span>
              <span className="ml-1">candidatos en proceso</span>
            </span>
          </h1>
          <p className="mt-1 text-sm text-(--app-text-muted)">
            Revisa candidatos por etapa, filtra el tablero y registra decisiones sin salir del flujo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {canExportApplications ? (
            <Button
              className="h-10 rounded-control"
              variant="outline"
              onClick={() => exportApplicationsCsv(filteredApplications, stageNameById)}
              disabled={filteredApplications.length === 0}
            >
              <Download className="size-4" />
              Exportar CSV
            </Button>
          ) : null}
          <Button className="h-10 rounded-control" onClick={() => toast.info('Agregar candidato próximamente')}>
            <Plus className="size-4" />
            Agregar candidato
          </Button>
        </div>
      </motion.section>

      <motion.div variants={cardReveal} className="flex shrink-0 flex-col gap-3 pb-4 lg:flex-row lg:items-center">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-control border border-(--app-border) bg-(--app-surface-elevated) px-3.5 transition-[border-color,box-shadow] focus-within:border-primary-600 focus-within:ring-3 focus-within:ring-primary-600/10">
          <Search aria-hidden="true" className="size-4 shrink-0 text-(--app-text-subtle)" />
          <span className="sr-only">Buscar candidato o correo</span>
          <Input
            value={candidateQuery}
            placeholder="Buscar candidato o correo..."
            className="h-full rounded-none border-0 bg-transparent px-0 shadow-none hover:border-0 focus:border-0 focus:bg-transparent focus:ring-0"
            onChange={(event) => applyCandidateQuery(event.target.value)}
          />
        </label>
        <Select className="rounded-control lg:w-56" value={jobFilter} onChange={(event) => applyJobFilter(event.target.value)}>
          <option value="">Todas las vacantes</option>
          {tenantJobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </Select>
        <Select className="rounded-control lg:w-56" value={stageFilter} onChange={(event) => applyStageFilter(event.target.value)}>
          <option value="">Todas las etapas</option>
          {boardQuery.data.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </Select>
      </motion.div>

      {filteredApplications.length === 0 ? (
        <motion.div
          variants={cardReveal}
          className="flex min-h-0 flex-1 items-center justify-center rounded-card border border-dashed border-(--app-border) bg-(--app-surface-elevated) px-6 text-center text-sm text-(--app-text-muted)"
        >
          No se encontraron candidatos con esos filtros.
        </motion.div>
      ) : (
        <motion.div
          ref={boardScrollRef}
          variants={gridStagger}
          className="tm-scrollbar flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4"
        >
          {visibleStages.map((stage, stageIndex) => {
            const stageApplications = filteredApplications.filter((application) => application.current_stage_id === stage.id)
            const visibleStageCardCount = visibleCardsByStageId[stage.id] ?? INITIAL_STAGE_CARD_COUNT
            const visibleStageApplications = stageApplications.slice(0, visibleStageCardCount)
            const hasMoreStageApplications = visibleStageCardCount < stageApplications.length
            const isLoadingMoreStageApplications = Boolean(loadingStageIds[stage.id])
            const isDropTarget = dragOverStageId === stage.id
            const tone = getStageTone(stage, stageIndex)

            return (
              <motion.div
                variants={cardReveal}
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
                  'flex min-h-0 min-w-80 flex-1 shrink-0 flex-col rounded-card border transition lg:min-w-88',
                  isDropTarget
                    ? 'border-primary-400 bg-primary-50/70 dark:bg-primary-500/10'
                    : 'border-(--app-border) bg-(--app-surface-muted)/80'
                )}
              >
                <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-3 pt-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('size-2.5 shrink-0 rounded-full', tone.dotClassName)} />
                    <span className="truncate text-sm font-semibold text-(--app-text)">{stage.name}</span>
                  </div>
                  <span className="rounded-full border border-(--app-border) bg-(--app-surface) px-2.5 py-0.5 text-xs font-bold text-(--app-text-muted)">
                    {stageApplications.length}
                  </span>
                </div>
                <div className={cn('mx-4 h-1 shrink-0 rounded-full', tone.trackClassName)} />

                <div
                  className="tm-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2.5 py-3"
                  onScroll={(event) => handleStageListScroll(stage.id, stageApplications.length, event.currentTarget)}
                  onWheel={handleStageListWheel}
                >
                  {stageApplications.length > 0 ? (
                    visibleStageApplications.map((application) => {
                      const latestRating = getLatestRating(application)

                      return (
                        <button
                          key={application.id}
                          type="button"
                          draggable
                          onDragStart={() => setDraggedId(application.id)}
                          onDragEnd={() => {
                            setDraggedId(null)
                            setDragOverStageId(null)
                          }}
                          onClick={() => openApplication(application)}
                          className={cn(
                            'flex min-h-14 w-full cursor-grab items-center gap-3 rounded-control border bg-(--app-surface) px-3 py-2.5 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-[#c6d2ea] hover:shadow-[0_4px_14px_rgba(20,40,90,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) active:cursor-grabbing',
                            selectedApplicationId === application.id
                              ? 'border-primary-300 ring-1 ring-primary-200'
                              : 'border-(--app-border)',
                            draggedId === application.id ? 'opacity-50' : ''
                          )}
                        >
                          <span className="flex size-8.5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4869b6,#8aa2d8)] text-[11px] font-bold text-white">
                            {initialsFrom(application.candidate_display_name_snapshot)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.84rem] font-semibold text-(--app-text)">
                              {application.candidate_display_name_snapshot}
                            </span>
                            <span className="mt-0.5 block truncate text-[0.72rem] text-(--app-text-subtle)">
                              {application.job_posting?.title || 'Vacante'}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center gap-1 text-xs font-semibold',
                              latestRating ? 'text-[#a9760f]' : 'text-(--app-text-subtle) opacity-60'
                            )}
                          >
                            <Star className="size-3.5 fill-current" />
                            {latestRating?.score ?? null}
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="px-3 py-7 text-center text-xs text-(--app-text-subtle)">Sin candidatos</div>
                  )}
                  {hasMoreStageApplications ? (
                    <button
                      type="button"
                      className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-dashed border-(--app-border) bg-(--app-surface)/70 px-3 text-xs font-medium text-(--app-text-subtle) transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) dark:hover:bg-primary-500/12 dark:hover:text-primary-200"
                      onClick={() => requestMoreStageCards(stage.id, stageApplications.length)}
                      disabled={isLoadingMoreStageApplications}
                    >
                      {isLoadingMoreStageApplications ? (
                        <>
                          <Spinner size="sm" /> Cargando más candidatos...
                        </>
                      ) : (
                        'Cargar más'
                      )}
                    </button>
                  ) : stageApplications.length > INITIAL_STAGE_CARD_COUNT ? (
                    <p className="py-2 text-center text-[0.72rem] text-(--app-text-subtle)">No hay más candidatos</p>
                  ) : null}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {visibleSelectedApplication ? (
        <SideSheet
          open={Boolean(visibleSelectedApplication)}
          onClose={() => setSelectedApplicationId(null)}
          widthClassName="max-w-md"
          title={
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2d52a8,#8aa2d8)] text-sm font-semibold text-white">
                {initialsFrom(visibleSelectedApplication.candidate_display_name_snapshot)}
              </span>
              <span className="min-w-0">
                <span className="block truncate">{visibleSelectedApplication.candidate_display_name_snapshot}</span>
              </span>
            </span>
          }
          description={visibleSelectedApplication.job_posting?.title ?? visibleSelectedApplication.candidate_email_snapshot}
        >
          <div className="space-y-3.5">
            <section className="rounded-card border border-(--app-border) bg-(--app-surface) p-4">
              <h2 className="text-sm font-semibold text-(--app-text)">Mover etapa</h2>
              <Badge className={cn('mt-3 border', selectedStageTone.pillClassName)} variant="outline">
                Etapa actual · {selectedStage?.name ?? 'Sin etapa'}
              </Badge>

              <div className="mt-4 grid gap-3">
                <label className="grid gap-1.5 text-xs font-semibold text-(--app-text-muted)">
                  Nueva etapa
                  <Select
                    className="rounded-control"
                    value={selectedStageId}
                    onChange={(event) => setSelectedStageId(event.target.value)}
                  >
                    <option value="">Selecciona etapa</option>
                    {boardQuery.data.stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-(--app-text-muted)">
                  <span>
                    Contexto del movimiento <span className="font-medium text-(--app-text-subtle)">(opcional)</span>
                  </span>
                  <Textarea
                    className="rounded-control"
                    rows={3}
                    value={stageNote}
                    onChange={(event) => setStageNote(event.target.value)}
                    placeholder="Ej. Pasa a entrevista técnica el jueves..."
                  />
                </label>
                <Button
                  className="w-full rounded-control"
                  onClick={handleMoveSelectedApplication}
                  disabled={
                    moveMutation.isPending ||
                    !selectedStageId ||
                    selectedStageId === visibleSelectedApplication.current_stage_id
                  }
                >
                  {moveMutation.isPending ? 'Actualizando etapa...' : 'Actualizar etapa'}
                </Button>
              </div>
            </section>

            <section className="rounded-card border border-(--app-border) bg-(--app-surface) p-4">
              <h2 className="text-sm font-semibold text-(--app-text)">Anotar colaboración</h2>
              <label className="mt-3 grid gap-1.5 text-xs font-semibold text-(--app-text-muted)">
                Nota interna para el equipo
                <Textarea
                  className="rounded-control"
                  rows={4}
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  placeholder="Escribe una nota interna para el equipo..."
                />
              </label>
              <Button
                className="mt-3 w-full rounded-control"
                variant="outline"
                onClick={() => noteMutation.mutate()}
                disabled={noteMutation.isPending || newNote.trim().length === 0}
              >
                {noteMutation.isPending ? 'Guardando nota...' : 'Guardar nota'}
              </Button>
            </section>

            <section className="rounded-card border border-(--app-border) bg-(--app-surface) p-4">
              <h2 className="text-sm font-semibold text-(--app-text)">Rating rápido</h2>
              <div className="mt-3 flex gap-2.5">
                <Select className="rounded-control" value={score} onChange={(event) => setScore(event.target.value)}>
                  <option value="">Sin calificar</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </Select>
                <Button
                  className="shrink-0 rounded-control"
                  variant="outline"
                  onClick={() => ratingMutation.mutate()}
                  disabled={ratingMutation.isPending || !score}
                >
                  {ratingMutation.isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </section>

            <section className="rounded-card border border-(--app-border) bg-(--app-surface) p-4">
              <h2 className="text-sm font-semibold text-(--app-text)">Actividad reciente</h2>
              <div className="mt-3 space-y-3">
                {activityQuery.isLoading ? (
                  <p className="inline-flex items-center gap-2 text-sm text-(--app-text-muted)">
                    <Spinner size="sm" /> Cargando actividad...
                  </p>
                ) : activityQuery.error ? (
                  <p className="text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(activityQuery.error)}</p>
                ) : applicationActivity && (applicationActivity.history.length || applicationActivity.notes.length || applicationActivity.ratings.length) ? (
                  <>
                    {applicationActivity.history.map((event) => (
                      <div key={event.id} className="rounded-control border border-(--app-border) bg-(--app-surface-muted) px-3 py-3 text-sm">
                        <p className="font-medium text-(--app-text)">Cambio de etapa</p>
                        <p className="mt-1 text-(--app-text-muted)">
                          {(event.from_stage?.name ?? 'Inicio')} → {event.to_stage.name}
                        </p>
                      </div>
                    ))}
                    {applicationActivity.notes.map((event) => (
                      <div key={event.id} className="rounded-control border border-(--app-border) bg-(--app-surface-muted) px-3 py-3 text-sm">
                        <p className="font-medium text-(--app-text)">Nota interna</p>
                        <p className="mt-1 text-(--app-text-muted)">{event.body}</p>
                      </div>
                    ))}
                    {applicationActivity.ratings.map((event) => (
                      <div key={event.id} className="rounded-control border border-(--app-border) bg-(--app-surface-muted) px-3 py-3 text-sm">
                        <p className="font-medium text-(--app-text)">Rating registrado</p>
                        <p className="mt-1 text-(--app-text-muted)">Score: {event.score}/5</p>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-(--app-text-muted)">
                    Aún no hay actividad registrada para este candidato.
                  </p>
                )}
              </div>
            </section>
          </div>
        </SideSheet>
      ) : null}
    </motion.div>
  )
}
