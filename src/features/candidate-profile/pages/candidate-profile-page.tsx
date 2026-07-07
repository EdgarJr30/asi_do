import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FieldHelp } from '@/components/ui/field-help'
import { PageLoader } from '@/components/ui/loader'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { isDominicanRepublicCountryCode } from '@/shared/geo/location-options'
import {
  reducedTabPanelReveal,
  smoothCardReveal as cardReveal,
  smoothPageStagger as pageStagger,
  tabPanelReveal
} from '@/shared/ui/card-motion'
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
  formatFileSize,
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

function getCandidateResumeFileLabel(file: File) {
  return normalizeCandidateResumeLabel(file.type) || file.name.split('.').pop()?.trim().toUpperCase() || 'Archivo'
}

function canPreviewCandidateResume(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
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
type CandidateResume = CandidateProfileBundle['resumes'][number]
type PendingResumeUpload = {
  file: File
  previewUrl: string
}
type PendingProfileDelete =
  | { kind: 'resume'; resume: CandidateResume }
  | { kind: 'experience'; id: string; label: string }
  | { kind: 'education'; id: string; label: string }
  | { kind: 'skill'; id: string; label: string }
  | { kind: 'language'; id: string; label: string }
  | { kind: 'link'; id: string; label: string }

const PROFILE_TABS: Array<{ id: ProfileTab; label: string; shortLabel: string }> = [
  { id: 'general', label: 'Perfil general', shortLabel: 'General' },
  { id: 'cv', label: 'CV y visibilidad', shortLabel: 'CV' },
  { id: 'experience', label: 'Experiencia y educación', shortLabel: 'Experiencia' },
  { id: 'skills', label: 'Skills, idiomas y links', shortLabel: 'Skills' }
]

const MAX_RESUME_COUNT = 5

const profileFieldClass = 'h-[42px] rounded-control bg-(--app-surface) text-[0.9rem] sm:h-[46px]'
const profileTextareaClass = 'min-h-24 rounded-control bg-(--app-surface) text-[0.9rem] leading-6 sm:min-h-28'

function textOrFallback(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim()

  return normalized ? normalized : fallback
}

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
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-control border border-(--app-border) bg-(--app-surface-elevated) px-1.5 py-2 text-center sm:min-h-14 sm:py-3',
        className
      )}
    >
      <span className="flex items-center gap-1">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-600 sm:size-6 dark:bg-primary-500/12 dark:text-primary-300">
          <Icon className="size-3 sm:size-3.5" />
        </span>
        <span className="font-sans text-base font-bold leading-none tabular-nums text-(--app-text) sm:text-xl">{value}</span>
      </span>
      <span className="text-[0.64rem] leading-tight text-(--app-text-subtle) sm:text-[0.7rem]">{label}</span>
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
    <Card className="rounded-control p-4 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)] sm:p-6">
      <div className="mb-4 flex items-start gap-2.5 sm:mb-5 sm:gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-600 sm:size-[38px] dark:bg-primary-500/12 dark:text-primary-300">
          <Icon className="size-4 sm:size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9rem] font-bold tracking-tight text-(--app-text) sm:text-base">{title}</h2>
          <p className="mt-0.5 text-[0.76rem] leading-5 text-(--app-text-muted) sm:mt-1 sm:text-[0.82rem]">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-control border border-(--app-border) bg-(--app-surface) px-3.5 text-[0.8rem] font-semibold text-primary-600 transition-colors hover:border-primary-200 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/12"
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
  help,
  error,
  className,
  children
}: {
  label: string
  help?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('block space-y-1.5 text-[0.78rem] font-semibold text-(--app-text-muted) sm:space-y-2 sm:text-[0.8rem]', className)}>
      <span className="inline-flex items-center gap-1.5">
        <span>{label}</span>
        {help ? <FieldHelp fieldLabel={label} help={help} /> : null}
      </span>
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
    <Card className="overflow-hidden rounded-control p-0 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
      <div className="flex items-center gap-2.5 px-4 py-3.5 sm:gap-3 sm:px-6 sm:py-[18px]">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-600 sm:size-[38px] dark:bg-primary-500/12 dark:text-primary-300">
          <Icon className="size-4 sm:size-[18px]" />
        </span>
        <button type="button" onClick={() => setOpen((value) => !value)} className="min-w-0 flex-1 text-left">
          <h3 className="text-[0.9rem] font-bold tracking-tight text-(--app-text) sm:text-base">{title}</h3>
          <p className="mt-0.5 truncate text-[0.76rem] text-(--app-text-muted) sm:mt-1 sm:text-[0.82rem]">{description}</p>
        </button>
        <button
          type="button"
          onClick={() => {
            onAdd()
            setOpen(true)
          }}
          aria-label={actionLabel}
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-control border border-(--app-border) bg-(--app-surface) px-2.5 text-[0.8rem] font-semibold text-primary-600 transition-colors hover:border-primary-200 hover:bg-primary-50 sm:h-9 sm:px-3.5 dark:text-primary-300 dark:hover:bg-primary-500/12"
        >
          <Plus className="size-3.5" /> <span className="hidden sm:inline">{actionLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Contraer' : 'Expandir'}
          className="flex size-8 shrink-0 items-center justify-center rounded-control text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted)"
        >
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open ? <div className="space-y-3 px-4 pb-4 sm:space-y-4 sm:px-6 sm:pb-6">{children}</div> : null}
    </Card>
  )
}

