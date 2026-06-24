import { type Dispatch, type ReactNode, type SetStateAction, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import {
  Briefcase,
  ChevronDown,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Languages as LanguagesIcon,
  Lightbulb,
  Link2,
  Plus,
  Sparkles,
  Upload,
  UserRound
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/loader'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { isDominicanRepublicCountryCode } from '@/shared/geo/location-options'
import { cardReveal, pageStagger } from '@/shared/ui/card-motion'
import { CountryCodeSelect, DominicanCitySelect } from '@/shared/ui/location-selects'
import { cn } from '@/lib/utils/cn'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { hasCompletedBaseOnboarding } from '@/features/auth/lib/onboarding-status'
import { ProfileOnboardingFlow } from '@/features/candidate-profile/components/profile-onboarding-flow'
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
  // Clave de identidad estable: NO incluimos `updated_at` a propósito. Si lo
  // incluyéramos, cada guardado (p. ej. el toggle de visibilidad) cambiaría la
  // key y React remontaría todo el editor, lo que se siente como recargar la app
  // (resetea formulario, pestaña activa, scroll y animaciones). Solo remontamos
  // cuando cambia la cantidad de elementos de una colección, para resembrar el
  // estado local de esos arrays tras agregar/eliminar.
  return [
    bundle.profile?.id ?? 'no-profile',
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

const updatedAtFormatter = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

function formatUpdatedAt(value?: string | null) {
  if (!value) {
    return 'Sin guardar todavía'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin guardar todavía' : updatedAtFormatter.format(date)
}

type ProfileTab = 'general' | 'cv' | 'experience' | 'skills'

const PROFILE_TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: 'general', label: 'Perfil general' },
  { id: 'cv', label: 'CV y visibilidad' },
  { id: 'experience', label: 'Experiencia y educación' },
  { id: 'skills', label: 'Skills, idiomas y links' }
]

function CircularProgress({ value }: { value: number }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference
  return (
    <div className="relative size-16 shrink-0">
      <svg className="size-16 -rotate-90" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-(--app-surface-muted)" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-primary-500 transition-[stroke-dashoffset] duration-700"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[0.82rem] font-semibold text-(--app-text)">{clamped}%</span>
    </div>
  )
}

function ProfileStatTile({ icon: Icon, value, label }: { icon: LucideIcon; value: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-(--app-border) bg-(--app-surface) px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--app-surface-muted) text-(--app-text-subtle)">
        <Icon className="size-4" />
      </span>
      <div className="leading-tight">
        <p className="text-[0.95rem] font-semibold text-(--app-text)">{value}</p>
        <p className="text-[0.66rem] text-(--app-text-muted)">{label}</p>
      </div>
    </div>
  )
}

function AccordionSection({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAdd,
  defaultOpen = false,
  children
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel: string
  onAdd: () => void
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-xl border border-(--app-border)">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
          <Icon className="size-4" />
        </span>
        <button type="button" onClick={() => setOpen((value) => !value)} className="min-w-0 flex-1 text-left">
          <h3 className="text-[0.9rem] font-semibold tracking-tight text-(--app-text)">{title}</h3>
          <p className="truncate text-[0.74rem] text-(--app-text-muted)">{description}</p>
        </button>
        <button
          type="button"
          onClick={() => {
            onAdd()
            setOpen(true)
          }}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-(--app-border) bg-(--app-surface) px-3 text-[0.74rem] font-semibold text-primary-600 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:text-primary-300 dark:hover:border-primary-400"
        >
          <Plus className="size-3.5" /> {actionLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Contraer' : 'Expandir'}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted)"
        >
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open ? <div className="space-y-4 border-t border-(--app-border) p-3.5">{children}</div> : null}
    </div>
  )
}

function QuickAction({ icon: Icon, title, description, onClick }: { icon: LucideIcon; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2.5 rounded-xl border border-(--app-border) bg-(--app-surface) px-3 py-2.5 text-left transition-colors hover:border-primary-200 hover:bg-(--app-surface-muted)"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--app-surface-muted) text-(--app-text-subtle)">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.82rem] font-semibold text-(--app-text)">{title}</span>
        <span className="block text-[0.72rem] text-(--app-text-muted)">{description}</span>
      </span>
    </button>
  )
}

