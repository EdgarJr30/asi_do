import { type Dispatch, type SetStateAction, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { StatCard } from '@/components/ui/stat-card'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  createCandidateResumeUrl,
  deleteCandidateResume,
  fetchMyCandidateProfile,
  saveCandidateProfileBundle,
  setDefaultCandidateResume,
  updateCandidateVisibility,
  type CandidateProfileBundle,
  uploadCandidateResume
} from '@/features/candidate-profile/lib/candidate-profile-api'
import {
  candidateProfileSchema,
  createEmptyCandidateEducation,
  createEmptyCandidateExperience,
  createEmptyCandidateLanguage,
  createEmptyCandidateLink,
  createEmptyCandidateSkill,
  sanitizeCandidateEducationList,
  sanitizeCandidateExperienceList,
  sanitizeCandidateLanguageList,
  sanitizeCandidateLinkList,
  sanitizeCandidateSkillList,
  type CandidateEducationDraft,
  type CandidateExperienceDraft,
  type CandidateLanguageDraft,
  type CandidateLinkDraft,
  type CandidateProfileFormValues,
  type CandidateSkillDraft
} from '@/features/candidate-profile/lib/candidate-profile-schemas'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import {
  CANDIDATE_RESUME_MIME_TYPES,
  MAX_UPLOAD_SIZE_LABEL,
  prepareUploadFile,
  UploadConstraintError
} from '@/lib/uploads/media'

const CANDIDATE_PROFILE_QUERY_KEY = ['candidate-profile', 'mine'] as const

function normalizeCandidateResumeLabel(mimeType: string) {
  if (mimeType === 'application/pdf') {
    return 'PDF'
  }

  if (mimeType === 'application/msword') {
    return 'DOC'
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'DOCX'
  }

  return mimeType
}

function toExperienceDrafts(bundle: CandidateProfileBundle) {
  return bundle.experiences.length > 0
    ? bundle.experiences.map((item) => ({
        id: item.id,
        companyName: item.company_name,
        roleTitle: item.role_title,
        employmentType: item.employment_type ?? '',
        cityName: item.city_name ?? '',
        countryCode: item.country_code ?? '',
        startDate: item.start_date,
        endDate: item.end_date ?? '',
        isCurrent: item.is_current,
        summary: item.summary ?? ''
      }))
    : [createEmptyCandidateExperience()]
}

function toEducationDrafts(bundle: CandidateProfileBundle) {
  return bundle.educations.length > 0
    ? bundle.educations.map((item) => ({
        id: item.id,
        institutionName: item.institution_name,
        degreeName: item.degree_name,
        fieldOfStudy: item.field_of_study ?? '',
        startDate: item.start_date ?? '',
        endDate: item.end_date ?? '',
        isCurrent: item.is_current,
        summary: item.summary ?? ''
      }))
    : [createEmptyCandidateEducation()]
}

function toSkillDrafts(bundle: CandidateProfileBundle) {
  return bundle.skills.length > 0
    ? bundle.skills.map((item) => ({
        id: item.id,
        skillName: item.skill_name,
        proficiencyLabel: item.proficiency_label ?? ''
      }))
    : [createEmptyCandidateSkill()]
}

function toLanguageDrafts(bundle: CandidateProfileBundle) {
  return bundle.languages.length > 0
    ? bundle.languages.map((item) => ({
        id: item.id,
        languageName: item.language_name,
        proficiencyLabel: item.proficiency_label
      }))
    : [createEmptyCandidateLanguage()]
}

function toLinkDrafts(bundle: CandidateProfileBundle) {
  return bundle.links.length > 0
    ? bundle.links.map((item) => ({
        id: item.id,
        linkType: item.link_type as CandidateLinkDraft['linkType'],
        label: item.label ?? '',
        url: item.url
      }))
    : [createEmptyCandidateLink()]
}