function CollapsibleItem({
  title,
  subtitle,
  defaultOpen = false,
  children
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-control border border-(--app-border)">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-(--app-surface-muted) sm:px-4 sm:py-3"
      >
        <ChevronDown className={cn('size-4 shrink-0 text-(--app-text-subtle) transition-transform', open && 'rotate-180')} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.84rem] font-semibold text-(--app-text)">{title}</span>
          {subtitle ? <span className="mt-0.5 block truncate text-[0.72rem] text-(--app-text-subtle)">{subtitle}</span> : null}
        </span>
      </button>
      {open ? <div className="border-t border-(--app-border) p-3 sm:p-4">{children}</div> : null}
    </div>
  )
}

function QuickAction({ icon: Icon, title, description, onClick }: { icon: LucideIcon; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2.5 text-left transition-colors hover:bg-(--app-surface-muted) sm:gap-3 sm:px-3.5 sm:py-3"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-control border border-(--app-border) bg-(--app-surface-muted) text-(--app-text-muted) sm:size-9">
        <Icon className="size-[15px] sm:size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.82rem] font-semibold text-(--app-text) sm:text-[0.84rem]">{title}</span>
        <span className="mt-0.5 block text-[0.72rem] text-(--app-text-subtle) sm:text-[0.75rem]">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-(--app-text-subtle)" />
    </button>
  )
}

