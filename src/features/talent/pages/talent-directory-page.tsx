import { useMemo, useState, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import {
  Briefcase,
  ExternalLink,
  GraduationCap,
  Mail,
  Search,
  SlidersHorizontal,
  Sparkles,
  X
} from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/loader'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  fetchCandidateDirectoryDetail,
  searchCandidateDirectory,
  type CandidateDirectoryRow
} from '@/features/talent/lib/talent-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cardReveal, pageStagger } from '@/shared/ui/card-motion'
import { CountryCodeSelect } from '@/shared/ui/location-selects'
import { cn } from '@/lib/utils/cn'

const TALENT_PAGE_SIZE = 8

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
  if (score >= 75) {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300'
  }
  if (score >= 50) {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300'
  }
  return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
}

function locationLabel(candidate: Pick<CandidateDirectoryRow, 'city_name' | 'country_code'>) {
  return [candidate.city_name, candidate.country_code].filter(Boolean).join(', ') || 'No definida'
}

export function TalentDirectoryPage() {
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const tenantId = session.activeTenantId
  const [query, setQuery] = useState('')
  const [skill, setSkill] = useState('')
  const [language, setLanguage] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [sort, setSort] = useState<'relevance' | 'name'>('relevance')
  const [showFilters, setShowFilters] = useState(true)
  const [page, setPage] = useState(0)
  const [selectedCandidateProfileId, setSelectedCandidateProfileId] = useState<string | null>(null)

  const searchQuery = useQuery({
    queryKey: ['talent-directory', tenantId, query, skill, language, countryCode],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      searchCandidateDirectory({
        tenantId: tenantId!,
        query,
        skill,
        language,
        countryCode
      })
  })

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

  const rows = useMemo(() => {
    const data = searchQuery.data ?? []
    return [...data].sort((left, right) =>
      sort === 'relevance'
        ? right.completeness_score - left.completeness_score
        : left.display_name.localeCompare(right.display_name)
    )
  }, [searchQuery.data, sort])

  const pageCount = Math.max(1, Math.ceil(rows.length / TALENT_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageStart = safePage * TALENT_PAGE_SIZE
  const pageRows = rows.slice(pageStart, pageStart + TALENT_PAGE_SIZE)

  function resetToFirstPage() {
    setPage(0)
  }

  return (
    <motion.div
      className="space-y-5"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal}>
        <h1 className="text-[1.7rem] font-semibold tracking-tight text-(--app-text) sm:text-[2rem]">Candidatos</h1>
        <p className="mt-1 text-sm text-(--app-text-muted)">
          {rows.length} {rows.length === 1 ? 'perfil visible' : 'perfiles visibles'}
        </p>
      </motion.div>

      <motion.div variants={cardReveal} className="space-y-2.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-(--app-border) bg-(--app-surface) px-3.5">
            <Search aria-hidden="true" className="size-4 text-(--app-text-subtle)" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                resetToFirstPage()
              }}
              placeholder="Busca por nombre o skill..."
              className="h-11 w-full bg-transparent text-sm text-(--app-text) outline-none placeholder:text-(--app-text-subtle)"
            />
          </div>
          <Select className="sm:w-52" value={sort} onChange={(event) => setSort(event.target.value as 'relevance' | 'name')}>
            <option value="relevance">Ordenar: Relevancia</option>
            <option value="name">Ordenar: Nombre</option>
          </Select>
          <Button
            variant="outline"
            className="h-11 gap-1.5"
            onClick={() => setShowFilters((current) => !current)}
          >
            <SlidersHorizontal className="size-4" />
            Más filtros
          </Button>
        </div>

        {showFilters ? (
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Input
              value={skill}
              onChange={(event) => {
                setSkill(event.target.value)
                resetToFirstPage()
              }}
              placeholder="Skill (ej. AutoCAD)"
            />
            <Input
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value)
                resetToFirstPage()
              }}
              placeholder="Idioma (ej. Español)"
            />
            <CountryCodeSelect
              value={countryCode}
              onChange={(event) => {
                setCountryCode(event.target.value)
                resetToFirstPage()
              }}
              placeholder="País"
            />
          </div>
        ) : null}
      </motion.div>

      <motion.section variants={cardReveal} className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Card className="overflow-hidden p-0">
            {searchQuery.isLoading ? (
              <div className="flex items-center gap-2.5 px-6 py-10 text-sm text-(--app-text-muted)">
                <Spinner size="sm" /> Buscando candidatos…
              </div>
            ) : searchQuery.error ? (
              <div className="px-6 py-10 text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(searchQuery.error)}</div>
            ) : pageRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-(--app-border) bg-(--app-surface-muted) text-left text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-(--app-text-subtle)">
                      <th className="px-5 py-3 font-semibold">Candidato</th>
                      <th className="px-4 py-3 font-semibold">Perfil</th>
                      <th className="px-4 py-3 font-semibold">Ubicación</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">Skills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((candidate) => {
                      const isSelected = selectedCandidateProfileId === candidate.candidate_profile_id
                      return (
                        <tr
                          key={candidate.candidate_profile_id}
                          onClick={() => setSelectedCandidateProfileId(candidate.candidate_profile_id)}
                          className={cn(
                            'cursor-pointer border-b border-(--app-border)/70 transition-colors last:border-0',
                            isSelected ? 'bg-primary-50/70 dark:bg-primary-500/12' : 'hover:bg-(--app-surface-muted)/60'
                          )}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2d52a8,#8aa2d8)] text-[11px] font-semibold text-white">
                                {candidateInitials(candidate.display_name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-(--app-text)">{candidate.display_name}</p>
                                <p className="truncate text-xs text-(--app-text-subtle)">{candidate.total_experiences} experiencias</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-(--app-text-muted)">
                            {candidate.desired_role || candidate.headline || 'Perfil visible'}
                          </td>
                          <td className="px-4 py-3 text-(--app-text-muted)">{locationLabel(candidate)}</td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-semibold', scorePillClass(candidate.completeness_score))}>
                              {candidate.completeness_score}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {candidate.skill_names.slice(0, 3).map((item) => (
                                <span key={item} className="inline-flex items-center rounded-full bg-(--app-surface-muted) px-2.5 py-1 text-[0.72rem] font-medium text-(--app-text-muted)">
                                  {item}
                                </span>
                              ))}
                              {candidate.skill_names.length === 0 ? <span className="text-(--app-text-subtle)">—</span> : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title="Sin candidatos" description="No encontramos perfiles visibles con esta combinación de filtros." />
              </div>
            )}
          </Card>

          {!searchQuery.isLoading && rows.length > 0 ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-(--app-text-muted)">
                Mostrando {pageStart + 1} a {Math.min(pageStart + TALENT_PAGE_SIZE, rows.length)} de {rows.length}{' '}
                {rows.length === 1 ? 'perfil' : 'perfiles'}
              </p>
              {pageCount > 1 ? (
                <Pagination page={safePage} totalPages={pageCount} onPageChange={setPage} ariaLabel="Paginación de talentos" />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          {!selectedCandidateProfileId ? (
            <Card className="flex min-h-[280px] flex-col items-center justify-center gap-2 border-dashed text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-(--app-surface-muted) text-(--app-text-subtle)">
                <Sparkles className="size-5" />
              </span>
              <p className="text-sm font-semibold text-(--app-text)">Selecciona un candidato</p>
              <p className="max-w-[15rem] text-xs text-(--app-text-muted)">
                Elige un perfil de la tabla para revisar su experiencia, educación y habilidades.
              </p>
            </Card>
          ) : detailQuery.isLoading ? (
            <Card className="flex min-h-[280px] items-center gap-2.5 text-sm text-(--app-text-muted)">
              <Spinner size="sm" /> Cargando perfil…
            </Card>
          ) : detailQuery.error || !detailQuery.data ? (
            <Card className="min-h-[280px] text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(detailQuery.error)}</Card>
          ) : (
            <CandidateDetailPanel data={detailQuery.data} onClose={() => setSelectedCandidateProfileId(null)} />
          )}
        </div>
      </motion.section>
    </motion.div>
  )
}

function CandidateDetailPanel({
  data,
  onClose
}: {
  data: Awaited<ReturnType<typeof fetchCandidateDirectoryDetail>>
  onClose: () => void
}) {
  const profile = data.profile
  const role = profile.desired_role || profile.headline || 'Perfil profesional'

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2d52a8,#8aa2d8)] text-sm font-semibold text-white">
            {candidateInitials(profile.display_name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[1.05rem] font-semibold text-(--app-text)">{profile.display_name}</p>
            <p className="truncate text-sm text-(--app-text-muted)">{role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-semibold', scorePillClass(profile.completeness_score))}>
            {profile.completeness_score}%
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-7 items-center justify-center rounded-lg text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-(--app-text)"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <DetailSection title="Resumen profesional">
        <p className="text-sm leading-6 text-(--app-text-muted)">
          {profile.summary || 'Este perfil aún no agregó un resumen profesional.'}
        </p>
      </DetailSection>

      <DetailSection title="Experiencia" icon={Briefcase}>
        {data.experiences.length > 0 ? (
          <div className="space-y-2">
            {data.experiences.map((experience) => (
              <div key={experience.id} className="rounded-xl border border-(--app-border) bg-(--app-surface-muted) px-3 py-2.5">
                <p className="text-sm font-semibold text-(--app-text)">{experience.role_title}</p>
                <p className="text-xs text-(--app-text-muted)">{experience.company_name}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-(--app-text-muted)">No hay experiencias cargadas.</p>
        )}
      </DetailSection>

      <DetailSection title="Educación" icon={GraduationCap}>
        {data.educations.length > 0 ? (
          <div className="space-y-2">
            {data.educations.map((education) => (
              <div key={education.id} className="rounded-xl border border-(--app-border) bg-(--app-surface-muted) px-3 py-2.5">
                <p className="text-sm font-semibold text-(--app-text)">{education.degree_name}</p>
                <p className="text-xs text-(--app-text-muted)">{education.institution_name}</p>
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
            <span key={item.id} className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-[0.72rem] font-medium text-primary-700 dark:bg-primary-500/12 dark:text-primary-200">
              {item.skill_name}
            </span>
          ))}
          {data.languages.map((item) => (
            <span key={item.id} className="inline-flex items-center rounded-full border border-(--app-border) px-2.5 py-1 text-[0.72rem] font-medium text-(--app-text-muted)">
              {item.language_name}
            </span>
          ))}
          {data.skills.length === 0 && data.languages.length === 0 ? (
            <span className="text-sm text-(--app-text-muted)">No hay habilidades ni idiomas registrados.</span>
          ) : null}
        </div>
      </DetailSection>

      <div className="flex flex-col gap-2 border-t border-(--app-border) pt-4 sm:flex-row">
        <Button
          variant="outline"
          className="flex-1 gap-1.5"
          onClick={() => toast.info('Perfil completo', { description: 'La vista de perfil completo estará disponible próximamente.' })}
        >
          <ExternalLink className="size-4" /> Ver perfil completo
        </Button>
        <a
          href={`mailto:${profile.email}`}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-primary-600 bg-primary-600 px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(43,69,143,0.18)] transition hover:border-primary-700 hover:bg-primary-700"
        >
          <Mail className="size-4" /> Contactar
        </a>
      </div>
    </Card>
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
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-(--app-text-subtle)">
        {Icon ? <Icon className="size-3.5" /> : null}
        {title}
      </p>
      {children}
    </div>
  )
}
