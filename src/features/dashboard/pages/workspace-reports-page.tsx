import { useMemo, useState, type ComponentType } from 'react'

import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { BriefcaseBusiness, MessageSquareText, Target, UsersRound, type LucideProps } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/loader'
import { Select } from '@/components/ui/select'
import { fetchWorkspaceDashboardMetrics } from '@/features/dashboard/lib/dashboard-api'
import { cn } from '@/lib/utils/cn'
import { cardReveal, gridStagger, pageStagger, softEase } from '@/shared/ui/card-motion'

const PERIOD_OPTIONS = [
  { value: 30, label: 'Últimos 30 días' },
  { value: 90, label: 'Últimos 90 días' },
  { value: 365, label: 'Últimos 12 meses' }
] as const

const FUNNEL_COLORS = ['#3a63c0', '#4b74cf', '#6a46c1', '#1f7aa8', '#1f9d61', '#c2b7ce'] as const

interface KpiItem {
  key: string
  label: string
  value: string | number
  helper: string
  delta: number
  icon: ComponentType<LucideProps>
}

function formatDelta(value: number) {
  if (value > 0) return `+${value}`
  return value.toString()
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
}

function ReportKpiTile({ item, loading }: { item: KpiItem; loading: boolean }) {
  const Icon = item.icon
  const deltaIsDown = item.delta < 0
  const deltaIsNeutral = item.delta === 0

  return (
    <div className="h-full rounded-control border border-(--app-border) bg-(--app-surface-elevated) px-3 py-2.5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-primary-300/60 hover:shadow-[0_10px_24px_rgba(20,40,90,0.07)] dark:hover:border-primary-500/40 sm:px-3.5 sm:py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.6rem] font-bold uppercase leading-tight tracking-[0.1em] text-(--app-text-subtle) sm:text-[0.64rem]">{item.label}</p>
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200 sm:size-7">
          <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-2 text-[1.4rem] font-bold leading-none tracking-tight text-(--app-text) tabular-nums sm:text-[1.6rem]">
        {loading ? '—' : item.value}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex h-4.5 items-center rounded-full px-1.5 text-[0.66rem] font-bold tabular-nums',
            deltaIsNeutral
              ? 'bg-(--app-surface-muted) text-(--app-text-muted)'
              : deltaIsDown
                ? 'bg-[#fdecef] text-[#d2455f] dark:bg-[#d2455f]/15 dark:text-[#f0a0b0]'
                : 'bg-[#e9f7ef] text-[#1f9d61] dark:bg-[#1f9d61]/15 dark:text-[#7ee1a8]'
          )}
        >
          {deltaIsNeutral ? '0' : deltaIsDown ? `▼ ${formatDelta(item.delta)}` : `▲ ${formatDelta(item.delta)}`}
        </span>
        <span className="text-[0.7rem] leading-tight text-(--app-text-subtle) sm:text-[0.74rem]">{item.helper}</span>
      </div>
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[0.98rem] font-semibold tracking-tight text-(--app-text)">{title}</h2>
      <p className="mt-0.5 text-[0.82rem] text-(--app-text-subtle)">{description}</p>
    </div>
  )
}

function BarSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="h-3 w-28 animate-pulse rounded-full bg-(--app-surface-muted)" />
            <span className="h-3 w-14 animate-pulse rounded-full bg-(--app-surface-muted)" />
          </div>
          <div className="h-2.5 animate-pulse rounded-full bg-(--app-surface-muted)" />
        </div>
      ))}
    </div>
  )
}

