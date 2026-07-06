import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import {
  Briefcase,
  ExternalLink,
  GraduationCap,
  Mail,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SideSheet } from '@/components/ui/side-sheet'
import { Spinner } from '@/components/ui/loader'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  fetchCandidateDirectoryDetail,
  searchCandidateDirectoryPage,
  type CandidateDirectoryRow,
  type CandidateDirectorySort
} from '@/features/talent/lib/talent-api'
import { useUrlParamState } from '@/hooks/use-url-param-state'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cardReveal, gridStagger, pageStagger, softEase } from '@/shared/ui/card-motion'
import { CountryCodeSelect } from '@/shared/ui/location-selects'
import { cn } from '@/lib/utils/cn'

const TALENT_PAGE_SIZE = 12

/** Valores válidos de orden; normaliza un `?sort=` manipulado en la URL. */
const CANDIDATE_SORTS: readonly CandidateDirectorySort[] = ['relevance', 'score', 'name', 'experience']

function candidateInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '·'
  )
}

function scorePillClass(score: number) {
  if (score >= 85) {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300'
  }
  return 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300'
}

function locationLabel(candidate: Pick<CandidateDirectoryRow, 'city_name' | 'country_code'>) {
  return [candidate.city_name, candidate.country_code].filter(Boolean).join(', ') || 'Sin ubicación'
}

