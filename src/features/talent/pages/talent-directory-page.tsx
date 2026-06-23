import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  fetchCandidateDirectoryDetail,
  searchCandidateDirectory,
  type CandidateDirectoryRow
} from '@/features/talent/lib/talent-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'

function candidateInitials(candidate: CandidateDirectoryRow) {
  return candidate.display_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function TalentDirectoryPage() {
  const session = useAppSession()
  const tenantId = session.activeTenantId
  const [query, setQuery] = useState('')
  const [skill, setSkill] = useState('')
  const [language, setLanguage] = useState('')
  const [countryCode, setCountryCode] = useState('')
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

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[1.7rem] font-semibold tracking-tight text-(--app-text) sm:text-[2rem]">Candidatos</h1>
          <p className="mt-1 text-sm text-(--app-text-muted)">
            {searchQuery.data?.length ?? 0} {(searchQuery.data?.length ?? 0) === 1 ? 'perfil visible' : 'perfiles visibles'}
          </p>
        </div>
      </section>

      <div className="rounded-panel border border-(--app-border) bg-(--app-surface) p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2.5 rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-3.5">
          <Search aria-hidden="true" className="size-4 text-(--app-text-subtle)" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o posición..."
            className="h-11 w-full bg-transparent text-sm text-(--app-text) outline-none placeholder:text-(--app-text-subtle)"
          />
        </div>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
          <Input value={skill} onChange={(event) => setSkill(event.target.value)} placeholder="Skill (ej. AutoCAD)" />
          <Input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="Idioma (ej. Español)" />
          <Input
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
            maxLength={2}
            placeholder="País (ej. DO)"
          />
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border-(--app-border) bg-(--app-surface-elevated) shadow-[0_18px_44px_rgba(19,42,97,0.06)]">
          <CardHeader className="border-b border-(--app-border)">
            <CardTitle>Resultados</CardTitle>
            <CardDescription>
              {searchQuery.data
                ? `${searchQuery.data.length} perfiles visibles encontrados con este criterio.`
                : 'Usa los filtros para comenzar una búsqueda más precisa.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {searchQuery.isLoading ? (
              <div className="px-6 py-8 text-sm text-(--app-text-muted)">Buscando candidatos...</div>
            ) : searchQuery.error ? (
              <div className="px-6 py-8 text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(searchQuery.error)}</div>
            ) : searchQuery.data && searchQuery.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full border-collapse">
                  <thead>
                    <tr className="bg-(--app-surface-muted)">
                      {['Candidato', 'Perfil', 'Ubicacion', 'Score', 'Skills'].map((label) => (
                        <th
                          key={label}
                          className="border-b border-(--app-border) px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-(--app-text-muted)"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {searchQuery.data.map((candidate) => {
                      const isSelected = selectedCandidateProfileId === candidate.candidate_profile_id

                      return (
                        <tr
                          key={candidate.candidate_profile_id}
                          className={
                            isSelected
                              ? 'bg-primary-50/70 dark:bg-primary-500/12'
                              : 'bg-(--app-surface-elevated)'
                          }
                        >
                          <td className="border-b border-(--app-border) px-4 py-3">
                            <button
                              className="flex w-full items-center gap-3 text-left"
                              type="button"
                              onClick={() => setSelectedCandidateProfileId(candidate.candidate_profile_id)}
                            >
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2d52a8,#8aa2d8)] text-xs font-semibold text-white">
                                {candidateInitials(candidate)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-(--app-text)">{candidate.display_name}</p>
                                <p className="truncate text-xs text-(--app-text-subtle)">
                                  {candidate.total_experiences} experiencias
                                </p>
                              </div>
                            </button>
                          </td>
                          <td className="border-b border-(--app-border) px-4 py-3 text-sm text-(--app-text-muted)">
                            {candidate.desired_role || candidate.headline || 'Perfil visible para nuevas oportunidades'}
                          </td>
                          <td className="border-b border-(--app-border) px-4 py-3 text-sm text-(--app-text-muted)">
                            {[candidate.city_name, candidate.country_code].filter(Boolean).join(', ') || 'No definida'}
                          </td>
                          <td className="border-b border-(--app-border) px-4 py-3">
                            <Badge variant="outline">{candidate.completeness_score}%</Badge>
                          </td>
                          <td className="border-b border-(--app-border) px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {candidate.skill_names.slice(0, 3).map((item) => (
                                <Badge key={item} variant="soft">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-8 text-sm text-(--app-text-muted)">
                No encontramos perfiles visibles con esta combinacion de filtros.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-(--app-border) bg-(--app-surface-elevated) shadow-[0_18px_44px_rgba(19,42,97,0.06)]">
          <CardHeader className="border-b border-(--app-border)">
            <CardTitle>Perfil completo</CardTitle>
            <CardDescription>Detalle operativo para decidir si vale la pena avanzar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {!selectedCandidateProfileId ? (
              <div className="rounded-[24px] border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-8 text-sm text-(--app-text-muted)">
                Elige un candidato de la tabla para revisar su experiencia, educacion, habilidades y resumen profesional.
              </div>
            ) : detailQuery.isLoading ? (
              <p className="text-sm text-(--app-text-muted)">Cargando perfil completo...</p>
            ) : detailQuery.error || !detailQuery.data ? (
              <p className="text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(detailQuery.error)}</p>
            ) : (
              <>
                <div className="rounded-[24px] border border-(--app-border) bg-(--app-surface-muted) p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-(--app-text)">{detailQuery.data.profile.display_name}</p>
                      <p className="mt-1 text-sm text-(--app-text-muted)">
                        {detailQuery.data.profile.desired_role ||
                          detailQuery.data.profile.headline ||
                          detailQuery.data.profile.email}
                      </p>
                    </div>
                    <Badge variant="outline">{detailQuery.data.profile.completeness_score}%</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-(--app-text-muted)">
                    {detailQuery.data.profile.summary || 'Este perfil aun no agrego un resumen profesional.'}
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[24px] border border-(--app-border) bg-(--app-surface) p-4">
                    <p className="text-sm font-semibold text-(--app-text)">Experiencia</p>
                    <div className="mt-3 space-y-3">
                      {detailQuery.data.experiences.length > 0 ? (
                        detailQuery.data.experiences.map((experience) => (
                          <div key={experience.id} className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-3 py-3 text-sm">
                            <p className="font-semibold text-(--app-text)">{experience.role_title}</p>
                            <p className="text-(--app-text-muted)">{experience.company_name}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-(--app-text-muted)">No hay experiencias cargadas.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-(--app-border) bg-(--app-surface) p-4">
                    <p className="text-sm font-semibold text-(--app-text)">Educacion</p>
                    <div className="mt-3 space-y-3">
                      {detailQuery.data.educations.length > 0 ? (
                        detailQuery.data.educations.map((education) => (
                          <div key={education.id} className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-3 py-3 text-sm">
                            <p className="font-semibold text-(--app-text)">{education.degree_name}</p>
                            <p className="text-(--app-text-muted)">{education.institution_name}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-(--app-text-muted)">No hay educacion cargada.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-(--app-border) bg-(--app-surface) p-4">
                    <p className="text-sm font-semibold text-(--app-text)">Habilidades e idiomas</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detailQuery.data.skills.map((skillItem) => (
                        <Badge key={skillItem.id} variant="soft">
                          {skillItem.skill_name}
                        </Badge>
                      ))}
                      {detailQuery.data.languages.map((languageItem) => (
                        <Badge key={languageItem.id} variant="outline">
                          {languageItem.language_name}
                        </Badge>
                      ))}
                      {detailQuery.data.skills.length === 0 && detailQuery.data.languages.length === 0 ? (
                        <span className="text-sm text-(--app-text-muted)">No hay habilidades ni idiomas registrados.</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
