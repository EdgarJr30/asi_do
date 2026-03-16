import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  fetchCandidateDirectoryDetail,
  searchCandidateDirectory,
  type CandidateDirectoryRow
} from '@/features/talent/lib/talent-api'

function CandidateSummaryCard({
  candidate,
  isSelected,
  onSelect
}: {
  candidate: CandidateDirectoryRow
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid w-full gap-3 rounded-[24px] border px-4 py-4 text-left transition ${
        isSelected
          ? 'border-primary-300 bg-primary-50/60 dark:border-primary-700 dark:bg-primary-950/30'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/70'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{candidate.display_name}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {candidate.desired_role || candidate.headline || 'Perfil visible para nuevas oportunidades'}
          </p>
        </div>
        <Badge variant="outline">{candidate.completeness_score}%</Badge>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        {candidate.latest_role_title ? <span>{candidate.latest_role_title}</span> : null}
        {candidate.city_name || candidate.country_code ? (
          <span>
            {[candidate.city_name, candidate.country_code].filter(Boolean).join(', ')}
          </span>
        ) : null}
        {candidate.total_experiences > 0 ? <span>{candidate.total_experiences} experiencias</span> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {candidate.skill_names.slice(0, 4).map((skill) => (
          <Badge key={skill} variant="soft">
            {skill}
          </Badge>
        ))}
      </div>
    </button>
  )
}

export function TalentDirectoryPage() {
  const session = useAppSession()
  const tenantId = session.primaryMembership?.tenantId ?? null
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

  const detailQuery = useQuery({
    queryKey: ['talent-directory-detail', tenantId, selectedCandidateProfileId],
    enabled: Boolean(tenantId && selectedCandidateProfileId),
    queryFn: async () => fetchCandidateDirectoryDetail(tenantId!, selectedCandidateProfileId!)
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent search"
        title="Encuentra personas abiertas a nuevas oportunidades"
        description="Busca perfiles visibles, revisa su historia y encuentra talento alineado con lo que tu equipo necesita hoy."
      >
        <StatCard label="Búsqueda" value="Directa" helper="Keyword, skill, idioma y país en una sola vista." />
        <StatCard label="Visibilidad" value="Activa" helper="Cada candidato decide si aparece o no en el directorio." />
        <StatCard
          className="bg-[var(--app-surface-muted)]"
          label="Seguimiento"
          value="Activa"
          helper="Tu equipo puede revisar el historial de consulta cuando hace falta."
        />
      </PageHeader>

      <Card className="bg-[var(--app-surface-muted)]">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Define el tipo de perfil que quieres encontrar antes de revisar resultados.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm">
            <span>Keyword o rol</span>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ingeniero electrico" />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Skill</span>
            <Input value={skill} onChange={(event) => setSkill(event.target.value)} placeholder="AutoCAD, React..." />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Idioma</span>
            <Input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="Español, English..." />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Pais</span>
            <Input value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} maxLength={2} />
          </label>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
            <CardDescription>
              {searchQuery.data ? `${searchQuery.data.length} perfiles visibles encontrados para este filtro.` : 'Usa filtros para buscar talento visible.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {searchQuery.isLoading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Buscando candidatos...</p>
            ) : searchQuery.error ? (
              <p className="text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(searchQuery.error)}</p>
            ) : searchQuery.data && searchQuery.data.length > 0 ? (
              searchQuery.data.map((candidate) => (
                <CandidateSummaryCard
                  key={candidate.candidate_profile_id}
                  candidate={candidate}
                  isSelected={selectedCandidateProfileId === candidate.candidate_profile_id}
                  onSelect={() => setSelectedCandidateProfileId(candidate.candidate_profile_id)}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                No hay perfiles visibles que coincidan todavia con estos criterios.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perfil completo</CardTitle>
            <CardDescription>
              Selecciona un resultado para abrir su experiencia, habilidades y materiales más importantes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedCandidateProfileId ? (
              <div className="rounded-[24px] border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                Elige un candidato de la lista para ver su experiencia, educación, habilidades e historial.
              </div>
            ) : detailQuery.isLoading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando perfil completo...</p>
            ) : detailQuery.error || !detailQuery.data ? (
              <p className="text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(detailQuery.error)}</p>
            ) : (
              <>
                <div className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                        {detailQuery.data.profile.display_name}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {detailQuery.data.profile.desired_role || detailQuery.data.profile.headline || detailQuery.data.profile.email}
                      </p>
                    </div>
                    <Badge variant="outline">{detailQuery.data.profile.completeness_score}%</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                    {detailQuery.data.profile.summary || 'Este perfil aun no agrego un resumen profesional.'}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Experiencia</p>
                    <div className="mt-3 space-y-3">
                      {detailQuery.data.experiences.length > 0 ? (
                        detailQuery.data.experiences.map((experience) => (
                          <div key={experience.id} className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm dark:bg-zinc-900/80">
                            <p className="font-semibold">{experience.role_title}</p>
                            <p className="text-zinc-600 dark:text-zinc-400">{experience.company_name}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">No hay experiencias cargadas.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Educacion</p>
                    <div className="mt-3 space-y-3">
                      {detailQuery.data.educations.length > 0 ? (
                        detailQuery.data.educations.map((education) => (
                          <div key={education.id} className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm dark:bg-zinc-900/80">
                            <p className="font-semibold">{education.degree_name}</p>
                            <p className="text-zinc-600 dark:text-zinc-400">{education.institution_name}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">No hay educacion cargada.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Skills</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detailQuery.data.skills.length > 0 ? (
                        detailQuery.data.skills.map((skillItem) => (
                          <Badge key={skillItem.id} variant="soft">
                            {skillItem.skill_name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Sin skills cargadas.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Idiomas</p>
                    <div className="mt-3 space-y-2">
                      {detailQuery.data.languages.length > 0 ? (
                        detailQuery.data.languages.map((languageItem) => (
                          <div key={languageItem.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                            {languageItem.language_name} · {languageItem.proficiency_label}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Sin idiomas cargados.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">CVs cargados</p>
                    <div className="mt-3 space-y-2">
                      {detailQuery.data.resumes.length > 0 ? (
                        detailQuery.data.resumes.map((resume) => (
                          <div key={resume.id} className="flex items-center justify-between gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                            <span>{resume.filename}</span>
                            {resume.is_default ? <Badge variant="outline">Principal</Badge> : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Sin CVs visibles.</p>
                      )}
                    </div>
                  </div>
                </div>

                {detailQuery.data.links.length > 0 ? (
                  <div className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Links</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detailQuery.data.links.map((link) => (
                        <Button key={link.id} variant="outline" onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}>
                          {link.label || link.link_type}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