function ResumeUploadPreviewDialog({
  pendingUpload,
  loading,
  onConfirm,
  onCancel
}: {
  pendingUpload: PendingResumeUpload | null
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!pendingUpload) return null

  const { file, previewUrl } = pendingUpload
  const canPreview = canPreviewCandidateResume(file)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button
        aria-label="Cancelar carga de CV"
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />
      <Card className="relative z-10 flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-card p-0">
        <CardHeader className="border-b border-(--app-border) px-4 py-4 sm:px-5">
          <CardTitle>Revisar CV antes de guardar</CardTitle>
          <CardDescription>Confirma que este es el archivo correcto antes de subirlo a tu perfil candidato.</CardDescription>
        </CardHeader>
        <CardContent className="mt-0 min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 rounded-control border border-(--app-border) bg-(--app-surface-muted)/55 p-3.5 sm:flex-row sm:items-center">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-(--app-text)">{file.name}</p>
              <p className="mt-0.5 text-[0.78rem] text-(--app-text-subtle)">
                {getCandidateResumeFileLabel(file)} · {formatFileSize(file.size)}
              </p>
            </div>
            <a
              className="inline-flex h-9 items-center justify-center gap-2 rounded-control border border-(--app-border) bg-(--app-surface) px-3 text-[0.78rem] font-semibold text-(--app-text) shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:border-primary-400 dark:hover:bg-primary-500/12 dark:hover:text-primary-200"
              href={previewUrl}
              rel="noreferrer"
              target="_blank"
            >
              <Download className="size-3.5" />
              Abrir
            </a>
          </div>

          {canPreview ? (
            <div className="overflow-hidden rounded-control border border-(--app-border) bg-white">
              <iframe className="h-[58svh] min-h-[360px] w-full" src={previewUrl} title={`Previsualización de ${file.name}`} />
            </div>
          ) : (
            <div className="rounded-control border border-dashed border-(--app-border) px-4 py-8 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-control bg-(--app-surface-muted) text-(--app-text-subtle)">
                <FileText className="size-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-(--app-text)">Vista previa no disponible para este formato</p>
              <p className="mx-auto mt-1 max-w-md text-[0.8rem] leading-5 text-(--app-text-muted)">
                El archivo aún no se ha subido. Verifica el nombre, tipo y tamaño; si necesitas revisar el contenido, abre el archivo seleccionado.
              </p>
            </div>
          )}
        </CardContent>
        <div className="flex flex-col-reverse gap-2 border-t border-(--app-border) px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? 'Subiendo CV...' : 'Guardar y subir CV'}
          </Button>
        </div>
      </Card>
    </div>
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
  const [pendingResumeUpload, setPendingResumeUpload] = useState<PendingResumeUpload | null>(null)
  const [isVisibleToRecruiters, setIsVisibleToRecruiters] = useState(() => bundle.profile?.is_visible_to_recruiters ?? false)
  const [pendingDelete, setPendingDelete] = useState<PendingProfileDelete | null>(null)

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
    onSuccess: () => {
      toast.success('Perfil candidato actualizado', {
        description: 'Tu identidad profesional reusable ya quedó guardada.'
      })
      void queryClient.invalidateQueries({ queryKey: CANDIDATE_PROFILE_QUERY_KEY })
    },
    onError: (error) => {
      void reportErrorWithToast({
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
      setPendingResumeUpload(null)
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

  useEffect(() => {
    return () => {
      if (pendingResumeUpload?.previewUrl) {
        URL.revokeObjectURL(pendingResumeUpload.previewUrl)
      }
    }
  }, [pendingResumeUpload?.previewUrl])

  function removeExperienceDraft(itemId: string) {
    setExperiences((current) =>
      current.length === 1 ? [createEmptyCandidateExperience()] : current.filter((item) => item.id !== itemId)
    )
  }

  function removeEducationDraft(itemId: string) {
    setEducations((current) =>
      current.length === 1 ? [createEmptyCandidateEducation()] : current.filter((item) => item.id !== itemId)
    )
  }

  function removeSkillDraft(itemId: string) {
    setSkills((current) => (current.length === 1 ? [createEmptyCandidateSkill()] : current.filter((item) => item.id !== itemId)))
  }

  function removeLanguageDraft(itemId: string) {
    setLanguages((current) =>
      current.length === 1 ? [createEmptyCandidateLanguage()] : current.filter((item) => item.id !== itemId)
    )
  }

  function removeLinkDraft(itemId: string) {
    setLinks((current) => (current.length === 1 ? [createEmptyCandidateLink()] : current.filter((item) => item.id !== itemId)))
  }

  function confirmPendingDelete() {
    if (!pendingDelete) {
      return
    }

    if (pendingDelete.kind === 'resume') {
      deleteResumeMutation.mutate(pendingDelete.resume)
      setPendingDelete(null)
      return
    }

    if (pendingDelete.kind === 'experience') {
      removeExperienceDraft(pendingDelete.id)
    } else if (pendingDelete.kind === 'education') {
      removeEducationDraft(pendingDelete.id)
    } else if (pendingDelete.kind === 'skill') {
      removeSkillDraft(pendingDelete.id)
    } else if (pendingDelete.kind === 'language') {
      removeLanguageDraft(pendingDelete.id)
    } else {
      removeLinkDraft(pendingDelete.id)
    }

    setPendingDelete(null)
  }

  const pendingDeleteCopy = pendingDelete
    ? {
        title:
          pendingDelete.kind === 'resume'
            ? 'Eliminar CV cargado'
            : pendingDelete.kind === 'experience'
              ? 'Eliminar experiencia de trabajo'
              : pendingDelete.kind === 'education'
                ? 'Eliminar educación'
                : pendingDelete.kind === 'skill'
                  ? 'Eliminar skill'
                  : pendingDelete.kind === 'language'
                    ? 'Eliminar idioma'
                    : 'Eliminar link',
        description:
          pendingDelete.kind === 'resume'
            ? `Vas a eliminar "${pendingDelete.resume.filename}". Esta acción quitará el archivo de tu perfil candidato.`
            : `Vas a eliminar "${pendingDelete.label}" de tu perfil candidato. Este cambio se aplicará cuando guardes el perfil.`
      }
    : null

  async function handleResumeFile(file: File | null | undefined) {
    if (!file) {
      return
    }

    setResumeFileError(null)

    if (resumes.length >= MAX_RESUME_COUNT) {
      setResumeFileError(`Alcanzaste el máximo de ${MAX_RESUME_COUNT} CVs. Elimina uno para subir otro.`)
      return
    }

    try {
      const preparedFile = await prepareUploadFile(file, {
        acceptedMimeTypes: CANDIDATE_RESUME_MIME_TYPES,
        acceptedFormatsLabel: 'PDF, DOC o DOCX',
        fieldLabel: 'El CV'
      })

      setPendingResumeUpload({
        file: preparedFile,
        previewUrl: URL.createObjectURL(preparedFile)
      })
    } catch (error) {
      const description =
        error instanceof UploadConstraintError ? error.userMessage : toErrorMessage(error)

      setResumeFileError(description)
      await reportErrorWithToast({
        title: 'No pudimos preparar tu CV',
        source: 'candidate-profile.resume-preview',
        route: surfacePaths.candidate.profile,
        userId: session.authUser?.id ?? null,
        error,
        description,
        userMessage: description
      })
    }
  }

  function confirmPendingResumeUpload() {
    if (!pendingResumeUpload) {
      return
    }

    uploadResumeMutation.mutate(pendingResumeUpload.file)
  }

  function cancelPendingResumeUpload() {
    if (uploadResumeMutation.isPending) {
      return
    }

    setPendingResumeUpload(null)
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
  const activeTabPanelVariants = shouldReduceMotion ? reducedTabPanelReveal : tabPanelReveal
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
            Tu perfil profesional
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-(--app-text-muted)">
            Historial, CV y visibilidad en un solo lugar.
          </p>
        </div>
        <Button
          className="hidden h-[42px] shrink-0 rounded-control px-5 text-sm sm:inline-flex sm:w-auto"
          disabled={saveMutation.isPending}
          onClick={() => void saveAll()}
        >
          <Check className="size-4" />
          {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </motion.header>

      <motion.div variants={cardReveal} className="grid grid-cols-4 gap-2 sm:gap-2.5">
        <ProfileStatTile icon={FileText} value={resumes.length} label="CV" />
        <ProfileStatTile icon={Sparkles} value={skillCount} label="Skills" />
        <ProfileStatTile icon={LanguagesIcon} value={languageCount} label="Idiomas" />
        <ProfileStatTile icon={Briefcase} value={experienceCount} label="Experiencia" />
      </motion.div>

      <motion.div variants={cardReveal} className="flex flex-wrap items-stretch gap-2.5">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-control border border-(--app-border) bg-(--app-surface) px-3 py-2 sm:min-w-[230px] sm:gap-4 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <p className="text-[0.8rem] font-semibold text-(--app-text) sm:text-[0.84rem]">Visible para empresas</p>
            <p className="mt-0.5 text-[0.7rem] text-(--app-text-subtle) sm:text-xs">
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
              'relative h-[22px] w-10 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) disabled:opacity-60 sm:h-[26px] sm:w-11',
              isVisibleToRecruiters ? 'bg-primary-600' : 'bg-secondary-200 dark:bg-secondary-500'
            )}
          >
            <span
              className={cn(
                'absolute top-[3px] left-[3px] size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform sm:size-5',
                isVisibleToRecruiters ? 'translate-x-[18px]' : 'translate-x-0'
              )}
            />
          </button>
        </div>
        <Button
          className="h-auto shrink-0 rounded-control px-3.5 text-[0.8rem] sm:hidden"
          disabled={saveMutation.isPending}
          onClick={() => void saveAll()}
        >
          <Check className="size-3.5" />
          {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </motion.div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <motion.div variants={cardReveal} className="min-w-0 space-y-[18px]">
          <div
            id="candidate-profile-tabs"
            className="grid grid-cols-2 gap-1 rounded-control border border-(--app-border) bg-(--app-surface) p-1 sm:flex sm:overflow-x-auto sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden"
          >
            {PROFILE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabSelect(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-[38px] items-center justify-center gap-2 rounded-control px-3 text-[0.84rem] font-semibold transition-colors sm:h-[38px] sm:shrink-0 sm:px-4',
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white'
                    : 'text-(--app-text-muted) hover:bg-(--app-surface-muted) hover:text-(--app-text)'
                )}
              >
                {tab.id === 'general' ? <span className="size-4 shrink-0 rounded-full border border-current" /> : null}
                {tab.id === 'cv' ? <FileText className="size-4 shrink-0" /> : null}
                {tab.id === 'experience' ? <Briefcase className="size-4 shrink-0" /> : null}
                {tab.id === 'skills' ? <Sparkles className="size-4 shrink-0" /> : null}
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {activeTab === 'general' ? (
              <motion.div key="general" variants={activeTabPanelVariants} initial="hidden" animate="show" exit="exit">
                <ProfileSection
              icon={Sparkles}
              title="Perfil general"
              description="Resumen reutilizable para futuras aplicaciones y nuevas oportunidades."
            >
              <div className="space-y-3 sm:space-y-4">
                <ProfileField
                  label="Titular profesional"
                  help="Tu presentación breve."
                  error={form.formState.errors.headline?.message}
                >
                  <Input className={profileFieldClass} placeholder="Ej. Coordinador de proyectos" {...form.register('headline')} />
                </ProfileField>

                <ProfileField
                  label="Rol objetivo"
                  help="Rol que quieres atraer."
                  error={form.formState.errors.desiredRole?.message}
                >
                  <Input className={profileFieldClass} placeholder="Ej. Talent Acquisition Lead" {...form.register('desiredRole')} />
                </ProfileField>

                <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
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

                <ProfileField
                  label="Resumen profesional"
                  help="Experiencia, fortalezas y logros."
                  error={form.formState.errors.summary?.message}
                >
                  <Textarea
                    className={profileTextareaClass}
                    placeholder="Resume experiencia, fortalezas, logros y el tipo de oportunidad que quieres atraer."
                    {...form.register('summary')}
                  />
                </ProfileField>
              </div>
                </ProfileSection>
              </motion.div>
            ) : null}

            {activeTab === 'cv' ? (
              <motion.div key="cv" variants={activeTabPanelVariants} initial="hidden" animate="show" exit="exit">
                <ProfileSection
              icon={FileText}
              title="CV y visibilidad"
              description={`Sube versiones privadas reutilizables. Tamaño máximo ${MAX_UPLOAD_SIZE_LABEL}.`}
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
                    void handleResumeFile(event.dataTransfer.files?.[0])
                  }}
                  className={cn(
                    'group relative flex cursor-pointer flex-col items-center justify-center rounded-control border-[1.5px] border-dashed px-4 py-5 text-center transition-colors sm:px-5 sm:py-8',
                    isResumeDragging
                      ? 'border-primary-400 bg-primary-50/80 dark:bg-primary-500/10'
                      : 'border-secondary-200 bg-(--app-surface-muted)/40 hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-500/10',
                    (uploadResumeMutation.isPending || resumes.length >= MAX_RESUME_COUNT) && 'pointer-events-none opacity-70'
                  )}
                >
                  <input
                    className="sr-only"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    type="file"
                    disabled={uploadResumeMutation.isPending || resumes.length >= MAX_RESUME_COUNT}
                    onChange={(event) => {
                      void handleResumeFile(event.target.files?.[0])
                      event.currentTarget.value = ''
                    }}
                  />
                  <span className="mb-2 flex size-9 items-center justify-center rounded-control bg-primary-50 text-primary-600 transition-transform group-hover:scale-105 sm:mb-3 sm:size-11 dark:bg-primary-500/15 dark:text-primary-300">
                    <Upload className="size-4 sm:size-5" />
                  </span>
                  <span className="text-[0.82rem] font-semibold text-(--app-text) sm:text-sm">
                    {uploadResumeMutation.isPending
                      ? 'Subiendo tu CV...'
                      : resumes.length >= MAX_RESUME_COUNT
                        ? `Alcanzaste el máximo de ${MAX_RESUME_COUNT} CVs`
                        : 'Arrastra tu CV aquí o haz clic para revisar'}
                  </span>
                  <span className="mt-1 text-[0.72rem] text-(--app-text-subtle) sm:text-[0.78rem]">
                    {resumes.length >= MAX_RESUME_COUNT
                      ? 'Elimina un CV para subir otro'
                      : `PDF, DOC o DOCX · Máx ${MAX_UPLOAD_SIZE_LABEL}`}
                  </span>
                </label>
                {resumeFileError ? <p className="text-[0.72rem] font-medium text-rose-600 dark:text-rose-300">{resumeFileError}</p> : null}

                <div className="space-y-3">
                  {resumes.length === 0 ? (
                    <div className="rounded-control border border-dashed border-(--app-border) px-4 py-6 text-sm text-(--app-text-muted)">
                      Todavía no has subido CVs. El primero quedará como principal.
                    </div>
                  ) : (
                    resumes.map((resume) => (
                      <div key={resume.id} className="flex flex-col gap-2.5 rounded-control border border-(--app-border) p-2.5 sm:flex-row sm:items-center sm:gap-3 sm:p-3.5">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-(--app-success-surface) text-emerald-600 sm:size-10 dark:text-emerald-300">
                            <FileText className="size-4 sm:size-5" />
                          </span>
                          {resume.is_default ? (
                            <Badge variant="soft" className="shrink-0 px-2 py-0.5 text-[0.68rem]">Principal</Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0 px-2 py-0.5 text-[0.68rem]">Secundario</Badge>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.82rem] font-semibold text-(--app-text) sm:text-sm">{resume.filename}</p>
                            <p className="mt-0.5 text-[0.72rem] text-(--app-text-subtle) sm:text-[0.78rem]">
                              {normalizeCandidateResumeLabel(resume.mime_type)} · {(resume.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Button variant="outline" className="h-8 rounded-control px-3 text-[0.78rem]" onClick={() => void openResume(resume.storage_path)}>
                            Abrir
                          </Button>
                          {!resume.is_default ? (
                            <Button
                              variant="outline"
                              className="h-8 rounded-control px-3 text-[0.78rem]"
                              onClick={() => setDefaultResumeMutation.mutate(resume.id)}
                              disabled={setDefaultResumeMutation.isPending}
                            >
                              Principal
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            className="h-8 rounded-control px-3 text-[0.78rem]"
                            onClick={() => setPendingDelete({ kind: 'resume', resume })}
                            disabled={deleteResumeMutation.isPending}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
                </ProfileSection>
              </motion.div>
            ) : null}

            {activeTab === 'experience' ? (
              <motion.div
                key="experience"
                variants={activeTabPanelVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="space-y-4"
              >
              <ProfileSection
                icon={Briefcase}
                title="Experiencia"
                description="Organiza tu historial laboral y destaca tu impacto."
                actionLabel="Agregar"
                onAction={() => setExperiences((current) => [...current, createEmptyCandidateExperience()])}
              >
                {experiences.map((experience) => (
                  <CollapsibleItem
                    key={experience.id}
                    title={textOrFallback(experience.roleTitle, 'Nueva experiencia')}
                    subtitle={experience.companyName}
                    defaultOpen={!experience.roleTitle && !experience.companyName}
                  >
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
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
                      <ProfileField
                        label="Tipo de empleo"
                        help="Tiempo completo, contrato, etc."
                      >
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
                    <ProfileField
                      label="Impacto"
                      help="Responsabilidades y resultados."
                      className="mt-3 sm:mt-4"
                    >
                      <Textarea
                        className={profileTextareaClass}
                        placeholder="Impacto, responsabilidades y resultados."
                        value={experience.summary}
                        onChange={(event) => updateCollectionItem(setExperiences, experience.id, { summary: event.target.value })}
                      />
                    </ProfileField>
                    <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-4">
                      <label className="inline-flex items-center gap-2 text-[0.8rem] text-(--app-text) sm:text-[0.82rem]">
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
                        className="inline-flex h-8 items-center gap-2 rounded-control px-3 text-[0.8rem] font-semibold text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-rose-600 sm:text-[0.82rem]"
                        onClick={() =>
                          setPendingDelete({
                            kind: 'experience',
                            id: experience.id,
                            label: textOrFallback(experience.roleTitle, 'esta experiencia de trabajo')
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </button>
                    </div>
                  </CollapsibleItem>
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
                  <CollapsibleItem
                    key={education.id}
                    title={textOrFallback(education.institutionName, 'Nueva educación')}
                    subtitle={education.degreeName}
                    defaultOpen={!education.institutionName && !education.degreeName}
                  >
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                      <ProfileField label="Institución">
                        <Input
                          className={profileFieldClass}
                          placeholder="Institución"
                          value={education.institutionName}
                          onChange={(event) => updateCollectionItem(setEducations, education.id, { institutionName: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField
                        label="Título/certificación"
                        help="Grado o certificación."
                      >
                        <Input
                          className={profileFieldClass}
                          placeholder="Título o grado"
                          value={education.degreeName}
                          onChange={(event) => updateCollectionItem(setEducations, education.id, { degreeName: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField
                        label="Área de estudio"
                        help="Carrera o disciplina."
                      >
                        <Input
                          className={profileFieldClass}
                          placeholder="Área de estudio"
                          value={education.fieldOfStudy}
                          onChange={(event) => updateCollectionItem(setEducations, education.id, { fieldOfStudy: event.target.value })}
                        />
                      </ProfileField>
                      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
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
                    <ProfileField
                      label="Notas"
                      help="Logros o contexto académico."
                      className="mt-3 sm:mt-4"
                    >
                      <Textarea
                        className={profileTextareaClass}
                        placeholder="Logros, enfoque o certificaciones."
                        value={education.summary}
                        onChange={(event) => updateCollectionItem(setEducations, education.id, { summary: event.target.value })}
                      />
                    </ProfileField>
                    <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-4">
                      <label className="inline-flex items-center gap-2 text-[0.8rem] text-(--app-text) sm:text-[0.82rem]">
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
                        className="inline-flex h-8 items-center gap-2 rounded-control px-3 text-[0.8rem] font-semibold text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-rose-600 sm:text-[0.82rem]"
                        onClick={() =>
                          setPendingDelete({
                            kind: 'education',
                            id: education.id,
                            label: textOrFallback(education.degreeName || education.institutionName, 'esta educación')
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </button>
                    </div>
                  </CollapsibleItem>
                ))}
              </ProfileSection>
              </motion.div>
            ) : null}

            {activeTab === 'skills' ? (
              <motion.div
                key="skills"
                variants={activeTabPanelVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="space-y-4"
              >
              <AccordionSection
                icon={Sparkles}
                title="Skills"
                description="Habilidades técnicas y blandas que te representan."
                actionLabel="Agregar skill"
                onAdd={() => setSkills((current) => [...current, createEmptyCandidateSkill()])}
                defaultOpen
              >
                {skills.map((skill) => (
                  <CollapsibleItem
                    key={skill.id}
                    title={textOrFallback(skill.skillName, 'Nuevo skill')}
                    subtitle={skill.proficiencyLabel}
                    defaultOpen={!skill.skillName && !skill.proficiencyLabel}
                  >
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                      <ProfileField
                        label="Skill"
                        help="Habilidad relevante."
                      >
                        <Input
                          className={profileFieldClass}
                          placeholder="Skill"
                          value={skill.skillName}
                          onChange={(event) => updateCollectionItem(setSkills, skill.id, { skillName: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField
                        label="Nivel"
                        help="Básico, intermedio, avanzado."
                      >
                        <Input
                          className={profileFieldClass}
                          placeholder="Nivel"
                          value={skill.proficiencyLabel}
                          onChange={(event) => updateCollectionItem(setSkills, skill.id, { proficiencyLabel: event.target.value })}
                        />
                      </ProfileField>
                    </div>
                    <div className="mt-3 flex justify-end sm:mt-4">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-2 rounded-control px-3 text-[0.8rem] font-semibold text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-rose-600 sm:text-[0.82rem]"
                        onClick={() =>
                          setPendingDelete({
                            kind: 'skill',
                            id: skill.id,
                            label: textOrFallback(skill.skillName, 'este skill')
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </button>
                    </div>
                  </CollapsibleItem>
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
                  <CollapsibleItem
                    key={language.id}
                    title={textOrFallback(language.languageName, 'Nuevo idioma')}
                    subtitle={language.proficiencyLabel}
                    defaultOpen={!language.languageName && !language.proficiencyLabel}
                  >
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                      <ProfileField label="Idioma">
                        <Input
                          className={profileFieldClass}
                          placeholder="Idioma"
                          value={language.languageName}
                          onChange={(event) => updateCollectionItem(setLanguages, language.id, { languageName: event.target.value })}
                        />
                      </ProfileField>
                      <ProfileField
                        label="Nivel"
                        help="Dominio del idioma."
                      >
                        <Input
                          className={profileFieldClass}
                          placeholder="Nivel"
                          value={language.proficiencyLabel}
                          onChange={(event) => updateCollectionItem(setLanguages, language.id, { proficiencyLabel: event.target.value })}
                        />
                      </ProfileField>
                    </div>
                    <div className="mt-3 flex justify-end sm:mt-4">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-2 rounded-control px-3 text-[0.8rem] font-semibold text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-rose-600 sm:text-[0.82rem]"
                        onClick={() =>
                          setPendingDelete({
                            kind: 'language',
                            id: language.id,
                            label: textOrFallback(language.languageName, 'este idioma')
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </button>
                    </div>
                  </CollapsibleItem>
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
                  <CollapsibleItem
                    key={link.id}
                    title={textOrFallback(link.label || link.url, 'Nuevo link')}
                    subtitle={link.url}
                    defaultOpen={!link.label && !link.url}
                  >
                    <div className="space-y-3 sm:space-y-4">
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-[0.7fr_1fr]">
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
                      <ProfileField
                        label="Etiqueta"
                        help="Nombre visible del enlace."
                      >
                        <Input
                          className={profileFieldClass}
                          placeholder="Etiqueta"
                          value={link.label}
                          onChange={(event) => updateCollectionItem(setLinks, link.id, { label: event.target.value })}
                        />
                      </ProfileField>
                    </div>
                    <ProfileField
                      label="URL"
                      help="Enlace completo."
                    >
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
                        className="inline-flex h-8 items-center gap-2 rounded-control px-3 text-[0.8rem] font-semibold text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-rose-600 sm:text-[0.82rem]"
                        onClick={() =>
                          setPendingDelete({
                            kind: 'link',
                            id: link.id,
                            label: textOrFallback(link.label || link.url, 'este link')
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </button>
                    </div>
                    </div>
                  </CollapsibleItem>
                ))}
              </AccordionSection>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        <motion.aside variants={cardReveal} className="flex h-full flex-col gap-3 sm:gap-4">
          <Card className="rounded-control p-4 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)] sm:p-5">
            <h2 className="text-[0.88rem] font-bold tracking-tight text-(--app-text) sm:text-[0.95rem]">Resumen de tu perfil</h2>
            <div className="mt-3 flex items-center gap-3 sm:mt-4 sm:gap-4">
              <CircularProgress value={completionPercent} />
              <div>
                <p className="text-[0.82rem] font-semibold text-(--app-text) sm:text-sm">Completado del perfil</p>
                <p className="mt-0.5 text-[0.74rem] text-(--app-text-subtle) sm:text-[0.78rem]">
                  {completionPercent >= 100 ? '¡Tu perfil está listo!' : '¡Vas muy bien! Completa la información para destacar más.'}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-(--app-border) pt-2.5 sm:mt-4 sm:pt-3">
              <div>
                <p className="text-xs text-(--app-text-subtle)">Última actualización</p>
                <p className="mt-0.5 text-[0.82rem] font-semibold text-(--app-text) sm:mt-1 sm:text-[0.84rem]">{formatUpdatedAt(bundle.profile?.updated_at)}</p>
              </div>
              <div>
                <p className="text-xs text-(--app-text-subtle)">Visibilidad</p>
                <p className={cn('mt-0.5 text-[0.82rem] font-semibold sm:mt-1 sm:text-[0.84rem]', isVisibleToRecruiters ? 'text-emerald-600 dark:text-emerald-300' : 'text-(--app-text)')}>
                  {isVisibleToRecruiters ? 'Visible en el directorio' : 'Oculto del directorio'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="rounded-control p-4 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)] sm:p-5">
            <h2 className="text-[0.88rem] font-bold tracking-tight text-(--app-text) sm:text-[0.95rem]">Acciones rápidas</h2>
            <div className="mt-3 divide-y divide-(--app-border) sm:mt-4">
              <QuickAction icon={Upload} title="Subir nuevo CV" description="Actualiza tu CV privado actual." onClick={() => handleTabSelect('cv')} />
              <QuickAction icon={Eye} title="Vista previa del perfil" description="Mira cómo te ven las empresas." onClick={() => toast.info('Vista previa próximamente')} />
              <QuickAction icon={Download} title="Descargar mis datos" description="Obtén una copia de tu información." onClick={() => toast.info('Exportación de datos próximamente')} />
            </div>
          </Card>

        </motion.aside>
      </div>
      <ResumeUploadPreviewDialog
        pendingUpload={pendingResumeUpload}
        loading={uploadResumeMutation.isPending}
        onConfirm={confirmPendingResumeUpload}
        onCancel={cancelPendingResumeUpload}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteCopy)}
        title={pendingDeleteCopy?.title ?? 'Eliminar elemento'}
        description={pendingDeleteCopy?.description}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleteResumeMutation.isPending}
        onConfirm={confirmPendingDelete}
        onCancel={() => setPendingDelete(null)}
      />
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
