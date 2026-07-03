import { useMemo, useState, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import {
  Briefcase,
  ExternalLink,
  GraduationCap,
  Mail,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { SideSheet } from '@/components/ui/side-sheet'
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

type SortOption = 'relevance' | 'score' | 'name' | 'experience'

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
  const [sort, setSort] = useState<SortOption>('relevance')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(0)
  // Permite deep-link desde Aplicaciones: `/workspace/talent?candidate=<id>` abre
  // directamente el perfil del candidato que aplicó.
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedCandidateProfileId, setSelectedCandidateProfileId] = useState<string | null>(
    () => searchParams.get('candidate')
  )

  // Nº de filtros avanzados aplicados; alimenta el badge del botón "Más filtros".
  const activeFilterCount = [skill.trim(), language.trim(), countryCode.trim()].filter(Boolean).length

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
    return [...data].sort((left, right) => {
      switch (sort) {
        case 'score':
          return right.completeness_score - left.completeness_score
        case 'name':
          return left.display_name.localeCompare(right.display_name)
        case 'experience':
          return right.total_experiences - left.total_experiences
        case 'relevance':
        default:
          return right.completeness_score - left.completeness_score
      }
    })
  }, [searchQuery.data, sort])

  const pageCount = Math.max(1, Math.ceil(rows.length / TALENT_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageStart = safePage * TALENT_PAGE_SIZE
  const pageRows = rows.slice(pageStart, pageStart + TALENT_PAGE_SIZE)

  function resetToFirstPage() {
    setPage(0)
  }

  const detailOpen = Boolean(selectedCandidateProfileId)

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
          <span className="font-semibold text-(--app-text)">{rows.length}</span>{' '}
          {rows.length === 1 ? 'perfil visible' : 'perfiles visibles'}
        </p>
      </motion.div>

      <motion.div variants={cardReveal} className="space-y-2.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2.5 rounded-card border border-(--app-border) bg-(--app-surface) px-3.5 transition-[border-color,box-shadow] focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-(--app-ring)">
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
          <Select className="sm:w-56" value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
            <option value="relevance">Ordenar: Relevancia</option>
            <option value="score">Ordenar: Score</option>
            <option value="name">Ordenar: Nombre A–Z</option>
            <option value="experience">Ordenar: Experiencia</option>
          </Select>
          <Button
            variant="outline"
            className={cn(
              'h-11 gap-1.5',
              showFilters && 'border-primary-300 bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200'
            )}
            aria-expanded={showFilters}
            onClick={() => setShowFilters((current) => !current)}
          >
            <SlidersHorizontal className="size-4" />
            Más filtros
            {activeFilterCount > 0 ? (
              <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-primary-600 px-1.5 text-[0.68rem] font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
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

      <motion.section variants={cardReveal} className="min-w-0">
        <Card className="overflow-hidden p-0">
          {searchQuery.isLoading ? (
            <div className="flex items-center gap-2.5 px-6 py-10 text-sm text-(--app-text-muted)">
              <Spinner size="sm" /> Buscando candidatos…
            </div>
          ) : searchQuery.error ? (
            <div className="px-6 py-10 text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(searchQuery.error)}</div>
          ) : pageRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-(--app-border) bg-(--app-surface-muted) text-left text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-(--app-text-subtle)">
                    <th className="px-5 py-3 font-semibold">Candidato</th>
                    <th className="px-4 py-3 font-semibold">Perfil</th>
                    <th className="hidden px-4 py-3 font-semibold lg:table-cell">Ubicación</th>
                    <th className="px-4 py-3 font-semibold">Score</th>
                    <th className="px-4 py-3 font-semibold">Skills</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((candidate) => {
                    const isSelected = selectedCandidateProfileId === candidate.candidate_profile_id
                    const visibleSkills = candidate.skill_names.slice(0, 2)
                    const extraSkills = candidate.skill_names.length - visibleSkills.length
                    return (
                      <tr
                        key={candidate.candidate_profile_id}
                        onClick={() => selectCandidate(candidate.candidate_profile_id)}
                        className={cn(
                          'cursor-pointer border-b border-(--app-border)/70 transition-colors last:border-0',
                          isSelected ? 'bg-primary-50/70 dark:bg-primary-500/12' : 'hover:bg-(--app-surface-muted)/60'
                        )}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
                              {candidateInitials(candidate.display_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-(--app-text)">{candidate.display_name}</p>
                              <p className="truncate text-xs text-(--app-text-subtle)">
                                {candidate.total_experiences}{' '}
                                {candidate.total_experiences === 1 ? 'experiencia' : 'experiencias'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-(--app-text-muted)">
                          {candidate.desired_role || candidate.headline || 'Perfil visible'}
                        </td>
                        <td className="hidden px-4 py-3 text-(--app-text-muted) lg:table-cell">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="size-3.5 shrink-0 text-(--app-text-subtle)" />
                            <span className="truncate">{locationLabel(candidate)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-semibold',
                              scorePillClass(candidate.completeness_score)
                            )}
                          >
                            {candidate.completeness_score}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {visibleSkills.map((item) => (
                              <span
                                key={item}
                                className="inline-flex items-center rounded-control bg-(--app-surface-muted) px-2.5 py-1 text-[0.72rem] font-medium text-(--app-text-muted)"
                              >
                                {item}
                              </span>
                            ))}
                            {extraSkills > 0 ? (
                              <span className="inline-flex items-center rounded-control px-2 py-1 text-[0.72rem] font-semibold text-(--app-text-subtle)">
                                +{extraSkills}
                              </span>
                            ) : null}
                            {candidate.skill_names.length === 0 ? (
                              <span className="text-(--app-text-subtle)">—</span>
                            ) : null}
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
          <div className="mt-3 flex flex-col gap-3 border-t border-(--app-border) pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-(--app-text-muted)">
              Mostrando{' '}
              <span className="font-medium text-(--app-text-muted)">
                {pageStart + 1}–{Math.min(pageStart + TALENT_PAGE_SIZE, rows.length)}
              </span>{' '}
              de <span className="font-medium text-(--app-text-muted)">{rows.length}</span>{' '}
              {rows.length === 1 ? 'perfil' : 'perfiles'}
            </p>
            {pageCount > 1 ? (
              <Pagination page={safePage} totalPages={pageCount} onPageChange={setPage} ariaLabel="Paginación de talentos" />
            ) : null}
          </div>
        ) : null}
      </motion.section>

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
