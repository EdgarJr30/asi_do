import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import quoteData from 'inspirational-quotes/data/data.json'
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Layers,
  Percent,
  Quote,
  Target,
  TrendingUp
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils/cn'
import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/loader'
import { applicationStatusDotClass, applicationStatusLabel } from '@/features/applications/lib/application-status'
import {
  smoothCardReveal as cardReveal,
  smoothGridStagger as gridStagger,
  smoothPageStagger as pageStagger
} from '@/shared/ui/card-motion'
import { listMyApplications } from '@/features/applications/lib/applications-api'
import { listPublicJobs } from '@/features/jobs/lib/jobs-api'
import type { Database } from '@/shared/types/database'

type PublicStatus = Database['public']['Enums']['application_public_status']

const ACTIVE_STATUSES: PublicStatus[] = ['submitted', 'in_review', 'interviewing', 'offer']
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const RECENT_PAGE_SIZE = 8

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

function getApplicationDetailPath(application: { job_posting?: { slug?: string | null } | null }) {
  const slug = application.job_posting?.slug?.trim()

  return slug ? surfacePaths.public.jobDetail(slug) : surfacePaths.candidate.applications
}

type InspirationalQuote = { text: string; from: string }
const inspirationalQuotes = quoteData as InspirationalQuote[]
const FALLBACK_QUOTE: InspirationalQuote = { text: 'El futuro depende de lo que hagas hoy.', from: 'Mahatma Gandhi' }

interface MetricCardData {
  key: string
  icon: LucideIcon
  chipClass: string
  label: string
  value: number
  suffix?: string
  loading: boolean
  sub: string
  trendUp?: boolean
}