export function WorkspaceReportsPage() {
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const tenantId = session.activeTenantId
  const [periodDays, setPeriodDays] = useState<(typeof PERIOD_OPTIONS)[number]['value']>(30)

  const metricsQuery = useQuery({
    queryKey: ['workspace', 'dashboard', tenantId, 'reports', periodDays],
    enabled: Boolean(tenantId),
    queryFn: async () => fetchWorkspaceDashboardMetrics(tenantId!, { periodDays })
  })

  const metrics = metricsQuery.data
  const loading = metricsQuery.isLoading
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
  const interviewStageCount =
    metrics?.funnel.find((stage) => /interview|entrevista/i.test(stage.name))?.count ?? metrics?.stats.interviews ?? 0
  const offerStageCount = metrics?.funnel.find((stage) => /offer|oferta/i.test(stage.name))?.count ?? metrics?.stats.offers ?? 0
  const hiredStageCount =
    metrics?.funnel.find((stage) => /hired|contrat/i.test(stage.name))?.count ?? metrics?.stats.hired ?? 0
  const conversion = rate(offerStageCount, Math.max(1, totalInFunnel))
  const conversionSteps = [
    { label: 'Aplicó', next: 'Entrevista', value: rate(interviewStageCount, totalInFunnel) },
    { label: 'Entrevista', next: 'Oferta', value: rate(offerStageCount, interviewStageCount) },
    { label: 'Oferta', next: 'Contratado', value: rate(hiredStageCount, offerStageCount) }
  ]
  const kpis: KpiItem[] = [
    {
      key: 'openJobs',
      label: 'Vacantes abiertas',
      value: metrics?.stats.openJobs ?? '—',
      helper: 'Publicadas actualmente',
      delta: metrics?.deltas.openJobs ?? 0,
      icon: BriefcaseBusiness
    },
    {
      key: 'activeCandidates',
      label: 'Candidatos activos',
      value: metrics?.stats.activeCandidates ?? '—',
      helper: 'En proceso',
      delta: metrics?.deltas.activeCandidates ?? 0,
      icon: UsersRound
    },
    {
      key: 'interviews',
      label: 'Entrevistas',
      value: metrics?.stats.interviews ?? '—',
      helper: 'En etapa de entrevista',
      delta: metrics?.deltas.interviews ?? 0,
      icon: MessageSquareText
    },
    {
      key: 'offerRate',
      label: 'Tasa a oferta',
      value: `${conversion}%`,
      helper: 'Candidatos que llegan a oferta',
      delta: metrics?.deltas.offers ?? 0,
      icon: Target
    }
  ]

  return (
    <motion.div
      className="w-full space-y-5 pb-8"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">Reportes</h1>
          <p className="mt-1 text-sm text-(--app-text-muted)">Métricas y desempeño del reclutamiento de tu empresa.</p>
        </div>
        <Select
          aria-label="Periodo de reportes"
          className="h-10 rounded-control text-[0.84rem] font-semibold sm:w-52"
          value={periodDays}
          onChange={(event) => setPeriodDays(Number(event.target.value) as (typeof PERIOD_OPTIONS)[number]['value'])}
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </motion.div>

      <motion.div variants={gridStagger} className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {kpis.map((item) => (
          <motion.div key={item.key} variants={cardReveal} className="h-full">
            <ReportKpiTile item={item} loading={loading} />
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={cardReveal} className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:gap-7">
        <section>
          <SectionHeader title="Distribución por etapa" description="Volumen de candidatos en cada etapa del pipeline." />
          {loading ? (
            <BarSkeleton />
          ) : metrics && metrics.funnel.length > 0 && totalInFunnel > 0 ? (
            <div key={`funnel-${periodDays}`} className="space-y-4">
              {metrics.funnel.map((stage, index) => (
                <div key={stage.stageId} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-(--app-text)">{stage.name}</span>
                    <span className="shrink-0 tabular-nums text-(--app-text-subtle)">
                      <b className="font-bold text-(--app-text)">{stage.count}</b> · {stage.percent}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-(--app-surface-muted)">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: FUNNEL_COLORS[index % FUNNEL_COLORS.length] }}
                      initial={shouldReduceMotion ? false : { width: 0 }}
                      animate={{ width: `${Math.max(2, Math.round((stage.count / maxFunnelCount) * 100))}%` }}
                      transition={{ duration: 0.9, ease: softEase }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin datos" description="Aún no hay aplicaciones para generar reportes en este periodo." />
          )}
        </section>

        <section>
          <SectionHeader title="Conversión" description="Tasa de avance entre etapas clave." />
          {loading ? (
            <div className="inline-flex items-center gap-2 text-sm text-(--app-text-muted)">
              <Spinner size="sm" /> Cargando métricas…
            </div>
          ) : metrics && totalInFunnel > 0 ? (
            <div key={`conversion-${periodDays}`} className="space-y-4.5">
              {conversionSteps.map((step) => (
                <div key={`${step.label}-${step.next}`} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.84rem] font-semibold text-(--app-text)">
                      {step.label} <span className="text-(--app-text-subtle)">→</span> {step.next}
                    </span>
                    <span className="text-[0.95rem] font-bold text-primary-700 tabular-nums dark:text-primary-200">
                      {step.value}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-(--app-surface-muted)">
                    <motion.div
                      className="h-full rounded-full bg-linear-to-r from-primary-400 to-primary-700"
                      initial={shouldReduceMotion ? false : { width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, step.value))}%` }}
                      transition={{ duration: 0.9, ease: softEase }}
                    />
                  </div>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between gap-3 rounded-control bg-[#e9f7ef] px-4 py-3.5 dark:bg-[#1f9d61]/15">
                <div>
                  <p className="text-sm font-bold text-[#166b45] dark:text-[#7ee1a8]">Contrataciones totales</p>
                  <p className="mt-0.5 text-xs text-[#3f9169] dark:text-[#9ee8b8]">en el periodo</p>
                </div>
                <p className="text-[1.65rem] font-bold leading-none text-[#1f9d61] tabular-nums dark:text-[#7ee1a8]">
                  {hiredStageCount}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState title="Sin conversión" description="La conversión aparecerá cuando existan aplicaciones en el periodo." />
          )}
        </section>
      </motion.div>

      {metricsQuery.isError ? (
        <motion.div variants={cardReveal}>
          <Card className="border-[#d2455f]/30 bg-[#fdecef] dark:bg-[#d2455f]/12">
            <CardHeader>
              <CardTitle>No pudimos cargar los reportes</CardTitle>
              <CardDescription>Reintenta en unos segundos o verifica tu conexión.</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      ) : null}
    </motion.div>
  )
}