function CandidateProfileEditor({
  bundle,
  session
}: {
  bundle: CandidateProfileBundle
  session: ReturnType<typeof useAppSession>
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const [activeTab, setActiveTab] = useState<ProfileTab>('general')
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
        throw new Error('Necesitas una sesión activa para guardar tu perfil candidato.')
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
        description: 'Tu identidad profesional reusable ya quedó guardada.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos guardar tu perfil candidato',
        source: 'candidate-profile.save',
        route: surfacePaths.candidate.profile,
        userId: session.authUser?.id ?? null,
        error,
        userMessage: 'No pudimos guardar tu perfil candidato.'
      })
    }
  })

  const uploadResumeMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesión activa para subir un CV.')
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
        description: 'El archivo privado ya quedó listo para reusar en futuras aplicaciones.'
      })
    },
    onError: async (error) => {
      const description =
        error instanceof UploadConstraintError ? error.userMessage : toErrorMessage(error)

      setResumeFileError(description)
      await reportErrorWithToast({
        title: 'No pudimos subir tu CV',
        source: 'candidate-profile.resume-upload',
        route: surfacePaths.candidate.profile,
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
        route: surfacePaths.candidate.profile,
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
        route: surfacePaths.candidate.profile,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const visibilityMutation = useMutation({
    mutationFn: async (nextValue: boolean) => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesión activa para cambiar tu visibilidad.')
      }

      return updateCandidateVisibility({
        userId: session.authUser.id,
        isVisibleToRecruiters: nextValue
      })
    },
    onSuccess: async (_, nextValue) => {
      setIsVisibleToRecruiters(nextValue)
      await queryClient.invalidateQueries({ queryKey: CANDIDATE_PROFILE_QUERY_KEY })
      toast.success(nextValue ? 'Perfil visible para empresas autorizadas' : 'Perfil oculto del directorio', {
        description: nextValue
          ? 'Tu perfil ya puede aparecer en busquedas de empresas autorizadas fuera de tus aplicaciones.'
          : 'Tu perfil deja de aparecer en el directorio de talento, pero todavia puedes aplicar a vacantes.'
      })
    },
    onError: async (error) => {
      setIsVisibleToRecruiters(bundle.profile?.is_visible_to_recruiters ?? false)
      await reportErrorWithToast({
        title: 'No pudimos actualizar la visibilidad de tu perfil',
        source: 'candidate-profile.visibility',
        route: surfacePaths.candidate.profile,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const resumes = bundle.resumes

  async function openResume(storagePath: string) {
    try {
      const url = await createCandidateResumeUrl(storagePath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos abrir el CV',
        source: 'candidate-profile.resume-open',
        route: surfacePaths.candidate.profile,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  }

  const watched = useWatch({ control: form.control })
  const isDominicanRepublicProfile = isDominicanRepublicCountryCode(watched.countryCode ?? '')
  const skillCount = sanitizeCandidateSkillList(skills).length
  const languageCount = sanitizeCandidateLanguageList(languages).length
  const experienceCount = sanitizeCandidateExperienceList(experiences).length
  const completionItems = [
    Boolean(watched.headline?.trim()),
    Boolean(watched.summary?.trim()),
    Boolean(watched.cityName?.trim() || watched.countryCode?.trim()),
    resumes.length > 0,
    experienceCount > 0,
    skillCount > 0,
    isVisibleToRecruiters
  ]
  const completionPercent = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100)
  const saveAll = form.handleSubmit((values) => saveMutation.mutate(values))

  return (
    <motion.div
      className="space-y-5"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.header variants={cardReveal} className="space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[0.7rem] font-semibold text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/12 dark:text-primary-300">
          <UserRound className="size-3.5" /> Candidate profile
        </span>
        <div className="space-y-1.5">
          <h1 className="max-w-2xl text-xl font-semibold leading-tight tracking-tight text-(--app-text) sm:text-[1.7rem]">
            Mantén un perfil profesional listo para aplicar
          </h1>
          <p className="max-w-2xl text-[0.85rem] text-(--app-text-muted)">
            Tu historial, CV y visibilidad viven aquí para que postularte o compartir tu perfil requiera menos esfuerzo.
          </p>
        </div>
      </motion.header>

      {/* Estado del perfil */}
      <motion.div variants={cardReveal}>
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
                <UserRound className="size-5" />
              </span>
              <div>
                <h2 className="text-[0.95rem] font-semibold tracking-tight text-(--app-text)">Estado del perfil</h2>
                <p className="text-[0.78rem] text-(--app-text-muted)">Revisa tu información y controla cómo te ven las empresas.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-(--app-border) bg-(--app-surface) px-3.5 py-2.5">
              <div className="text-right">
                <p className="text-[0.82rem] font-semibold text-(--app-text)">Visible para empresas</p>
                <p className="text-[0.7rem] text-(--app-text-muted)">
                  {isVisibleToRecruiters ? 'Tu perfil es visible en el directorio.' : 'Tu perfil está oculto del directorio.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isVisibleToRecruiters}
                aria-label="Visible para empresas"
                disabled={visibilityMutation.isPending}
                onClick={() => {
                  const nextValue = !isVisibleToRecruiters
                  setIsVisibleToRecruiters(nextValue)
                  visibilityMutation.mutate(nextValue)
                }}
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) disabled:opacity-60',
                  isVisibleToRecruiters ? 'bg-primary-500' : 'bg-(--app-surface-muted)'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
                    isVisibleToRecruiters ? 'left-[22px]' : 'left-0.5'
                  )}
                />
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <ProfileStatTile icon={FileText} value={resumes.length} label="CV" />
            <ProfileStatTile icon={Sparkles} value={skillCount} label="Skills" />
            <ProfileStatTile icon={LanguagesIcon} value={languageCount} label="Idiomas" />
            <ProfileStatTile icon={Briefcase} value={experienceCount} label="Experiencia" />
          </div>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={cardReveal} className="flex flex-wrap gap-1.5 rounded-xl border border-(--app-border) bg-(--app-surface) p-1.5">
        {PROFILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[0.8rem] font-semibold transition-colors',
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'text-(--app-text-muted) hover:bg-(--app-surface-muted) hover:text-(--app-text)'
            )}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      <div className="grid items-start gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        {/* Panel principal */}
        <motion.div variants={cardReveal} className="space-y-4">
          {activeTab === 'general' ? (
            <Card>
              <h2 className="text-[0.95rem] font-semibold tracking-tight text-(--app-text)">Perfil general</h2>
              <p className="text-[0.78rem] text-(--app-text-muted)">Resumen reutilizable para futuras aplicaciones y nuevas oportunidades.</p>
              <div className="mt-4 space-y-4">
                <label className="space-y-1.5 text-[0.82rem] font-medium text-(--app-text)">
                  <span>Titular profesional</span>
                  <Input placeholder="Ej. Coordinador de proyectos" {...form.register('headline')} />
                  <p className="text-[0.72rem] text-rose-600 dark:text-rose-300">{form.formState.errors.headline?.message}</p>
                </label>

                <label className="space-y-1.5 text-[0.82rem] font-medium text-(--app-text)">
                  <span>Rol objetivo</span>
                  <Input placeholder="Ej. Talent Acquisition Lead" {...form.register('desiredRole')} />
                  <p className="text-[0.72rem] text-rose-600 dark:text-rose-300">{form.formState.errors.desiredRole?.message}</p>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[0.82rem] font-medium text-(--app-text)">
                    <span>Ciudad</span>
                    {isDominicanRepublicProfile ? (
                      <DominicanCitySelect {...form.register('cityName')} />
                    ) : (
                      <Input placeholder="Santo Domingo" {...form.register('cityName')} />
                    )}
                  </label>
                  <label className="space-y-1.5 text-[0.82rem] font-medium text-(--app-text)">
                    <span>País</span>
                    <CountryCodeSelect {...form.register('countryCode')} />
                    <p className="text-[0.72rem] text-rose-600 dark:text-rose-300">{form.formState.errors.countryCode?.message}</p>
                  </label>
                </div>

                <label className="space-y-1.5 text-[0.82rem] font-medium text-(--app-text)">
                  <span>Resumen profesional</span>
                  <Textarea
                    placeholder="Resume experiencia, fortalezas, logros y el tipo de oportunidad que quieres atraer."
                    {...form.register('summary')}
                  />
                  <p className="text-[0.72rem] text-rose-600 dark:text-rose-300">{form.formState.errors.summary?.message}</p>
                </label>
              </div>
            </Card>
          ) : null}

          {activeTab === 'cv' ? (
            <Card>
              <h2 className="text-[0.95rem] font-semibold tracking-tight text-(--app-text)">CV y visibilidad</h2>
              <p className="text-[0.78rem] text-(--app-text-muted)">
                Sube versiones reutilizables (privadas, límite de {MAX_UPLOAD_SIZE_LABEL}) y controla si apareces en el directorio.
              </p>
              <div className="mt-4 space-y-4">
                <label className="space-y-1.5 text-[0.82rem] font-medium text-(--app-text)">
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
                  <p className="text-[0.72rem] text-(--app-text-subtle)">
                    Acepta PDF, DOC y DOCX. Si pesa más de {MAX_UPLOAD_SIZE_LABEL}, se rechazará con el peso detectado.
                  </p>
                  {resumeFileError ? <p className="text-[0.72rem] text-rose-600 dark:text-rose-300">{resumeFileError}</p> : null}
                </label>

                <div className="space-y-2.5">
                  {resumes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-(--app-border) px-4 py-6 text-[0.8rem] text-(--app-text-muted)">
                      Todavía no has subido CVs. El primero quedará como principal.
                    </div>
                  ) : (
                    resumes.map((resume) => (
                      <div key={resume.id} className="rounded-xl border border-(--app-border) bg-(--app-surface-muted) p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--app-surface) text-(--app-text-subtle)">
                              <FileText className="size-4" />
                            </span>
                            <div>
                              <p className="text-[0.85rem] font-semibold text-(--app-text)">{resume.filename}</p>
                              <p className="mt-0.5 text-[0.72rem] text-(--app-text-muted)">
                                {normalizeCandidateResumeLabel(resume.mime_type)} · {(resume.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          {resume.is_default ? <Badge variant="soft">Principal</Badge> : <Badge variant="outline">Secundario</Badge>}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button variant="outline" className="h-8 px-3 text-[0.78rem]" onClick={() => void openResume(resume.storage_path)}>
                            Abrir
                          </Button>
                          {!resume.is_default ? (
                            <Button
                              variant="outline"
                              className="h-8 px-3 text-[0.78rem]"
                              onClick={() => setDefaultResumeMutation.mutate(resume.id)}
                              disabled={setDefaultResumeMutation.isPending}
                            >
                              Usar como principal
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            className="h-8 px-3 text-[0.78rem]"
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

                <label className="flex items-start gap-3 rounded-xl border border-(--app-border) px-3.5 py-3 text-[0.8rem] text-(--app-text-muted)">
                  <input
                    type="checkbox"
                    className="mt-0.5"
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
                    <span className="mt-1 block text-[0.72rem] text-(--app-text-subtle)">
                      Esto no afecta tu capacidad de aplicar a vacantes si prefieres mantener el perfil oculto.
                    </span>
                  </span>
                </label>
              </div>
            </Card>
          ) : null}

          {activeTab === 'experience' ? (
            <div className="space-y-3">
              <AccordionSection
                icon={Briefcase}
                title="Experiencia"
                description="Organiza tu historial laboral y destaca tu impacto."
                actionLabel="Agregar experiencia"
                onAdd={() => setExperiences((current) => [...current, createEmptyCandidateExperience()])}
                defaultOpen
              >
                {experiences.map((experience) => (
                  <div key={experience.id} className="rounded-xl border border-(--app-border) p-3.5">
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
                        placeholder="Ciudad / país"
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
                    <label className="mt-3 flex items-center gap-2 text-[0.8rem] text-(--app-text-muted)">
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
                        className="h-8 px-3 text-[0.78rem]"
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
              </AccordionSection>

              <AccordionSection
                icon={GraduationCap}
                title="Educación"
                description="Tu formación académica y certificaciones."
                actionLabel="Agregar educación"
                onAdd={() => setEducations((current) => [...current, createEmptyCandidateEducation()])}
              >
                {educations.map((education) => (
                  <div key={education.id} className="rounded-xl border border-(--app-border) p-3.5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="Institucion"
                        value={education.institutionName}
                        onChange={(event) => updateCollectionItem(setEducations, education.id, { institutionName: event.target.value })}
                      />
                      <Input
                        placeholder="Título o grado"
                        value={education.degreeName}
                        onChange={(event) => updateCollectionItem(setEducations, education.id, { degreeName: event.target.value })}
                      />
                      <Input
                        placeholder="Área de estudio"
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
                    <label className="mt-3 flex items-center gap-2 text-[0.8rem] text-(--app-text-muted)">
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
                        className="h-8 px-3 text-[0.78rem]"
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
              </AccordionSection>
            </div>
          ) : null}

          {activeTab === 'skills' ? (
            <div className="space-y-3">
              <AccordionSection
                icon={Sparkles}
                title="Skills"
                description="Habilidades técnicas y blandas que te representan."
                actionLabel="Agregar skill"
                onAdd={() => setSkills((current) => [...current, createEmptyCandidateSkill()])}
                defaultOpen
              >
                {skills.map((skill) => (
                  <div key={skill.id} className="grid gap-3 rounded-xl border border-(--app-border) p-3.5 sm:grid-cols-[1fr_0.8fr_auto]">
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
                      className="h-8 px-3 text-[0.78rem]"
                      onClick={() =>
                        setSkills((current) => (current.length === 1 ? [createEmptyCandidateSkill()] : current.filter((item) => item.id !== skill.id)))
                      }
                    >
                      Eliminar
                    </Button>
                  </div>
                ))}
              </AccordionSection>

              <AccordionSection
                icon={LanguagesIcon}
                title="Idiomas"
                description="Idiomas que hablas y tu nivel."
                actionLabel="Agregar idioma"
                onAdd={() => setLanguages((current) => [...current, createEmptyCandidateLanguage()])}
              >
                {languages.map((language) => (
                  <div key={language.id} className="grid gap-3 rounded-xl border border-(--app-border) p-3.5 sm:grid-cols-[1fr_0.8fr_auto]">
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
                      className="h-8 px-3 text-[0.78rem]"
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
              </AccordionSection>

              <AccordionSection
                icon={Link2}
                title="Links"
                description="Enlaces importantes como portafolio o GitHub."
                actionLabel="Agregar link"
                onAdd={() => setLinks((current) => [...current, createEmptyCandidateLink()])}
              >
                {links.map((link) => (
                  <div key={link.id} className="space-y-3 rounded-xl border border-(--app-border) p-3.5">
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
                        className="h-8 px-3 text-[0.78rem]"
                        onClick={() =>
                          setLinks((current) => (current.length === 1 ? [createEmptyCandidateLink()] : current.filter((item) => item.id !== link.id)))
                        }
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </AccordionSection>
            </div>
          ) : null}
        </motion.div>

        {/* Sidebar */}
        <motion.aside variants={cardReveal} className="space-y-4">
          <Card>
            <h2 className="text-[0.95rem] font-semibold tracking-tight text-(--app-text)">Resumen de tu perfil</h2>
            <div className="mt-3 flex items-center gap-3">
              <CircularProgress value={completionPercent} />
              <div>
                <p className="text-[0.85rem] font-semibold text-(--app-text)">Completado del perfil</p>
                <p className="text-[0.76rem] text-(--app-text-muted)">
                  {completionPercent >= 100 ? '¡Tu perfil está listo!' : '¡Vas muy bien! Completa la información para destacar más.'}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2.5 border-t border-(--app-border) pt-3 text-[0.78rem]">
              <div>
                <p className="font-medium text-(--app-text)">Última actualización</p>
                <p className="text-(--app-text-muted)">{formatUpdatedAt(bundle.profile?.updated_at)}</p>
              </div>
              <div>
                <p className="font-medium text-(--app-text)">{isVisibleToRecruiters ? 'Visible' : 'Oculto'}</p>
                <p className="text-(--app-text-muted)">
                  {isVisibleToRecruiters ? 'Apareces para empresas en el directorio.' : 'No apareces en el directorio.'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-[0.95rem] font-semibold tracking-tight text-(--app-text)">Acciones rápidas</h2>
            <div className="mt-3 space-y-2">
              <QuickAction icon={Upload} title="Subir nuevo CV" description="Actualiza tu CV privado actual." onClick={() => setActiveTab('cv')} />
              <QuickAction icon={Eye} title="Vista previa del perfil" description="Mira cómo te ven las empresas." onClick={() => toast.info('Vista previa próximamente')} />
              <QuickAction icon={Download} title="Descargar mis datos" description="Obtén una copia de tu información." onClick={() => toast.info('Exportación de datos próximamente')} />
            </div>
          </Card>

          <Card className="border-primary-200/70 bg-primary-50/60 dark:border-primary-500/25 dark:bg-primary-500/10">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300">
                <Lightbulb className="size-4" />
              </span>
              <div>
                <h3 className="text-[0.85rem] font-semibold text-(--app-text)">Consejo</h3>
                <p className="mt-0.5 text-[0.76rem] text-(--app-text-muted)">
                  Perfiles completos reciben hasta 3x más vistas de reclutadores.
                </p>
              </div>
            </div>
          </Card>
        </motion.aside>
      </div>

      {/* Footer acciones */}
      <motion.div variants={cardReveal} className="flex items-center justify-between gap-3 border-t border-(--app-border) pt-4">
        <button
          type="button"
          onClick={() => void navigate(surfacePaths.candidate.home)}
          className="text-[0.82rem] font-medium text-(--app-text-muted) transition-colors hover:text-(--app-text)"
        >
          Cancelar
        </button>
        <Button className="h-10 px-5 text-[0.85rem]" disabled={saveMutation.isPending} onClick={() => void saveAll()}>
          {saveMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </motion.div>
    </motion.div>
  )
}

export function CandidateProfilePage() {
  const session = useAppSession()
  const hasCompletedOnboarding = hasCompletedBaseOnboarding(session.profile)
  const profileQuery = useQuery({
    queryKey: CANDIDATE_PROFILE_QUERY_KEY,
    queryFn: async () => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesión activa para editar tu perfil candidato.')
      }

      return fetchMyCandidateProfile(session.authUser.id)
    },
    enabled: session.authUser !== null && hasCompletedOnboarding
  })

  if (!session.authUser) {
    return null
  }

  if (!hasCompletedOnboarding) {
    return <ProfileOnboardingFlow />
  }

  if (profileQuery.isLoading) {
    return <PageLoader label="Cargando tu perfil" hint="Recuperando tu información profesional" />
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