export function CandidateHomePage() {
  const session = useAppSession()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const userId = session.authUser?.id ?? null
  const displayName = session.profile?.display_name ?? session.profile?.full_name ?? session.authUser?.email ?? 'candidato'

  const applicationsQuery = useQuery({
    queryKey: ['applications', 'mine', userId],
    enabled: Boolean(userId),
    queryFn: async () => listMyApplications(userId!)
  })

  const openJobsQuery = useQuery({
    queryKey: ['jobs', 'public-board', 'home-count'],
    queryFn: async () => listPublicJobs()
  })

  const [mountTime] = useState(() => Date.now())
  const applications = useMemo(() => applicationsQuery.data ?? [], [applicationsQuery.data])

  const metrics = useMemo(() => {
    const total = applications.length
    const active = applications.filter((application) => ACTIVE_STATUSES.includes(application.status_public)).length
    const interviews = applications.filter((application) => application.status_public === 'interviewing').length
    const responded = applications.filter((application) => application.status_public !== 'submitted').length
    const thisWeek = applications.filter((application) => {
      if (!application.submitted_at) return false
      const submitted = new Date(application.submitted_at).getTime()
      return !Number.isNaN(submitted) && mountTime - submitted <= WEEK_MS
    }).length
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0

    return { total, active, interviews, responded, thisWeek, responseRate }
  }, [applications, mountTime])

  const openJobsCount = openJobsQuery.data?.jobs.length ?? 0
  const appsLoading = applicationsQuery.isLoading

  const metricCards: MetricCardData[] = [
    {
      key: 'active',
      icon: Layers,
      chipClass: 'bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300',
      label: 'Aplicaciones activas',
      value: metrics.active,
      loading: appsLoading,
      sub: metrics.thisWeek > 0 ? `+${metrics.thisWeek} esta semana` : `${metrics.total} en total`,
      trendUp: metrics.thisWeek > 0
    },
    {
      key: 'interviews',
      icon: CalendarClock,
      chipClass: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
      label: 'Entrevistas programadas',
      value: metrics.interviews,
      loading: appsLoading,
      sub: metrics.interviews > 0 ? 'En tus procesos activos' : 'Sin entrevistas aún'
    },
    {
      key: 'response',
      icon: Percent,
      chipClass: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300',
      label: 'Tasa de respuesta',
      value: metrics.responseRate,
      suffix: '%',
      loading: appsLoading,
      sub: metrics.total > 0 ? `${metrics.responded} de ${metrics.total} te respondieron` : 'Aún sin postulaciones'
    },
    {
      key: 'matches',
      icon: Target,
      chipClass: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
      label: 'Vacantes para ti',
      value: openJobsCount,
      loading: openJobsQuery.isLoading,
      sub: 'Abiertas según tu perfil'
    }
  ]

  const [recentPage, setRecentPage] = useState(0)
  const recentTotalPages = Math.max(1, Math.ceil(applications.length / RECENT_PAGE_SIZE))
  const recentPageSafe = Math.min(recentPage, recentTotalPages - 1)
  const recentApplications = applications.slice(
    recentPageSafe * RECENT_PAGE_SIZE,
    recentPageSafe * RECENT_PAGE_SIZE + RECENT_PAGE_SIZE
  )

  const greeting = greetingForNow()

  return (
    <motion.div
      className="space-y-5"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      {/* Saludo + frase del día */}
      <motion.div
        variants={cardReveal}
        className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
      >
        <div className="min-w-0 space-y-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-(--app-text) sm:text-[1.75rem]">
            {greeting}, {firstName(displayName)}
          </h1>
          <DailyQuote />
        </div>
        <div className="flex shrink-0 flex-wrap gap-2.5">
          <Button variant="outline" className="h-10 text-[0.82rem]" onClick={() => void navigate(surfacePaths.candidate.profile)}>
            Editar perfil
          </Button>
          <Button className="h-10 gap-1.5 text-[0.82rem]" onClick={() => void navigate(surfacePaths.storefront.jobs)}>
            Explorar vacantes
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div
        variants={cardReveal}
        className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-(--app-border) bg-(--app-border) shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)] sm:grid-cols-2 xl:grid-cols-4 dark:shadow-[0_14px_30px_rgba(0,0,0,0.16)]"
      >
        {metricCards.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </motion.div>

      {/* Aplicaciones recientes */}
      <motion.div variants={cardReveal} className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.05rem] font-semibold tracking-tight text-(--app-text)">Aplicaciones recientes</h2>
          <button
            type="button"
            onClick={() => void navigate(surfacePaths.candidate.applications)}
            className="inline-flex shrink-0 items-center gap-1 text-[0.8rem] font-semibold text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
          >
            Ver todas
            <ChevronRight className="size-4" />
          </button>
        </div>

        {appsLoading ? (
          <Card className="flex items-center gap-2.5 text-[0.82rem] text-(--app-text-muted)">
            <Spinner size="sm" /> Cargando aplicaciones…
          </Card>
        ) : recentApplications.length > 0 ? (
          <>
            <motion.div
              variants={cardReveal}
              className="overflow-hidden rounded-card border border-(--app-border) bg-(--app-surface-elevated) shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.16)]"
            >
              <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_110px_130px_40px] gap-x-4 border-b border-(--app-border) bg-(--app-surface-muted)/40 px-5 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-(--app-text-subtle) sm:grid">
                <span>Vacante</span>
                <span>Empresa</span>
                <span>Fecha</span>
                <span>Etapa</span>
                <span className="sr-only">Acciones</span>
              </div>
              <motion.ul variants={gridStagger}>
              {recentApplications.map((application) => (
                <motion.li key={application.id} variants={cardReveal} className="border-t border-(--app-border) first:border-t-0">
                  <button
                    type="button"
                    onClick={() => void navigate(getApplicationDetailPath(application))}
                    className="group grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-(--app-surface-muted) sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_110px_130px_40px] sm:px-5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
                        <FileText className="size-4" />
                      </span>
                      <span className="truncate text-[0.85rem] font-semibold text-(--app-text)">
                        {application.job_posting?.title || 'Vacante'}
                      </span>
                    </span>
                    <span className="truncate text-right text-[0.78rem] text-(--app-text-muted) sm:text-left">
                      {application.job_posting?.company_profile?.display_name || '—'}
                    </span>
                    <span className="col-span-2 text-[0.76rem] tabular-nums text-(--app-text-subtle) sm:col-span-1">
                      {formatApplicationDate(application.submitted_at)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[0.78rem] text-(--app-text)">
                      <span className={cn('size-1.5 rounded-full', applicationStatusDotClass(application.status_public))} />
                      {applicationStatusLabel(application.status_public)}
                    </span>
                    <span className="hidden size-8 items-center justify-center justify-self-end rounded-control text-(--app-text-subtle) transition-colors group-hover:bg-primary-50 group-hover:text-primary-600 sm:flex dark:group-hover:bg-primary-500/12 dark:group-hover:text-primary-300">
                      <ChevronRight className="size-4" />
                    </span>
                  </button>
                </motion.li>
              ))}
              </motion.ul>
            </motion.div>

            {recentTotalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 px-0.5">
                <p className="text-[0.76rem] text-(--app-text-muted)">
                  Página {recentPageSafe + 1} de {recentTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRecentPage((page) => Math.max(0, page - 1))}
                    disabled={recentPageSafe === 0}
                    className="inline-flex size-8 items-center justify-center rounded-control border border-(--app-border) bg-(--app-surface) text-(--app-text-muted) transition-colors hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-(--app-border) disabled:hover:text-(--app-text-muted) dark:hover:border-primary-400 dark:hover:text-primary-200"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentPage((page) => Math.min(recentTotalPages - 1, page + 1))}
                    disabled={recentPageSafe >= recentTotalPages - 1}
                    className="inline-flex size-8 items-center justify-center rounded-control border border-(--app-border) bg-(--app-surface) text-(--app-text-muted) transition-colors hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-(--app-border) disabled:hover:text-(--app-text-muted) dark:hover:border-primary-400 dark:hover:text-primary-200"
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <Card>
            <EmptyState
              title="Aún no tienes aplicaciones"
              description="Explora oportunidades abiertas y postúlate cuando tu perfil esté listo."
              actionLabel="Explorar vacantes"
              onAction={() => void navigate(surfacePaths.storefront.jobs)}
            />
          </Card>
        )}
      </motion.div>
    </motion.div>
  )
}