export function TalentDirectoryPage() {
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const tenantId = session.activeTenantId
  // Filtros y orden respaldados por la URL: sobreviven a navegación, back/forward
  // y recarga, y son compartibles por enlace (?q=&skill=&lang=&country=&sort=).
  const [query, setQuery] = useUrlParamState('q')
  // Búsqueda con paginación de servidor: el input/URL cambian en vivo pero el
  // refetch solo dispara ~300 ms tras dejar de teclear (no en cada carácter).
  const debouncedQuery = useDebouncedValue(query)
  const [skill, setSkill] = useUrlParamState('skill')
  const [language, setLanguage] = useUrlParamState('lang')
  const [countryCode, setCountryCode] = useUrlParamState('country')
  const [sortParam, setSort] = useUrlParamState<CandidateDirectorySort>('sort', 'relevance')
  // Normaliza el valor de la URL: si viene manipulado (?sort=xxx) cae a 'relevance'.
  const sort: CandidateDirectorySort = CANDIDATE_SORTS.includes(sortParam) ? sortParam : 'relevance'
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false)
  // Permite deep-link desde Aplicaciones: `/workspace/talent?candidate=<id>` abre
  // directamente el perfil del candidato que aplicó.
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedCandidateProfileId, setSelectedCandidateProfileId] = useState<string | null>(
    () => searchParams.get('candidate')
  )

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  function selectCandidate(candidateProfileId: string | null) {
    setSelectedCandidateProfileId(candidateProfileId)
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        if (candidateProfileId) {
          next.set('candidate', candidateProfileId)
        } else {
          next.delete('candidate')
        }
        return next
      },
      { replace: true }
    )
  }

  // Paginación real de servidor + scroll infinito: cada página llega vía offset,
  // no se trae todo de una vez. La key incluye filtros y orden para reiniciar en 0.
  const searchQuery = useInfiniteQuery({
    queryKey: ['talent-directory', tenantId, debouncedQuery, skill, language, countryCode, sort],
    enabled: Boolean(tenantId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      searchCandidateDirectoryPage({
        tenantId: tenantId!,
        query: debouncedQuery,
        skill,
        language,
        countryCode,
        sort,
        limit: TALENT_PAGE_SIZE,
        offset: pageParam
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset
  })

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = searchQuery

  // En vivo: cuando un candidato activa su visibilidad o actualiza su perfil, el
  // directorio se refresca solo para las empresas autorizadas. El prefijo de la
  // key invalida todas las combinaciones de filtros activas.
  useRealtimeSync(
    'talent-directory',
    [{ table: 'candidate_profiles', invalidate: [['talent-directory']] }],
    { enabled: Boolean(tenantId) }
  )

  const detailQuery = useQuery({
    queryKey: ['talent-directory-detail', tenantId, selectedCandidateProfileId],
    enabled: Boolean(tenantId && selectedCandidateProfileId),
    queryFn: async () => fetchCandidateDirectoryDetail(tenantId!, selectedCandidateProfileId!)
  })

  const pages = useMemo(() => searchQuery.data?.pages ?? [], [searchQuery.data])
  const rows = useMemo(() => pages.flatMap((entry) => entry.rows), [pages])
  const totalCount = pages[0]?.totalCount ?? 0

  // Scroll infinito: un sentinel al fondo pide la siguiente página al acercarse.
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '240px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, rows.length])

  const activeFilterChips = useMemo(
    () =>
      [
        skill.trim() ? { key: 'skill', label: skill.trim(), clear: () => setSkill('') } : null,
        language.trim() ? { key: 'language', label: language.trim(), clear: () => setLanguage('') } : null,
        countryCode.trim() ? { key: 'country', label: countryCode.trim(), clear: () => setCountryCode('') } : null
      ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>,
    [skill, language, countryCode, setSkill, setLanguage, setCountryCode]
  )
  const hasActiveFilters = Boolean(
    query.trim() || skill.trim() || language.trim() || countryCode.trim() || sort !== 'relevance'
  )

  function resetFilters() {
    setQuery('')
    setSkill('')
    setLanguage('')
    setCountryCode('')
    setSort('relevance')
  }

  const detailOpen = Boolean(selectedCandidateProfileId)

  return (
    <motion.div
      className="space-y-4"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.header variants={cardReveal} className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">Candidatos</h1>
        <p className="max-w-2xl text-[0.84rem] leading-relaxed text-(--app-text-muted)">
          Explora los perfiles visibles y contacta al talento aprobado.
        </p>
      </motion.header>

      {/* Móvil: barra compacta que abre una hoja inferior con búsqueda y filtros */}
      <motion.div variants={cardReveal} className="space-y-2 lg:hidden">
        <button
          type="button"
          onClick={() => setFiltersSheetOpen(true)}
          className="flex h-11 w-full items-center gap-2.5 rounded-card border border-(--app-border) bg-(--app-surface) pl-3 pr-1.5 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)"
        >
          <Search aria-hidden className="size-4 shrink-0 text-(--app-text-subtle)" />
          <span className={cn('min-w-0 flex-1 truncate text-sm', query ? 'text-(--app-text)' : 'text-(--app-text-subtle)')}>
            {query || 'Busca por nombre o skill'}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-(--app-surface-muted) px-2.5 py-1.5 text-[0.78rem] font-semibold text-(--app-text)">
            <SlidersHorizontal aria-hidden className="size-4" />
            Filtros
            {activeFilterChips.length > 0 ? (
              <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[0.68rem] font-semibold leading-none text-white">
                {activeFilterChips.length}
              </span>
            ) : null}
          </span>
        </button>

        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[0.82rem] text-(--app-text-subtle)">
            {searchQuery.isLoading ? (
              <>
                <Spinner size="sm" /> Cargando…
              </>
            ) : (
              <>
                <b className="font-semibold text-(--app-text)">{totalCount}</b> {totalCount === 1 ? 'candidato' : 'candidatos'}
              </>
            )}
          </span>
          <label className="flex items-center gap-1.5 text-[0.82rem] text-(--app-text-subtle)">
            Ordenar
            <Select
              className="h-[34px] w-auto rounded-control text-[0.82rem]"
              value={sort}
              onChange={(event) => setSort(event.target.value as CandidateDirectorySort)}
              aria-label="Ordenar candidatos"
            >
              <option value="relevance">Relevancia</option>
              <option value="score">Score</option>
              <option value="name">Nombre A–Z</option>
              <option value="experience">Experiencia</option>
            </Select>
          </label>
        </div>

        {activeFilterChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex h-8 items-center gap-1.5 rounded-control border border-(--app-border) bg-(--app-surface) px-2.5 text-[0.78rem] font-medium text-(--app-text-muted) transition hover:text-(--app-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)"
              >
                {chip.label}
                <X aria-hidden className="size-3" />
                <span className="sr-only">Quitar filtro</span>
              </button>
            ))}
            <button type="button" onClick={resetFilters} className="px-1 text-[0.78rem] font-medium text-(--app-text-muted) underline-offset-2 hover:underline">
              Limpiar
            </button>
          </div>
        ) : null}
      </motion.div>

      {/* Escritorio: búsqueda + filtros inline */}
      <motion.div variants={cardReveal} className="hidden flex-col gap-2.5 lg:flex lg:flex-row lg:items-center">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca por nombre o skill"
            className="h-11 rounded-control pl-10"
          />
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:flex lg:shrink-0">
          <Input
            value={skill}
            onChange={(event) => setSkill(event.target.value)}
            placeholder="Skill (ej. AutoCAD)"
            className="h-11 min-w-40 rounded-control"
          />
          <Input
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="Idioma (ej. Español)"
            className="h-11 min-w-40 rounded-control"
          />
          <CountryCodeSelect
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
            placeholder="País"
            className="h-11 min-w-40 rounded-control"
          />
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as CandidateDirectorySort)}
            className="h-11 min-w-48 rounded-control"
          >
            <option value="relevance">Ordenar por: Relevancia</option>
            <option value="score">Score</option>
            <option value="name">Nombre A–Z</option>
            <option value="experience">Experiencia</option>
          </Select>
        </div>
      </motion.div>

      {/* Contenido */}
      {searchQuery.isLoading ? (
        <motion.div variants={cardReveal} className="flex items-center gap-2.5 rounded-card border border-(--app-border) bg-(--app-surface) px-4 py-10 text-sm text-(--app-text-muted)">
          <Spinner size="sm" /> Buscando candidatos…
        </motion.div>
      ) : searchQuery.error ? (
        <motion.div
          variants={cardReveal}
          className="rounded-card border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {toErrorMessage(searchQuery.error)}
        </motion.div>
      ) : rows.length === 0 ? (
        <motion.div variants={cardReveal}>
          <EmptyState
            title="Sin candidatos"
            description="No encontramos perfiles visibles con esta combinación de filtros."
            actionLabel={hasActiveFilters ? 'Limpiar filtros' : undefined}
            onAction={hasActiveFilters ? resetFilters : undefined}
          />
        </motion.div>
      ) : (
        <motion.div variants={cardReveal}>
          <motion.ul
            className="flex flex-col gap-2"
            variants={gridStagger}
            initial={shouldReduceMotion ? false : 'hidden'}
            animate="show"
          >
            {rows.map((candidate) => (
              <motion.li key={candidate.candidate_profile_id} variants={cardReveal}>
                <CandidateCard
                  candidate={candidate}
                  active={candidate.candidate_profile_id === selectedCandidateProfileId}
                  onSelect={() => selectCandidate(candidate.candidate_profile_id)}
                />
              </motion.li>
            ))}
          </motion.ul>

          {/* Sentinel: al entrar en viewport pide la siguiente página */}
          <div ref={sentinelRef} aria-hidden className="h-px w-full" />
          {isFetchingNextPage ? (
            <div className="flex items-center justify-center gap-2 py-3 text-[0.78rem] text-(--app-text-subtle)">
              <Spinner size="sm" /> Cargando más candidatos…
            </div>
          ) : !hasNextPage && rows.length > 0 ? (
            <p className="py-3 text-center text-[0.74rem] text-(--app-text-subtle)">No hay más candidatos</p>
          ) : null}
        </motion.div>
      )}

      <TalentFilterSheet
        open={filtersSheetOpen}
        onClose={() => setFiltersSheetOpen(false)}
        query={query}
        onQueryChange={setQuery}
        skill={skill}
        onSkillChange={setSkill}
        language={language}
        onLanguageChange={setLanguage}
        countryCode={countryCode}
        onCountryChange={setCountryCode}
        sort={sort}
        onSortChange={setSort}
        resultCount={totalCount}
        isLoading={searchQuery.isLoading}
        hasActive={hasActiveFilters}
        onReset={resetFilters}
      />

      <CandidateDetailSheet
        open={detailOpen}
        onClose={() => selectCandidate(null)}
        isLoading={detailQuery.isLoading}
        error={detailQuery.error}
        data={detailQuery.data}
      />
    </motion.div>
  )
}

