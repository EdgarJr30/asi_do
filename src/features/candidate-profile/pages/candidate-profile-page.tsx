import { type Dispatch, type ReactNode, type SetStateAction, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Languages as LanguagesIcon,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
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
import { smoothCardReveal as cardReveal, smoothPageStagger as pageStagger } from '@/shared/ui/card-motion'
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

const profileFieldClass = 'h-[46px] rounded-[10px] bg-(--app-surface) text-[0.9rem]'
const profileTextareaClass = 'min-h-28 rounded-[10px] bg-(--app-surface) text-[0.9rem] leading-6'

function CircularProgress({ value }: { value: number }) {
  const radius = 25
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference
  return (
    <div className="relative size-[58px] shrink-0">
      <svg className="size-[58px] -rotate-90" viewBox="0 0 58 58" aria-hidden>
        <circle cx="29" cy="29" r={radius} fill="none" strokeWidth="6" className="stroke-(--app-surface-muted)" />
        <circle
          cx="29"
          cy="29"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-primary-600 transition-[stroke-dashoffset] duration-700"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[0.8rem] font-bold text-primary-700 dark:text-primary-200">{clamped}%</span>
    </div>
  )
}

function ProfileStatTile({ icon: Icon, value, label, className }: { icon: LucideIcon; value: ReactNode; label: string; className?: string }) {
  return (
    <div className={cn('flex min-w-[140px] flex-1 items-center gap-3 rounded-xl border border-(--app-border) bg-(--app-surface) px-4 py-3', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
        <Icon className="size-4" />
      </span>
      <div className="leading-tight">
        <p className="text-lg font-bold leading-none text-(--app-text)">{value}</p>
        <p className="mt-1 text-[0.78rem] text-(--app-text-subtle)">{label}</p>
      </div>
    </div>
  )
}

function ProfileSection({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  children
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  children: ReactNode
}) {
  return (
    <Card className="rounded-[14px] p-6 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold tracking-tight text-(--app-text)">{title}</h2>
          <p className="mt-1 text-[0.82rem] leading-5 text-(--app-text-muted)">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[9px] border border-(--app-border) bg-(--app-surface) px-3.5 text-[0.8rem] font-semibold text-primary-600 transition-colors hover:border-primary-200 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/12"
          >
            <Plus className="size-3.5" />
            {actionLabel}
          </button>
        ) : null}
      </div>
      {children}
    </Card>
  )
}

function ProfileField({
  label,
  error,
  className,
  children
}: {
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('block space-y-2 text-[0.8rem] font-semibold text-(--app-text-muted)', className)}>
      <span>{label}</span>
      {children}
      {error ? <p className="text-[0.72rem] font-medium text-rose-600 dark:text-rose-300">{error}</p> : null}
    </label>
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
    <Card className="overflow-hidden rounded-[14px] p-0 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
      <div className="flex items-center gap-3 px-6 py-[18px]">
        <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
          <Icon className="size-[18px]" />
        </span>
        <button type="button" onClick={() => setOpen((value) => !value)} className="min-w-0 flex-1 text-left">
          <h3 className="text-base font-bold tracking-tight text-(--app-text)">{title}</h3>
          <p className="mt-1 truncate text-[0.82rem] text-(--app-text-muted)">{description}</p>
        </button>
        <button
          type="button"
          onClick={() => {
            onAdd()
            setOpen(true)
          }}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[9px] border border-(--app-border) bg-(--app-surface) px-3.5 text-[0.8rem] font-semibold text-primary-600 transition-colors hover:border-primary-200 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/12"
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
      {open ? <div className="space-y-4 px-6 pb-6">{children}</div> : null}
    </Card>
  )
}