function DailyQuote() {
  // Una frase aleatoria por visita: se elige al montar y permanece fija
  // hasta que el usuario sale y vuelve a entrar al módulo.
  const quote = useState(() => {
    if (inspirationalQuotes.length === 0) return FALLBACK_QUOTE
    return inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)] ?? FALLBACK_QUOTE
  })[0]
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = `“${quote.text}” — ${quote.from}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Frase copiada al portapapeles')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('No pudimos copiar la frase')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title="Clic para copiar la frase"
      aria-label="Copiar frase del día"
      className="group flex max-w-[40rem] items-start gap-2 rounded-control text-left transition-colors hover:text-(--app-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50"
    >
      <Quote aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-500/60 dark:text-primary-300/60" />
      <p className="text-[0.9rem] leading-relaxed">
        <span className="italic text-(--app-text-muted)">“{quote.text}”</span>{' '}
        <span className="whitespace-nowrap text-[0.82rem] font-semibold text-(--app-text-subtle)">— {quote.from}</span>{' '}
        <span
          aria-hidden
          className={cn(
            'ml-0.5 inline-flex translate-y-0.5 items-center text-(--app-text-subtle) transition-colors group-hover:text-primary-600 dark:group-hover:text-primary-300',
            copied && 'text-emerald-600 group-hover:text-emerald-600 dark:text-emerald-400 dark:group-hover:text-emerald-400'
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </span>
      </p>
    </button>
  )
}

function CountUp({ value, suffix = '', duration = 1600 }: { value: number; suffix?: string; duration?: number }) {
  const shouldReduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (shouldReduceMotion) return
    let raf = 0
    let start: number | undefined
    const tick = (timestamp: number) => {
      if (start === undefined) start = timestamp
      const progress = Math.min(1, (timestamp - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, shouldReduceMotion])

  const shown = shouldReduceMotion ? value : display
  return (
    <>
      {shown}
      {suffix}
    </>
  )
}

function MetricCard({ metric }: { metric: MetricCardData }) {
  const Icon = metric.icon
  return (
    <div className="flex items-start gap-3 bg-(--app-surface-elevated) p-4 sm:p-[1.1rem]">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-control', metric.chipClass)}>
        <Icon className="size-[1.1rem]" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.72rem] font-semibold text-(--app-text-subtle)">{metric.label}</p>
        <p className="mt-1.5 text-[1.55rem] font-semibold leading-none tracking-tight tabular-nums text-(--app-text)">
          {metric.loading ? '—' : <CountUp value={metric.value} suffix={metric.suffix} />}
        </p>
        <p
          className={cn(
            'mt-1.5 flex items-center gap-1 text-[0.72rem]',
            metric.trendUp ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-(--app-text-muted)'
          )}
        >
          {metric.trendUp ? <TrendingUp aria-hidden className="size-3.5" /> : null}
          {metric.sub}
        </p>
      </div>
    </div>
  )
}

const applicationDateFormatter = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })

function formatApplicationDate(value?: string | null) {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : applicationDateFormatter.format(date)
}