function CandidateCard({
  candidate,
  active,
  onSelect
}: {
  candidate: CandidateDirectoryRow
  active: boolean
  onSelect: () => void
}) {
  const visibleSkills = candidate.skill_names.slice(0, 3)
  const extraSkills = candidate.skill_names.length - visibleSkills.length

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-card border bg-(--app-surface) px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(20,40,90,0.04)] transition-[border-color,box-shadow,background-color] hover:border-primary-200 hover:bg-(--app-surface-muted)/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) dark:hover:border-primary-500/40',
        active ? 'border-primary-300 bg-primary-50/60 dark:bg-primary-500/10' : 'border-(--app-border)'
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[0.72rem] font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
        {candidateInitials(candidate.display_name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-[0.9rem] font-semibold text-(--app-text)">{candidate.display_name}</h3>
          <span
            className={cn(
              'ml-auto inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.68rem] font-semibold',
              scorePillClass(candidate.completeness_score)
            )}
          >
            {candidate.completeness_score}%
          </span>
        </div>
        <p className="mt-0.5 truncate text-[0.8rem] text-(--app-text-muted)">
          {candidate.desired_role || candidate.headline || 'Perfil visible'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.72rem] text-(--app-text-subtle)">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{locationLabel(candidate)}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Briefcase className="size-3 shrink-0" />
            {candidate.total_experiences} {candidate.total_experiences === 1 ? 'experiencia' : 'experiencias'}
          </span>
        </div>
        {visibleSkills.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {visibleSkills.map((item) => (
              <span
                key={item}
                className="inline-flex items-center rounded-control bg-(--app-surface-muted) px-2 py-0.5 text-[0.68rem] font-medium text-(--app-text-muted)"
              >
                {item}
              </span>
            ))}
            {extraSkills > 0 ? (
              <span className="inline-flex items-center rounded-control px-1.5 py-0.5 text-[0.68rem] font-semibold text-(--app-text-subtle)">
                +{extraSkills}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </button>
  )
}

function TalentFilterSheet({
  open,
  onClose,
  query,
  onQueryChange,
  skill,
  onSkillChange,
  language,
  onLanguageChange,
  countryCode,
  onCountryChange,
  sort,
  onSortChange,
  resultCount,
  isLoading,
  hasActive,
  onReset
}: {
  open: boolean
  onClose: () => void
  query: string
  onQueryChange: (value: string) => void
  skill: string
  onSkillChange: (value: string) => void
  language: string
  onLanguageChange: (value: string) => void
  countryCode: string
  onCountryChange: (value: string) => void
  sort: CandidateDirectorySort
  onSortChange: (value: CandidateDirectorySort) => void
  resultCount: number
  isLoading: boolean
  hasActive: boolean
  onReset: () => void
}) {
  // La barrita superior (grabber) inicia el arrastre; el cuerpo con scroll no,
  // para que deslizar sobre el formulario no cierre la hoja por accidente.
  const dragControls = useDragControls()

  return (
    <AnimatePresence>
      {open ? (
        <Dialog static open onClose={onClose} className="relative z-50 lg:hidden">
          <motion.div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: softEase }}
          />
          <div className="fixed inset-x-0 bottom-0 flex max-h-[90dvh] flex-col justify-end">
            <DialogPanel
              as={motion.div}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.9 }}
              onDragEnd={(_event, info) => {
                if (info.offset.y > 140 || info.velocity.y > 700) onClose()
              }}
              variants={{
                hidden: { y: '100%' },
                visible: { y: 0, transition: { type: 'spring', damping: 34, stiffness: 340 } },
                exit: { y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }
              }}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex max-h-[90dvh] flex-col rounded-t-card border-t border-(--app-border) bg-(--app-surface) shadow-[0_-20px_60px_rgba(15,23,42,0.28)]"
            >
              <header
                onPointerDown={(event) => dragControls.start(event)}
                className="shrink-0 cursor-grab touch-none select-none border-b border-(--app-border) px-5 pb-3 pt-2.5 active:cursor-grabbing"
              >
                <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-(--app-border)" />
                <div className="flex items-center justify-between gap-4">
                  <DialogTitle className="text-[1.05rem] font-semibold tracking-tight text-(--app-text)">Buscar y filtrar</DialogTitle>
                  <button
                    type="button"
                    onClick={onClose}
                    onPointerDown={(event) => event.stopPropagation()}
                    aria-label="Cerrar"
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-(--app-text)"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </header>

              <form
                id="talent-filters-form"
                className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  onClose()
                }}
              >
                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Búsqueda</span>
                  <div className="relative">
                    <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
                    <Input
                      className="h-11 pl-9 text-sm"
                      placeholder="Nombre o skill"
                      value={query}
                      onChange={(event) => onQueryChange(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Skill</span>
                  <Input
                    className="h-11 text-sm"
                    placeholder="ej. AutoCAD"
                    value={skill}
                    onChange={(event) => onSkillChange(event.target.value)}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Idioma</span>
                  <Input
                    className="h-11 text-sm"
                    placeholder="ej. Español"
                    value={language}
                    onChange={(event) => onLanguageChange(event.target.value)}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">País</span>
                  <CountryCodeSelect
                    className="h-11 w-full rounded-control text-sm"
                    value={countryCode}
                    onChange={(event) => onCountryChange(event.target.value)}
                    placeholder="Todos los países"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Ordenar por</span>
                  <Select
                    className="h-11 w-full rounded-control text-sm"
                    value={sort}
                    onChange={(event) => onSortChange(event.target.value as CandidateDirectorySort)}
                  >
                    <option value="relevance">Relevancia</option>
                    <option value="score">Score</option>
                    <option value="name">Nombre A–Z</option>
                    <option value="experience">Experiencia</option>
                  </Select>
                </label>
              </form>

              <footer className="flex shrink-0 items-center gap-3 border-t border-(--app-border) px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button type="button" variant="outline" className="h-11 rounded-control px-4" onClick={onReset} disabled={!hasActive}>
                  Limpiar
                </Button>
                <Button type="submit" form="talent-filters-form" className="h-11 flex-1 rounded-control">
                  {isLoading ? 'Buscando…' : `Ver ${resultCount} ${resultCount === 1 ? 'candidato' : 'candidatos'}`}
                </Button>
              </footer>
            </DialogPanel>
          </div>
        </Dialog>
      ) : null}
    </AnimatePresence>
  )
}