function createEditorKey(bundle: CandidateProfileBundle) {
  return [
    bundle.profile?.updated_at ?? 'no-profile',
    bundle.resumes.length,
    bundle.experiences.length,
    bundle.educations.length,
    bundle.skills.length,
    bundle.languages.length,
    bundle.links.length
  ].join(':')
}

function updateCollectionItem<T extends { id: string }>(
  setter: Dispatch<SetStateAction<T[]>>,
  itemId: string,
  patch: Partial<T>
) {
  setter((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)))
}

function CandidateProfileEditor({
  bundle,
  session
}: {
  bundle: CandidateProfileBundle
  session: ReturnType<typeof useAppSession>
}) {
  const queryClient = useQueryClient()
  const [experiences, setExperiences] = useState<CandidateExperienceDraft[]>(() => toExperienceDrafts(bundle))
  const [educations, setEducations] = useState<CandidateEducationDraft[]>(() => toEducationDrafts(bundle))
  const [skills, setSkills] = useState<CandidateSkillDraft[]>(() => toSkillDrafts(bundle))
  const [languages, setLanguages] = useState<CandidateLanguageDraft[]>(() => toLanguageDrafts(bundle))
  const [links, setLinks] = useState<CandidateLinkDraft[]>(() => toLinkDrafts(bundle))
  const [resumeFileError, setResumeFileError] = useState<string | null>(null)
  const [isVisibleToRecruiters, setIsVisibleToRecruiters] = useState(() => bundle.profile?.is_visible_to_recruiters ?? false)

  const form = useForm<CandidateProfileFormValues>({
    resolver: zodResolver(candidateProfileSchema),
    defaultValues: {
      headline: bundle.profile?.headline ?? '',
      desiredRole: bundle.profile?.desired_role ?? '',
      cityName: bundle.profile?.city_name ?? '',
      countryCode: bundle.profile?.country_code ?? session.profile?.country_code ?? 'DO',
      summary: bundle.profile?.summary ?? ''
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (values: CandidateProfileFormValues) => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesion activa para guardar tu perfil candidato.')
      }

      return saveCandidateProfileBundle({
        userId: session.authUser.id,
        profile: {
          headline: values.headline?.trim() || undefined,
          desiredRole: values.desiredRole?.trim() || undefined,
          cityName: values.cityName?.trim() || undefined,
          countryCode: values.countryCode?.trim() || undefined,
          summary: values.summary?.trim() || undefined,
          isVisibleToRecruiters
        },
        experiences: sanitizeCandidateExperienceList(experiences).map((item) => ({
          companyName: item.companyName,
          roleTitle: item.roleTitle,
          employmentType: item.employmentType || undefined,
          cityName: item.cityName || undefined,
          countryCode: item.countryCode || undefined,
          startDate: item.startDate,
          endDate: item.isCurrent ? undefined : item.endDate || undefined,
          isCurrent: item.isCurrent,
          summary: item.summary || undefined
        })),
        educations: sanitizeCandidateEducationList(educations).map((item) => ({
          institutionName: item.institutionName,
          degreeName: item.degreeName,
          fieldOfStudy: item.fieldOfStudy || undefined,
          startDate: item.startDate || undefined,
          endDate: item.isCurrent ? undefined : item.endDate || undefined,
          isCurrent: item.isCurrent,
          summary: item.summary || undefined
        })),
        skills: sanitizeCandidateSkillList(skills).map((item) => ({
          skillName: item.skillName,
          proficiencyLabel: item.proficiencyLabel || undefined
        })),
        languages: sanitizeCandidateLanguageList(languages).map((item) => ({
          languageName: item.languageName,
          proficiencyLabel: item.proficiencyLabel
        })),
        links: sanitizeCandidateLinkList(links).map((item) => ({
          linkType: item.linkType,
          label: item.label || undefined,
          url: item.url
        }))
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CANDIDATE_PROFILE_QUERY_KEY })
      toast.success('Perfil candidato actualizado', {
        description: 'Tu identidad profesional reusable ya quedo guardada.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos guardar tu perfil candidato',
        source: 'candidate-profile.save',
        route: '/candidate/profile',
        userId: session.authUser?.id ?? null,
        error,
        userMessage: 'No pudimos guardar tu perfil candidato.'
      })
    }
  })

  const uploadResumeMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesion activa para subir un CV.')
      }

      const preparedFile = await prepareUploadFile(file, {
        acceptedMimeTypes: CANDIDATE_RESUME_MIME_TYPES,
        acceptedFormatsLabel: 'PDF, DOC o DOCX',
        fieldLabel: 'El CV'
      })

      return uploadCandidateResume({
        userId: session.authUser.id,
        file: preparedFile
      })
    },
    onSuccess: async () => {
      setResumeFileError(null)
      await queryClient.invalidateQueries({ queryKey: CANDIDATE_PROFILE_QUERY_KEY })
      toast.success('CV cargado', {
        description: 'El archivo privado ya quedo listo para reusar en futuras aplicaciones.'
      })
    },
    onError: async (error) => {
      const description =
        error instanceof UploadConstraintError ? error.userMessage : toErrorMessage(error)

      setResumeFileError(description)
      await reportErrorWithToast({
        title: 'No pudimos subir tu CV',
        source: 'candidate-profile.resume-upload',
        route: '/candidate/profile',
        userId: session.authUser?.id ?? null,
        error,
        description,
        userMessage: description
      })
    }
  })

  const setDefaultResumeMutation = useMutation({
    mutationFn: setDefaultCandidateResume,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CANDIDATE_PROFILE_QUERY_KEY })
      toast.success('CV principal actualizado', {
        description: 'Ese archivo ahora se usara como version principal.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos cambiar el CV principal',
        source: 'candidate-profile.resume-default',
        route: '/candidate/profile',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const deleteResumeMutation = useMutation({
    mutationFn: deleteCandidateResume,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CANDIDATE_PROFILE_QUERY_KEY })
      toast.success('CV eliminado', {
        description: 'La version seleccionada ya no aparece en tu perfil candidato.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos eliminar el CV',
        source: 'candidate-profile.resume-delete',
        route: '/candidate/profile',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const visibilityMutation = useMutation({
    mutationFn: async (nextValue: boolean) => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesion activa para cambiar tu visibilidad.')
      }

      return updateCandidateVisibility({
        userId: session.authUser.id,
        isVisibleToRecruiters: nextValue
      })
    },
    onSuccess: async (_, nextValue) => {
      setIsVisibleToRecruiters(nextValue)
      await queryClient.invalidateQueries({ queryKey: CANDIDATE_PROFILE_QUERY_KEY })
      toast.success(nextValue ? 'Perfil visible para recruiters' : 'Perfil oculto para recruiters', {
        description: nextValue
          ? 'Tu perfil ya puede aparecer en busquedas employer fuera de applications.'
          : 'Tu perfil deja de aparecer en el directorio de talento, pero todavia puedes aplicar a vacantes.'
      })
    },
    onError: async (error) => {
      setIsVisibleToRecruiters(bundle.profile?.is_visible_to_recruiters ?? false)
      await reportErrorWithToast({
        title: 'No pudimos actualizar la visibilidad de tu perfil',
        source: 'candidate-profile.visibility',
        route: '/candidate/profile',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const profile = bundle.profile
  const resumes = bundle.resumes
  const completenessScore = profile?.completeness_score ?? 0
  const completionTone =
    completenessScore >= 80 ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200'
    : completenessScore >= 50
      ? 'bg-secondary-50 text-secondary-600 dark:bg-secondary-500/12 dark:text-secondary-200'
      : 'bg-accent-50 text-accent-600 dark:bg-accent-500/12 dark:text-accent-200'

  async function openResume(storagePath: string) {
    try {
      const url = await createCandidateResumeUrl(storagePath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos abrir el CV',
        source: 'candidate-profile.resume-open',
        route: '/candidate/profile',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Candidate profile"
        title="Haz que tu perfil se vea fuerte y esté listo para cada oportunidad"
        description="Aquí guardas tu CV, tu resumen y lo que quieres mostrar para aplicar más rápido y presentarte mejor."
      >
        <StatCard
          helper={session.profile?.email}
          label="Cuenta"
          value={session.profile?.display_name ?? session.profile?.full_name ?? 'Perfil candidato'}
        />
        <StatCard
          helper="Mientras más completo esté el perfil, más rápido será aplicar después."
          label="Completitud"
          value={`${completenessScore}%`}
        />
        <StatCard label="CVs" value={resumes.length} helper={`Tus archivos listos para reutilizarlos, con límite de ${MAX_UPLOAD_SIZE_LABEL}.`} />
        <StatCard
          className="bg-[var(--app-surface-muted)]"
          helper={isVisibleToRecruiters ? 'Tu perfil puede aparecer para empresas que buscan talento.' : 'Tu perfil sigue privado por ahora.'}
          label="Visibilidad"
          value={isVisibleToRecruiters ? 'Activa' : 'Privada'}
        />
      </PageHeader>

      <Card className="bg-[var(--app-surface-muted)]">
        <CardHeader>
          <CardTitle>Checklist viva del perfil</CardTitle>
          <CardDescription>
            Mantén estas piezas al día para que aplicar sea rápido y tu perfil se vea sólido cuando te busquen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <div className={`rounded-2xl px-3 py-3 text-sm ${completionTone}`}>
            Perfil base profesional y metadatos de ubicación conectados a la cuenta.
          </div>
          <div className="rounded-2xl bg-[var(--app-surface)] px-3 py-3 text-sm text-[var(--app-text-muted)]">
            CV privado, listo para volver a usar cuando aparezca la oportunidad correcta.
          </div>
          <div className="rounded-2xl bg-[var(--app-surface)] px-3 py-3 text-sm text-[var(--app-text-muted)]">
            Experiencia, educación, skills, idiomas y links como bloques editables.
          </div>
          <div className="rounded-2xl bg-[var(--app-surface)] px-3 py-3 text-sm text-[var(--app-text-muted)]">
            Activa tu visibilidad si quieres que empresas te encuentren sin haber aplicado.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estado del candidato</CardTitle>
          <CardDescription>Tu perfil te acompaña aunque también colabores con una empresa dentro de la plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{resumes.length > 0 ? `${resumes.length} CVs` : 'Sin CV'}</Badge>
            <Badge variant="outline">{sanitizeCandidateSkillList(skills).length} skills</Badge>
            <Badge variant="outline">{sanitizeCandidateLanguageList(languages).length} idiomas</Badge>
            <Badge variant="outline">{sanitizeCandidateExperienceList(experiences).length} experiencias</Badge>
            <Badge variant={isVisibleToRecruiters ? 'soft' : 'outline'}>
              {isVisibleToRecruiters ? 'Visible para empresas' : 'No visible en directorio'}
            </Badge>
          </div>
          <div className="mt-4 rounded-[24px] border px-4 py-4">
            <label className="flex items-start gap-3 text-sm text-[var(--app-text-muted)]">
              <input
                type="checkbox"
                checked={isVisibleToRecruiters}
                disabled={visibilityMutation.isPending}
                onChange={(event) => {
                  const nextValue = event.target.checked
                  setIsVisibleToRecruiters(nextValue)
                  visibilityMutation.mutate(nextValue)
                }}
              />
              <span>
                Permitir que empresas autorizadas encuentren este perfil en el directorio de talento.
                <span className="mt-1 block text-xs text-[var(--app-text-subtle)]">
                  Esto no afecta tu capacidad de aplicar a vacantes si prefieres mantener el perfil oculto.
                </span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Perfil profesional</CardTitle>
            <CardDescription>Resumen reutilizable para futuras aplicaciones y nuevas oportunidades.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={(event) => void form.handleSubmit((values) => saveMutation.mutate(values))(event)}>
              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Titular profesional</span>
                <Input placeholder="Recruiter operations specialist" {...form.register('headline')} />
                <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.headline?.message}</p>
              </label>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Rol objetivo</span>
                <Input placeholder="Talent acquisition lead" {...form.register('desiredRole')} />
                <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.desiredRole?.message}</p>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Ciudad</span>
                  <Input placeholder="Santo Domingo" {...form.register('cityName')} />
                </label>
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Pais</span>
                  <Input maxLength={2} placeholder="DO" {...form.register('countryCode')} />
                  <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.countryCode?.message}</p>
                </label>
              </div>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Resumen profesional</span>
                <Textarea
                  placeholder="Resume tu experiencia, stack, logros y el tipo de oportunidad que buscas."
                  {...form.register('summary')}
                />
                <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.summary?.message}</p>
              </label>

              <Button className="w-full" disabled={saveMutation.isPending} type="submit">
                {saveMutation.isPending ? 'Guardando perfil candidato...' : 'Guardar perfil candidato'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CV privado</CardTitle>
            <CardDescription>
              Sube versiones reutilizables. Cada archivo se guarda de forma privada y mantiene un límite de {MAX_UPLOAD_SIZE_LABEL}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <span>Subir nuevo CV</span>
              <Input
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0]

                  if (file) {
                    setResumeFileError(null)
                    uploadResumeMutation.mutate(file)
                  }

                  event.currentTarget.value = ''
                }}
              />
              <p className="text-xs text-zinc-500">
                Acepta PDF, DOC y DOCX. Si pesa mas de {MAX_UPLOAD_SIZE_LABEL}, se rechazara con el peso detectado.
              </p>
              {resumeFileError ? <p className="text-xs text-rose-600 dark:text-rose-300">{resumeFileError}</p> : null}
            </label>

            <div className="space-y-3">
              {resumes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  Todavia no has subido CVs. El primero quedara como principal.
                </div>
              ) : (
                resumes.map((resume) => (
                  <div
                    key={resume.id}
                    className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{resume.filename}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {normalizeCandidateResumeLabel(resume.mime_type)} · {(resume.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      {resume.is_default ? <Badge variant="soft">Principal</Badge> : <Badge variant="outline">Secundario</Badge>}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => void openResume(resume.storage_path)}>
                        Abrir
                      </Button>
                      {!resume.is_default ? (
                        <Button
                          variant="outline"
                          onClick={() => setDefaultResumeMutation.mutate(resume.id)}
                          disabled={setDefaultResumeMutation.isPending}
                        >
                          Usar como principal
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        onClick={() => deleteResumeMutation.mutate(resume)}
                        disabled={deleteResumeMutation.isPending}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Experiencia y educacion</CardTitle>
            <CardDescription>Bloques ligeros y editables para el loop MVP.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Experiencia</h3>
                <Button variant="outline" onClick={() => setExperiences((current) => [...current, createEmptyCandidateExperience()])}>
                  Agregar experiencia
                </Button>
              </div>
              <div className="space-y-4">
                {experiences.map((experience) => (
                  <div key={experience.id} className="rounded-3xl border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="Empresa"
                        value={experience.companyName}
                        onChange={(event) => updateCollectionItem(setExperiences, experience.id, { companyName: event.target.value })}
                      />
                      <Input
                        placeholder="Rol"
                        value={experience.roleTitle}
                        onChange={(event) => updateCollectionItem(setExperiences, experience.id, { roleTitle: event.target.value })}
                      />
                      <Input
                        placeholder="Tipo de empleo"
                        value={experience.employmentType}
                        onChange={(event) => updateCollectionItem(setExperiences, experience.id, { employmentType: event.target.value })}
                      />
                      <Input
                        placeholder="Ciudad / pais"
                        value={experience.cityName}
                        onChange={(event) => updateCollectionItem(setExperiences, experience.id, { cityName: event.target.value })}
                      />
                      <Input
                        type="date"
                        value={experience.startDate}
                        onChange={(event) => updateCollectionItem(setExperiences, experience.id, { startDate: event.target.value })}
                      />
                      <Input
                        type="date"
                        disabled={experience.isCurrent}
                        value={experience.endDate}
                        onChange={(event) => updateCollectionItem(setExperiences, experience.id, { endDate: event.target.value })}
                      />
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <input
                        checked={experience.isCurrent}
                        type="checkbox"
                        onChange={(event) =>
                          updateCollectionItem(setExperiences, experience.id, {
                            isCurrent: event.target.checked,
                            endDate: event.target.checked ? '' : experience.endDate
                          })
                        }
                      />
                      Trabajo actual
                    </label>
                    <Textarea
                      className="mt-3"
                      placeholder="Impacto, responsabilidades y resultados."
                      value={experience.summary}
                      onChange={(event) => updateCollectionItem(setExperiences, experience.id, { summary: event.target.value })}
                    />
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setExperiences((current) =>
                            current.length === 1 ? [createEmptyCandidateExperience()] : current.filter((item) => item.id !== experience.id)
                          )
                        }
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Educacion</h3>
                <Button variant="outline" onClick={() => setEducations((current) => [...current, createEmptyCandidateEducation()])}>
                  Agregar educacion
                </Button>
              </div>
              <div className="space-y-4">
                {educations.map((education) => (
                  <div key={education.id} className="rounded-3xl border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="Institucion"
                        value={education.institutionName}
                        onChange={(event) => updateCollectionItem(setEducations, education.id, { institutionName: event.target.value })}
                      />
                      <Input
                        placeholder="Titulo o grado"
                        value={education.degreeName}
                        onChange={(event) => updateCollectionItem(setEducations, education.id, { degreeName: event.target.value })}
                      />
                      <Input
                        placeholder="Area de estudio"
                        value={education.fieldOfStudy}
                        onChange={(event) => updateCollectionItem(setEducations, education.id, { fieldOfStudy: event.target.value })}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          type="date"
                          value={education.startDate}
                          onChange={(event) => updateCollectionItem(setEducations, education.id, { startDate: event.target.value })}
                        />
                        <Input
                          type="date"
                          disabled={education.isCurrent}
                          value={education.endDate}
                          onChange={(event) => updateCollectionItem(setEducations, education.id, { endDate: event.target.value })}
                        />
                      </div>
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <input
                        checked={education.isCurrent}
                        type="checkbox"
                        onChange={(event) =>
                          updateCollectionItem(setEducations, education.id, {
                            isCurrent: event.target.checked,
                            endDate: event.target.checked ? '' : education.endDate
                          })
                        }
                      />
                      En curso actualmente
                    </label>
                    <Textarea
                      className="mt-3"
                      placeholder="Logros, enfoque o certificaciones."
                      value={education.summary}
                      onChange={(event) => updateCollectionItem(setEducations, education.id, { summary: event.target.value })}
                    />
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setEducations((current) =>
                            current.length === 1 ? [createEmptyCandidateEducation()] : current.filter((item) => item.id !== education.id)
                          )
                        }
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills, idiomas y links</CardTitle>
            <CardDescription>Metadata reusable para matching y perfiles publicables mas adelante.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Skills</h3>
                <Button variant="outline" onClick={() => setSkills((current) => [...current, createEmptyCandidateSkill()])}>
                  Agregar skill
                </Button>
              </div>
              {skills.map((skill) => (
                <div key={skill.id} className="grid gap-3 rounded-3xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-[1fr_0.8fr_auto]">
                  <Input
                    placeholder="Skill"
                    value={skill.skillName}
                    onChange={(event) => updateCollectionItem(setSkills, skill.id, { skillName: event.target.value })}
                  />
                  <Input
                    placeholder="Nivel"
                    value={skill.proficiencyLabel}
                    onChange={(event) => updateCollectionItem(setSkills, skill.id, { proficiencyLabel: event.target.value })}
                  />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setSkills((current) => (current.length === 1 ? [createEmptyCandidateSkill()] : current.filter((item) => item.id !== skill.id)))
                    }
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Idiomas</h3>
                <Button variant="outline" onClick={() => setLanguages((current) => [...current, createEmptyCandidateLanguage()])}>
                  Agregar idioma
                </Button>
              </div>
              {languages.map((language) => (
                <div key={language.id} className="grid gap-3 rounded-3xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-[1fr_0.8fr_auto]">
                  <Input
                    placeholder="Idioma"
                    value={language.languageName}
                    onChange={(event) => updateCollectionItem(setLanguages, language.id, { languageName: event.target.value })}
                  />
                  <Input
                    placeholder="Nivel"
                    value={language.proficiencyLabel}
                    onChange={(event) => updateCollectionItem(setLanguages, language.id, { proficiencyLabel: event.target.value })}
                  />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setLanguages((current) =>
                        current.length === 1 ? [createEmptyCandidateLanguage()] : current.filter((item) => item.id !== language.id)
                      )
                    }
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Links</h3>
                <Button variant="outline" onClick={() => setLinks((current) => [...current, createEmptyCandidateLink()])}>
                  Agregar link
                </Button>
              </div>
              {links.map((link) => (
                <div key={link.id} className="space-y-3 rounded-3xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="grid gap-3 sm:grid-cols-[0.7fr_1fr]">
                    <Select
                      value={link.linkType}
                      onChange={(event) => updateCollectionItem(setLinks, link.id, { linkType: event.target.value as CandidateLinkDraft['linkType'] })}
                    >
                      <option value="other">Other</option>
                      <option value="portfolio">Portfolio</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="github">GitHub</option>
                      <option value="website">Website</option>
                    </Select>
                    <Input
                      placeholder="Etiqueta"
                      value={link.label}
                      onChange={(event) => updateCollectionItem(setLinks, link.id, { label: event.target.value })}
                    />
                  </div>
                  <Input
                    placeholder="https://..."
                    value={link.url}
                    onChange={(event) => updateCollectionItem(setLinks, link.id, { url: event.target.value })}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setLinks((current) => (current.length === 1 ? [createEmptyCandidateLink()] : current.filter((item) => item.id !== link.id)))
                      }
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={() => void form.handleSubmit((values) => saveMutation.mutate(values))()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Sincronizando secciones...' : 'Guardar experiencia, educacion y metadata'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function CandidateProfilePage() {
  const session = useAppSession()
  const profileQuery = useQuery({
    queryKey: CANDIDATE_PROFILE_QUERY_KEY,
    queryFn: async () => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesion activa para editar tu perfil candidato.')
      }

      return fetchMyCandidateProfile(session.authUser.id)
    },
    enabled: session.authUser !== null
  })

  if (!session.authUser) {
    return null
  }

  if (profileQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Perfil candidato</CardTitle>
          <CardDescription>Cargando tu informacion profesional reusable...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (profileQuery.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Perfil candidato</CardTitle>
          <CardDescription>No pudimos cargar tu perfil candidato en este momento.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void profileQuery.refetch()}>Reintentar</Button>
        </CardContent>
      </Card>
    )
  }

  const bundle = profileQuery.data ?? {
    profile: null,
    resumes: [],
    experiences: [],
    educations: [],
    skills: [],
    languages: [],
    links: []
  }

  return <CandidateProfileEditor key={createEditorKey(bundle)} bundle={bundle} session={session} />
}