function QuickAction({ icon: Icon, title, description, onClick }: { icon: LucideIcon; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[11px] px-3.5 py-3 text-left transition-colors hover:bg-(--app-surface-muted)"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-(--app-border) bg-(--app-surface-muted) text-(--app-text-muted)">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.84rem] font-semibold text-(--app-text)">{title}</span>
        <span className="mt-0.5 block text-[0.75rem] text-(--app-text-subtle)">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-(--app-text-subtle)" />
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
  const shouldReduceMotion = useReducedMotion()
  const [activeTab, setActiveTab] = useState<ProfileTab>('general')
  const [experiences, setExperiences] = useState<CandidateExperienceDraft[]>(() => toExperienceDrafts(bundle))
  const [educations, setEducations] = useState<CandidateEducationDraft[]>(() => toEducationDrafts(bundle))
  const [skills, setSkills] = useState<CandidateSkillDraft[]>(() => toSkillDrafts(bundle))
  const [languages, setLanguages] = useState<CandidateLanguageDraft[]>(() => toLanguageDrafts(bundle))
  const [links, setLinks] = useState<CandidateLinkDraft[]>(() => toLinkDrafts(bundle))
  const [resumeFileError, setResumeFileError] = useState<string | null>(null)
  const [isResumeDragging, setIsResumeDragging] = useState(false)
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

  function handleResumeFile(file: File | null | undefined) {
    if (file) {
      setResumeFileError(null)
      uploadResumeMutation.mutate(file)
    }
  }

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
  const handleTabSelect = (tab: ProfileTab) => {
    setActiveTab(tab)
    window.requestAnimationFrame(() => {
      document.getElementById('candidate-profile-tabs')?.scrollIntoView({ block: 'start' })
    })
  }

  return (
    <motion.div
      className="space-y-5"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.header variants={cardReveal} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="max-w-2xl text-2xl font-bold leading-tight tracking-tight text-(--app-text)">
            Mantén un perfil profesional listo para aplicar
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-(--app-text-muted)">
            Tu historial, CV y visibilidad viven aquí para que postularte o compartir tu perfil requiera menos esfuerzo.
          </p>
        </div>
        <Button
          className="h-[42px] w-full shrink-0 rounded-[10px] px-5 text-sm sm:w-auto"
          disabled={saveMutation.isPending}
          onClick={() => void saveAll()}
        >
          <Check className="size-4" />
          {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </motion.header>

      <motion.div variants={cardReveal} className="flex flex-wrap gap-2.5">
        <ProfileStatTile icon={FileText} value={resumes.length} label="CV" />
        <ProfileStatTile icon={Sparkles} value={skillCount} label="Skills" />
        <ProfileStatTile icon={LanguagesIcon} value={languageCount} label="Idiomas" />
        <ProfileStatTile icon={Briefcase} value={experienceCount} label="Experiencia" />
        <div className="flex min-w-[230px] flex-1 items-center justify-between gap-4 rounded-xl border border-(--app-border) bg-(--app-surface) px-4 py-3">
          <div className="min-w-0">
            <p className="text-[0.84rem] font-semibold text-(--app-text)">Visible para empresas</p>
            <p className="mt-0.5 text-xs text-(--app-text-subtle)">
              {isVisibleToRecruiters ? 'Apareces en el directorio.' : 'Oculto del directorio.'}
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
              'relative h-[26px] w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) disabled:opacity-60',
              isVisibleToRecruiters ? 'bg-primary-600' : 'bg-secondary-200 dark:bg-secondary-500'
            )}
          >
            <span
              className={cn(
                'absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform',
                isVisibleToRecruiters ? 'left-[3px] translate-x-[18px]' : 'left-[3px] translate-x-0'
              )}
            />
          </button>
        </div>
      </motion.div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <motion.div variants={cardReveal} className="min-w-0 space-y-[18px]">
          <div
            id="candidate-profile-tabs"
            className="flex gap-1 overflow-x-auto rounded-[11px] border border-(--app-border) bg-(--app-surface) p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {PROFILE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabSelect(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={cn(
                  'inline-flex h-[38px] shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-[0.84rem] font-semibold transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white'
                    : 'text-(--app-text-muted) hover:bg-(--app-surface-muted) hover:text-(--app-text)'
                )}
              >
                {tab.id === 'general' ? <span className="size-4 rounded-full border border-current" /> : null}
                {tab.id === 'cv' ? <FileText className="size-4" /> : null}
                {tab.id === 'experience' ? <Briefcase className="size-4" /> : null}
                {tab.id === 'skills' ? <Sparkles className="size-4" /> : null}
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'general' ? (
            <ProfileSection
              icon={Sparkles}
              title="Perfil general"
              description="Resumen reutilizable para futuras aplicaciones y nuevas oportunidades."
            >
              <div className="space-y-4">
                <ProfileField label="Titular profesional" error={form.formState.errors.headline?.message}>
                  <Input className={profileFieldClass} placeholder="Ej. Coordinador de proyectos" {...form.register('headline')} />
                </ProfileField>

                <ProfileField label="Rol objetivo" error={form.formState.errors.desiredRole?.message}>
                  <Input className={profileFieldClass} placeholder="Ej. Talent Acquisition Lead" {...form.register('desiredRole')} />
                </ProfileField>

                <div className="grid gap-4 md:grid-cols-2">
                  <ProfileField label="Ciudad">
                    {isDominicanRepublicProfile ? (
                      <DominicanCitySelect className={profileFieldClass} {...form.register('cityName')} />
                    ) : (
                      <Input className={profileFieldClass} placeholder="Santo Domingo" {...form.register('cityName')} />
                    )}
                  </ProfileField>
                  <ProfileField label="País" error={form.formState.errors.countryCode?.message}>
                    <CountryCodeSelect className={profileFieldClass} {...form.register('countryCode')} />
                  </ProfileField>
                </div>

                <ProfileField label="Resumen profesional" error={form.formState.errors.summary?.message}>
                  <Textarea
                    className={profileTextareaClass}
                    placeholder="Resume experiencia, fortalezas, logros y el tipo de oportunidad que quieres atraer."
                    {...form.register('summary')}
                  />
                </ProfileField>
              </div>
            </ProfileSection>
          ) : null}

          {activeTab === 'cv' ? (
            <ProfileSection
              icon={FileText}
              title="CV y visibilidad"
              description={`Sube versiones reutilizables privadas y controla si apareces en el directorio. Tamaño máximo ${MAX_UPLOAD_SIZE_LABEL}.`}
            >
              <div className="space-y-4">
                <label
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (!isResumeDragging) setIsResumeDragging(true)
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault()
                    setIsResumeDragging(false)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    setIsResumeDragging(false)
                    handleResumeFile(event.dataTransfer.files?.[0])
                  }}
                  className={cn(
                    'group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed px-5 py-8 text-center transition-colors',
                    isResumeDragging
                      ? 'border-primary-400 bg-primary-50/80 dark:bg-primary-500/10'
                      : 'border-secondary-200 bg-(--app-surface-muted)/40 hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-500/10',
                    uploadResumeMutation.isPending && 'pointer-events-none opacity-70'
                  )}
                >
                  <input
                    className="sr-only"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    type="file"
                    disabled={uploadResumeMutation.isPending}
                    onChange={(event) => {
                      handleResumeFile(event.target.files?.[0])
                      event.currentTarget.value = ''
                    }}
                  />
                  <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-transform group-hover:scale-105 dark:bg-primary-500/15 dark:text-primary-300">
                    <Upload className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-(--app-text)">
                    {uploadResumeMutation.isPending ? 'Subiendo tu CV...' : 'Arrastra tu CV aquí o haz clic para subir'}
                  </span>
                  <span className="mt-1 text-[0.78rem] text-(--app-text-subtle)">PDF, DOC o DOCX · Tamaño máximo {MAX_UPLOAD_SIZE_LABEL}</span>
                </label>
                {resumeFileError ? <p className="text-[0.72rem] font-medium text-rose-600 dark:text-rose-300">{resumeFileError}</p> : null}

                <div className="space-y-3">
                  {resumes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-(--app-border) px-4 py-6 text-sm text-(--app-text-muted)">
                      Todavía no has subido CVs. El primero quedará como principal.
                    </div>
                  ) : (
                    resumes.map((resume) => (
                      <div key={resume.id} className="flex flex-col gap-3 rounded-xl border border-(--app-border) p-3.5 sm:flex-row sm:items-center">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-(--app-success-surface) text-emerald-600 dark:text-emerald-300">
                          <FileText className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-(--app-text)">{resume.filename}</p>
                          <p className="mt-0.5 text-[0.78rem] text-(--app-text-subtle)">
                            {normalizeCandidateResumeLabel(resume.mime_type)} · {(resume.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        {resume.is_default ? <Badge variant="soft">Principal</Badge> : <Badge variant="outline">Secundario</Badge>}
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Button variant="outline" className="h-8 rounded-lg px-3 text-[0.78rem]" onClick={() => void openResume(resume.storage_path)}>
                            Abrir
                          </Button>
                          {!resume.is_default ? (
                            <Button
                              variant="outline"
                              className="h-8 rounded-lg px-3 text-[0.78rem]"
                              onClick={() => setDefaultResumeMutation.mutate(resume.id)}
                              disabled={setDefaultResumeMutation.isPending}
                            >
                              Principal
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            className="h-8 rounded-lg px-3 text-[0.78rem]"
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

                <label className="flex items-start gap-3 rounded-xl bg-(--app-surface-muted) px-4 py-3 text-[0.82rem] text-(--app-text)">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary-600"
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
                    <span className="mt-1 block text-xs text-(--app-text-subtle)">
                      Esto no afecta tu capacidad de aplicar a vacantes si prefieres mantener el perfil oculto.
                    </span>
                  </span>
                </label>
              </div>
            </ProfileSection>
          ) : null}

          {activeTab === 'experience' ? (
            <div className="space-y-4">
              <ProfileSection
                icon={Briefcase}
                title="Experiencia"
                description="Organiza tu historial laboral y destaca tu impacto."
                actionLabel="Agregar"
                onAction={() => setExperiences((current) => [...current, createEmptyCandidateExperience()])}
              >
                {experiences.map((experience) => (
                  <div key={experience.id} className="rounded-xl border border-(--app-border) p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <ProfileField label="Empresa">
                        <Input
                          className={profileFieldClass}
                          placeholder="Empresa"
                          value={experience.companyName}
                          onChange={(event) => updateCollectionItem(setExperiences, experience.id, { companyName: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField label="Rol">
                        <Input
                          className={profileFieldClass}
                          placeholder="Rol"
                          value={experience.roleTitle}
                          onChange={(event) => updateCollectionItem(setExperiences, experience.id, { roleTitle: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField label="Tipo de empleo">
                        <Input
                          className={profileFieldClass}
                          placeholder="Tiempo completo"
                          value={experience.employmentType}
                          onChange={(event) => updateCollectionItem(setExperiences, experience.id, { employmentType: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField label="Ubicación">
                        <Input
                          className={profileFieldClass}
                          placeholder="Ciudad / país"
                          value={experience.cityName}
                          onChange={(event) => updateCollectionItem(setExperiences, experience.id, { cityName: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField label="Inicio">
                        <Input
                          className={profileFieldClass}
                          type="date"
                          value={experience.startDate}
                          onChange={(event) => updateCollectionItem(setExperiences, experience.id, { startDate: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField label="Fin">
                        <Input
                          className={profileFieldClass}
                          type="date"
                          disabled={experience.isCurrent}
                          value={experience.endDate}
                          onChange={(event) => updateCollectionItem(setExperiences, experience.id, { endDate: event.target.value })}
                        />
                      </ProfileField>
                    </div>
                    <ProfileField label="Impacto" className="mt-4">
                      <Textarea
                        className={profileTextareaClass}
                        placeholder="Impacto, responsabilidades y resultados."
                        value={experience.summary}
                        onChange={(event) => updateCollectionItem(setExperiences, experience.id, { summary: event.target.value })}
                      />
                    </ProfileField>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-[0.82rem] text-(--app-text)">
                        <input
                          className="size-4 accent-primary-600"
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
                      <span className="flex-1" />
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-[0.82rem] font-semibold text-(--app-text-subtle) transition-colors hover:text-rose-600"
                        onClick={() =>
                          setExperiences((current) =>
                            current.length === 1 ? [createEmptyCandidateExperience()] : current.filter((item) => item.id !== experience.id)
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </ProfileSection>

              <ProfileSection
                icon={GraduationCap}
                title="Educación"
                description="Tu formación académica y certificaciones."
                actionLabel="Agregar"
                onAction={() => setEducations((current) => [...current, createEmptyCandidateEducation()])}
              >
                {educations.map((education) => (
                  <div key={education.id} className="rounded-xl border border-(--app-border) p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <ProfileField label="Institución">
                        <Input
                          className={profileFieldClass}
                          placeholder="Institución"
                          value={education.institutionName}
                          onChange={(event) => updateCollectionItem(setEducations, education.id, { institutionName: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField label="Título/certificación">
                        <Input
                          className={profileFieldClass}
                          placeholder="Título o grado"
                          value={education.degreeName}
                          onChange={(event) => updateCollectionItem(setEducations, education.id, { degreeName: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField label="Área de estudio">
                        <Input
                          className={profileFieldClass}
                          placeholder="Área de estudio"
                          value={education.fieldOfStudy}
                          onChange={(event) => updateCollectionItem(setEducations, education.id, { fieldOfStudy: event.target.value })}
                        />
                      </ProfileField>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <ProfileField label="Inicio">
                          <Input
                            className={profileFieldClass}
                            type="date"
                            value={education.startDate}
                            onChange={(event) => updateCollectionItem(setEducations, education.id, { startDate: event.target.value })}
                          />
                        </ProfileField>
                        <ProfileField label="Fin">
                          <Input
                            className={profileFieldClass}
                            type="date"
                            disabled={education.isCurrent}
                            value={education.endDate}
                            onChange={(event) => updateCollectionItem(setEducations, education.id, { endDate: event.target.value })}
                          />
                        </ProfileField>
                      </div>
                    </div>
                    <ProfileField label="Notas" className="mt-4">
                      <Textarea
                        className={profileTextareaClass}
                        placeholder="Logros, enfoque o certificaciones."
                        value={education.summary}
                        onChange={(event) => updateCollectionItem(setEducations, education.id, { summary: event.target.value })}
                      />
                    </ProfileField>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-[0.82rem] text-(--app-text)">
                        <input
                          className="size-4 accent-primary-600"
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
                      <span className="flex-1" />
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-[0.82rem] font-semibold text-(--app-text-subtle) transition-colors hover:text-rose-600"
                        onClick={() =>
                          setEducations((current) =>
                            current.length === 1 ? [createEmptyCandidateEducation()] : current.filter((item) => item.id !== education.id)
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </ProfileSection>
            </div>
          ) : null}

          {activeTab === 'skills' ? (
            <div className="space-y-4">
              <AccordionSection
                icon={Sparkles}
                title="Skills"
                description="Habilidades técnicas y blandas que te representan."
                actionLabel="Agregar skill"
                onAdd={() => setSkills((current) => [...current, createEmptyCandidateSkill()])}
                defaultOpen
              >
                {skills.map((skill) => (
                  <div key={skill.id} className="grid gap-4 rounded-xl border border-(--app-border) p-4 md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)_auto]">
                    <ProfileField label="Skill">
                      <Input
                        className={profileFieldClass}
                        placeholder="Skill"
                        value={skill.skillName}
                        onChange={(event) => updateCollectionItem(setSkills, skill.id, { skillName: event.target.value })}
                      />
                    </ProfileField>
                    <ProfileField label="Nivel">
                      <Input
                        className={profileFieldClass}
                        placeholder="Nivel"
                        value={skill.proficiencyLabel}
                        onChange={(event) => updateCollectionItem(setSkills, skill.id, { proficiencyLabel: event.target.value })}
                      />
                    </ProfileField>
                    <button
                      type="button"
                      className="inline-flex h-[46px] items-center justify-center gap-2 self-end rounded-lg px-3 text-[0.82rem] font-semibold text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-rose-600"
                      onClick={() =>
                        setSkills((current) => (current.length === 1 ? [createEmptyCandidateSkill()] : current.filter((item) => item.id !== skill.id)))
                      }
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </button>
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
                  <div key={language.id} className="grid gap-4 rounded-xl border border-(--app-border) p-4 md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)_auto]">
                    <ProfileField label="Idioma">
                      <Input
                        className={profileFieldClass}
                        placeholder="Idioma"
                        value={language.languageName}
                        onChange={(event) => updateCollectionItem(setLanguages, language.id, { languageName: event.target.value })}
                      />
                    </ProfileField>
                    <ProfileField label="Nivel">
                      <Input
                        className={profileFieldClass}
                        placeholder="Nivel"
                        value={language.proficiencyLabel}
                        onChange={(event) => updateCollectionItem(setLanguages, language.id, { proficiencyLabel: event.target.value })}
                      />
                    </ProfileField>
                    <button
                      type="button"
                      className="inline-flex h-[46px] items-center justify-center gap-2 self-end rounded-lg px-3 text-[0.82rem] font-semibold text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-rose-600"
                      onClick={() =>
                        setLanguages((current) =>
                          current.length === 1 ? [createEmptyCandidateLanguage()] : current.filter((item) => item.id !== language.id)
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </button>
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
                  <div key={link.id} className="space-y-4 rounded-xl border border-(--app-border) p-4">
                    <div className="grid gap-4 md:grid-cols-[0.7fr_1fr]">
                      <ProfileField label="Tipo">
                        <Select
                          className={profileFieldClass}
                          value={link.linkType}
                          onChange={(event) => updateCollectionItem(setLinks, link.id, { linkType: event.target.value as CandidateLinkDraft['linkType'] })}
                        >
                          <option value="other">Otro</option>
                          <option value="portfolio">Portafolio</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="github">GitHub</option>
                          <option value="website">Website</option>
                        </Select>
                      </ProfileField>
                      <ProfileField label="Etiqueta">
                        <Input
                          className={profileFieldClass}
                          placeholder="Etiqueta"
                          value={link.label}
                          onChange={(event) => updateCollectionItem(setLinks, link.id, { label: event.target.value })}
                        />
                      </ProfileField>
                    </div>
                    <ProfileField label="URL">
                      <Input
                        className={profileFieldClass}
                        placeholder="https://..."
                        value={link.url}
                        onChange={(event) => updateCollectionItem(setLinks, link.id, { url: event.target.value })}
                      />
                    </ProfileField>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[0.82rem] font-semibold text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-rose-600"
                        onClick={() =>
                          setLinks((current) => (current.length === 1 ? [createEmptyCandidateLink()] : current.filter((item) => item.id !== link.id)))
                        }
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </AccordionSection>
            </div>
          ) : null}
        </motion.div>

        <motion.aside variants={cardReveal} className="flex h-full flex-col gap-4">
          <Card className="rounded-[14px] p-5 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
            <h2 className="text-[0.95rem] font-bold tracking-tight text-(--app-text)">Resumen de tu perfil</h2>
            <div className="mt-4 flex items-center gap-4">
              <CircularProgress value={completionPercent} />
              <div>
                <p className="text-sm font-semibold text-(--app-text)">Completado del perfil</p>
                <p className="mt-0.5 text-[0.78rem] text-(--app-text-subtle)">
                  {completionPercent >= 100 ? '¡Tu perfil está listo!' : '¡Vas muy bien! Completa la información para destacar más.'}
                </p>
              </div>
            </div>
            <div className="mt-4 divide-y divide-(--app-border)">
              <div className="py-3">
                <p className="text-xs text-(--app-text-subtle)">Última actualización</p>
                <p className="mt-1 text-[0.84rem] font-semibold text-(--app-text)">{formatUpdatedAt(bundle.profile?.updated_at)}</p>
              </div>
              <div className="py-3">
                <p className="text-xs text-(--app-text-subtle)">Visibilidad</p>
                <p className={cn('mt-1 text-[0.84rem] font-semibold', isVisibleToRecruiters ? 'text-emerald-600 dark:text-emerald-300' : 'text-(--app-text)')}>
                  {isVisibleToRecruiters ? 'Visible en el directorio' : 'Oculto del directorio'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[14px] p-5 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
            <h2 className="text-[0.95rem] font-bold tracking-tight text-(--app-text)">Acciones rápidas</h2>
            <div className="mt-4 divide-y divide-(--app-border)">
              <QuickAction icon={Upload} title="Subir nuevo CV" description="Actualiza tu CV privado actual." onClick={() => handleTabSelect('cv')} />
              <QuickAction icon={Eye} title="Vista previa del perfil" description="Mira cómo te ven las empresas." onClick={() => toast.info('Vista previa próximamente')} />
              <QuickAction icon={Download} title="Descargar mis datos" description="Obtén una copia de tu información." onClick={() => toast.info('Exportación de datos próximamente')} />
            </div>
          </Card>

        </motion.aside>
      </div>
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