function CandidateDetailSheet({
  open,
  onClose,
  isLoading,
  error,
  data
}: {
  open: boolean
  onClose: () => void
  isLoading: boolean
  error: unknown
  data: Awaited<ReturnType<typeof fetchCandidateDirectoryDetail>> | undefined
}) {
  const profile = data?.profile
  const role = profile ? profile.desired_role || profile.headline || 'Perfil profesional' : ''

  const title = profile ? (
    <span className="flex items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
        {candidateInitials(profile.display_name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[1.05rem] font-semibold text-(--app-text)">{profile.display_name}</span>
        <span className="block truncate text-sm font-normal text-(--app-text-muted)">{role}</span>
      </span>
    </span>
  ) : (
    'Perfil del candidato'
  )

  const footer =
    profile && !isLoading && !error ? (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="flex-1 gap-1.5"
          onClick={() =>
            toast.info('Perfil completo', {
              description: 'La vista de perfil completo estará disponible próximamente.'
            })
          }
        >
          <ExternalLink className="size-4" /> Ver perfil completo
        </Button>
        <a
          href={`mailto:${profile.email}`}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-card border border-primary-600 bg-primary-600 px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(43,69,143,0.18)] transition hover:border-primary-700 hover:bg-primary-700"
        >
          <Mail className="size-4" /> Contactar
        </a>
      </div>
    ) : undefined

  return (
    <SideSheet open={open} onClose={onClose} title={title} widthClassName="max-w-[420px]" footer={footer}>
      {isLoading ? (
        <div className="flex items-center gap-2.5 text-sm text-(--app-text-muted)">
          <Spinner size="sm" /> Cargando perfil…
        </div>
      ) : error || !data ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(error)}</p>
      ) : (
        <div className="space-y-5">
          <DetailSection title="Resumen profesional">
            <p className="text-sm leading-6 text-(--app-text-muted)">
              {data.profile.summary || 'Este perfil aún no agregó un resumen profesional.'}
            </p>
          </DetailSection>

          <DetailSection title="Experiencia" icon={Briefcase}>
            {data.experiences.length > 0 ? (
              <div>
                {data.experiences.map((experience) => (
                  <div key={experience.id} className="border-t border-(--app-border) py-3 first:border-t-0 first:pt-0">
                    <p className="text-sm font-semibold text-(--app-text)">{experience.role_title}</p>
                    <p className="mt-0.5 text-xs text-(--app-text-subtle)">{experience.company_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-(--app-text-muted)">No hay experiencias cargadas.</p>
            )}
          </DetailSection>

          <DetailSection title="Educación" icon={GraduationCap}>
            {data.educations.length > 0 ? (
              <div>
                {data.educations.map((education) => (
                  <div key={education.id} className="border-t border-(--app-border) py-3 first:border-t-0 first:pt-0">
                    <p className="text-sm font-semibold text-(--app-text)">{education.degree_name}</p>
                    <p className="mt-0.5 text-xs text-(--app-text-subtle)">{education.institution_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-(--app-text-muted)">No hay educación cargada.</p>
            )}
          </DetailSection>

          <DetailSection title="Habilidades e idiomas" icon={Sparkles}>
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center rounded-control bg-primary-50 px-2.5 py-1 text-[0.72rem] font-medium text-primary-700 dark:bg-primary-500/12 dark:text-primary-200"
                >
                  {item.skill_name}
                </span>
              ))}
              {data.languages.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center rounded-control border border-(--app-border) px-2.5 py-1 text-[0.72rem] font-medium text-(--app-text-muted)"
                >
                  {item.language_name}
                </span>
              ))}
              {data.skills.length === 0 && data.languages.length === 0 ? (
                <span className="text-sm text-(--app-text-muted)">No hay habilidades ni idiomas registrados.</span>
              ) : null}
            </div>
          </DetailSection>
        </div>
      )}
    </SideSheet>
  )
}

function DetailSection({
  title,
  icon: Icon,
  children
}: {
  title: string
  icon?: typeof Briefcase
  children: ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-(--app-text-subtle)">
        {Icon ? <Icon className="size-3.5" /> : null}
        {title}
      </p>
      {children}
    </div>
  )
}
