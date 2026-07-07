import { useEffect, useRef, useState, type DragEvent } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  Globe2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useForm, type FieldPath } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { FieldHelp } from '@/components/ui/field-help'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  createPrivateFileUrl,
  toErrorMessage,
  updateUserProfile,
  uploadPrivateFile
} from '@/features/auth/lib/auth-api'
import { onboardingSchema, type OnboardingValues } from '@/features/auth/lib/auth-schemas'
import { hasCompletedBaseOnboarding } from '@/features/auth/lib/onboarding-status'
import { CountryCodeSelect } from '@/shared/ui/location-selects'
import { getCountryOptionByCode } from '@/shared/geo/location-options'
import { captureClientError } from '@/lib/errors/client-error-logger'
import {
  MAX_UPLOAD_SIZE_LABEL,
  ONBOARDING_AVATAR_MIME_TYPES,
  prepareUploadFile,
  UploadConstraintError
} from '@/lib/uploads/media'
import { cn } from '@/lib/utils/cn'

// Tras completar el perfil base redirigimos al pago de la membresía. 8s deja
// leer el mensaje de éxito y respeta a usuarios con lectores de pantalla, sin
// frenar el objetivo de "llenar formulario y pagar de inmediato".
const MEMBERSHIP_REDIRECT_SECONDS = 8

const steps = [
  {
    id: 'identity',
    label: 'Identidad',
    title: '¿Cómo te presentamos?',
    description: '',
    icon: UserRound,
    fields: ['fullName', 'displayName'] satisfies FieldPath<OnboardingValues>[]
  },
  {
    id: 'context',
    label: 'Contexto',
    title: 'Idioma y país',
    description: 'Ajustamos tu experiencia inicial.',
    icon: Globe2,
    fields: ['locale', 'countryCode'] satisfies FieldPath<OnboardingValues>[]
  },
  {
    id: 'avatar',
    label: 'Foto',
    title: 'Una foto ayuda, pero no bloquea',
    description: 'Súbela ahora u omítela.',
    icon: Camera,
    fields: [] satisfies FieldPath<OnboardingValues>[]
  }
] as const

type StepId = (typeof steps)[number]['id'] | 'done'

function getInitials(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'TU'
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="min-h-4 text-xs text-rose-600 dark:text-rose-300">{message}</p>
}

function OnboardingFrame({
  activeStep,
  completedStepCount,
  onStepSelect
}: {
  activeStep: StepId
  completedStepCount: number
  onStepSelect?: (stepIndex: number) => void
}) {
  const activeIndex = activeStep === 'done' ? steps.length : steps.findIndex((step) => step.id === activeStep)
  const progress = Math.round((completedStepCount / steps.length) * 100)

  return (
    <aside className="relative order-first overflow-hidden rounded-card-lg p-0 md:order-none md:border md:border-(--app-border) md:bg-(--app-surface-elevated) md:p-5 md:shadow-[0_6px_22px_rgba(29,54,120,0.07)] xl:sticky xl:top-24">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden size-7 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-100 md:flex">
            <Sparkles className="size-3.5" />
          </span>
          <p className="whitespace-nowrap text-xs font-semibold text-(--app-text-subtle) md:text-sm md:font-bold md:text-(--app-text)">
            Tour guiado
          </p>
        </div>
        <span className="text-xs font-bold text-primary-700 dark:text-primary-200 md:text-sm">{progress}%</span>
      </div>

      <div className="mt-2.5 md:mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-primary-100/80 dark:bg-primary-500/12 md:h-2">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-primary-500 to-primary-700"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.56, ease: [0.22, 0.61, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="mt-5 hidden space-y-1.5 md:block">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = index === activeIndex
          const isDone = index < completedStepCount || activeStep === 'done'

          return (
            <button
              key={step.id}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'flex w-full items-start gap-3 rounded-card border p-3 text-left transition',
                isActive
                  ? 'border-primary-300/70 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/12 dark:text-primary-100'
                  : 'border-transparent text-(--app-text-muted) hover:bg-primary-50/70 hover:text-(--app-text) dark:hover:bg-primary-500/10'
              )}
              disabled={activeStep === 'done'}
              onClick={() => onStepSelect?.(index)}
            >
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-control transition',
                  isDone || isActive ? 'bg-primary-600 text-white' : 'bg-primary-50 text-(--app-text-subtle)'
                )}
              >
                {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-current">{step.label}</p>
                {step.description ? (
                  <p className="mt-0.5 text-xs leading-5 text-(--app-text-muted)">{step.description}</p>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-5 hidden rounded-card border border-(--app-border) bg-primary-50/70 p-4 dark:bg-primary-500/10 md:block">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary-700 dark:text-primary-200" />
          <p className="text-xs leading-5 text-(--app-text-muted)">
            Con tus datos base ya tienes acceso. El CV y la experiencia los completas después.
          </p>
        </div>
      </div>
    </aside>
  )
}

export function ProfileOnboardingFlow() {
  const navigate = useNavigate()
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarFileError, setAvatarFileError] = useState<string | null>(null)
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  // `justSubmitted` solo es true cuando el usuario acaba de enviar el formulario
  // en esta sesión (no al revisitar con el perfil ya completo), para que el
  // auto-redireccionamiento al pago no dispare en visitas posteriores.
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [redirectCountdown, setRedirectCountdown] = useState(MEMBERSHIP_REDIRECT_SECONDS)

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      displayName: '',
      locale: 'es',
      countryCode: 'DO'
    }
  })

  useEffect(() => {
    if (!session.profile) {
      return
    }

    form.reset({
      fullName: session.profile.full_name === 'New user' ? '' : session.profile.full_name,
      displayName: session.profile.display_name === 'New user' ? '' : session.profile.display_name,
      locale: session.profile.locale === 'en' ? 'en' : 'es',
      countryCode: session.profile.country_code ?? 'DO'
    })
    setIsComplete(hasCompletedBaseOnboarding(session.profile))
  }, [form, session.profile])

  useEffect(() => {
    if (!session.profile?.avatar_path) {
      return
    }

    let isActive = true

    async function loadSignedAvatar() {
      try {
        const signedUrl = await createPrivateFileUrl('user-media', session.profile?.avatar_path ?? '')

        if (isActive) {
          setAvatarPreviewUrl(signedUrl)
        }
      } catch {
        if (isActive) {
          setAvatarPreviewUrl(null)
        }
      }
    }

    void loadSignedAvatar()

    return () => {
      isActive = false
    }
  }, [session.profile?.avatar_path])

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl)
      }
    }
  }, [avatarPreviewUrl])

  // Ref estable para que el intervalo del countdown invoque siempre la última
  // versión de leaveToMembership sin re-ejecutar el efecto en cada render.
  const leaveToMembershipRef = useRef<() => void>(() => {})

  // Auto-redireccionamiento al pago de la membresía con cuenta regresiva visible.
  // Solo corre cuando el usuario acaba de enviar el formulario en esta sesión.
  useEffect(() => {
    if (!justSubmitted) {
      return
    }

    setRedirectCountdown(MEMBERSHIP_REDIRECT_SECONDS)

    const intervalId = window.setInterval(() => {
      setRedirectCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(intervalId)
          leaveToMembershipRef.current()
          return 0
        }

        return value - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [justSubmitted])

  const activeStep = steps[activeStepIndex]
  const ActiveStepIcon = activeStep.icon
  const completedStepCount = isComplete ? steps.length : activeStepIndex
  const watchedFullName = form.watch('fullName')
  const watchedDisplayName = form.watch('displayName')
  const previewName = watchedDisplayName || watchedFullName || session.authUser?.email || 'Tu nombre'
  const previewInitials = getInitials(previewName)
  const previewCountry = form.watch('countryCode') || 'DO'
  const previewCountryLabel = getCountryOptionByCode(previewCountry)?.label ?? previewCountry.toUpperCase()
  const previewLocale = form.watch('locale') === 'en' ? 'English' : 'Español'
  const isLastStep = activeStepIndex === steps.length - 1
  const primaryActionLabel = form.formState.isSubmitting ? 'Guardando...' : isLastStep ? 'Guardar y entrar' : 'Continuar'

  // Refresca la sesión (para que el guard de onboarding completo deje pasar) y
  // navega. Idempotente: el countdown, el botón de pago y "Completar después"
  // pueden dispararlo, pero solo una salida corre. Si el refresh o la navegación
  // fallan, liberamos el cerrojo para permitir reintentar en lugar de dejar el
  // botón muerto.
  const isLeavingRef = useRef(false)
  async function refreshAndNavigate(path: string) {
    if (isLeavingRef.current) {
      return
    }
    isLeavingRef.current = true
    try {
      await session.refresh()
      await navigate(path)
    } catch (error) {
      isLeavingRef.current = false
      toast.error('No pudimos continuar', {
        description: toErrorMessage(error)
      })
    }
  }

  function goToMembership() {
    void refreshAndNavigate(surfacePaths.account.membership)
  }

  // Mantén el ref del countdown apuntando siempre a la última versión, sin
  // mutarlo durante el render (lo hacemos en un efecto, como recomienda React).
  useEffect(() => {
    leaveToMembershipRef.current = () => {
      void refreshAndNavigate(surfacePaths.account.membership)
    }
  })

  async function handleAvatarChange(file: File | null) {
    setAvatarFileError(null)
    setAvatarFile(file)

    if (!file) {
      setAvatarPreviewUrl(session.profile?.avatar_path ? avatarPreviewUrl : null)
      return
    }

    setIsPreparingAvatar(true)

    try {
      const preparedFile = await prepareUploadFile(file, {
        acceptedMimeTypes: ONBOARDING_AVATAR_MIME_TYPES,
        acceptedFormatsLabel: 'SVG, PNG, JPG o WEBP',
        fieldLabel: 'El avatar',
        maxImageDimension: 1024
      })

      setAvatarFile(preparedFile)

      const objectUrl = URL.createObjectURL(preparedFile)
      setAvatarPreviewUrl((currentUrl) => {
        if (currentUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(currentUrl)
        }

        return objectUrl
      })
    } catch (error) {
      const message = error instanceof UploadConstraintError ? error.userMessage : toErrorMessage(error)

      setAvatarFile(null)
      setAvatarFileError(message)
      setAvatarPreviewUrl(null)
      toast.error('No pudimos preparar la foto', {
        description: message
      })
      await captureClientError({
        source: 'profile.onboarding.avatar',
        route: surfacePaths.candidate.profile,
        userId: session.authUser?.id ?? null,
        userMessage: message,
        error,
        metadata: {
          fileName: file.name,
          fileSizeBytes: file.size,
          fileType: file.type
        }
      })
    } finally {
      setIsPreparingAvatar(false)
    }
  }

  function handleAvatarDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    void handleAvatarChange(event.dataTransfer.files?.[0] ?? null)
  }

  async function submitProfile(values: OnboardingValues) {
    if (!session.authUser) {
      return
    }

    try {
      let avatarPath = session.profile?.avatar_path ?? null

      if (avatarFile) {
        avatarPath = await uploadPrivateFile({
          bucket: 'user-media',
          ownerUserId: session.authUser.id,
          file: avatarFile,
          prefix: 'avatar'
        })
      }

      await updateUserProfile({
        userId: session.authUser.id,
        fullName: values.fullName,
        displayName: values.displayName,
        locale: values.locale,
        countryCode: values.countryCode,
        avatarPath
      })

      // No refrescamos la sesión aquí: hacerlo marca el onboarding como completo
      // y CandidateProfilePage desmontaría este wizard antes de mostrar el
      // resumen con el CTA de pago. Refrescamos justo antes de salir al pago
      // (ver leaveToMembership), para que el resumen + cuenta regresiva sí se vean.
      setIsComplete(true)
      setJustSubmitted(true)
      toast.success('Perfil listo', {
        description: 'Te llevamos a activar tu membresía.'
      })
    } catch (error) {
      await captureClientError({
        source: 'profile.onboarding.submit',
        route: surfacePaths.candidate.profile,
        userId: session.authUser.id,
        userMessage: 'No pudimos guardar tu perfil base.',
        error,
        metadata: {
          hasAvatarFile: avatarFile !== null
        }
      })
      toast.error('No pudimos guardar tu perfil', {
        description: toErrorMessage(error)
      })
    }
  }

  async function handleNext() {
    const isValid = await form.trigger([...activeStep.fields])

    if (!isValid) {
      return
    }

    if (isLastStep) {
      await form.handleSubmit(submitProfile)()
      return
    }

    setActiveStepIndex((value) => Math.min(value + 1, steps.length - 1))
  }

  async function goToStep(stepIndex: number) {
    if (stepIndex <= activeStepIndex) {
      setActiveStepIndex(stepIndex)
      return
    }

    const fieldsToValidate = steps
      .slice(activeStepIndex, stepIndex)
      .flatMap((step) => step.fields)
    const isValid = await form.trigger(fieldsToValidate)

    if (isValid) {
      setActiveStepIndex(stepIndex)
    }
  }

  const slideTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 230, damping: 28, mass: 0.85 }

  return (
    <div className="mx-auto w-full max-w-300 pb-8 md:pb-0">
      <div className="mb-4 max-w-2xl md:mb-7">
        <h1 className="text-[1.6rem] font-bold leading-[1.04] tracking-tight text-(--app-text) sm:text-[2.5rem]">
          Dejemos tu cuenta lista
        </h1>
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_328px]">
        <main className="min-w-0">
          <section className="overflow-hidden rounded-card-lg border border-(--app-border) bg-(--app-surface-elevated) shadow-[0_6px_22px_rgba(29,54,120,0.07)]">
            <div className="grid md:grid-cols-[minmax(0,1fr)_300px]">
              <div className="p-4 sm:p-8 md:min-h-[400px]">
                <AnimatePresence mode="wait">
                  {isComplete ? (
                    <motion.div
                      key="done"
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col justify-between md:min-h-[414px]"
                      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
                      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 14 }}
                      transition={slideTransition}
                    >
                      <div>
                        <div className="flex size-14 items-center justify-center rounded-card bg-primary-600 text-white">
                          <CheckCircle2 className="size-7" />
                        </div>
                        <h2 className="mt-5 text-[1.7rem] font-bold leading-tight tracking-tight text-(--app-text) sm:text-[2rem]">
                          Listo, {previewName.split(' ')[0]}
                        </h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-(--app-text-muted)">
                          El último paso es activar tu membresía. Es lo que habilita el acceso completo a ASI, así que te llevamos directo al pago.
                        </p>
                      </div>

                      <div className="mt-8">
                        <Button className="h-12 w-full rounded-card px-5 sm:w-auto" onClick={goToMembership}>
                          <CreditCard className="size-5" />
                          Pagar mi membresía ahora
                          <ArrowRight className="size-5" />
                        </Button>

                        {justSubmitted ? (
                          <p aria-live="polite" className="mt-3 text-xs leading-5 text-(--app-text-muted)" role="status">
                            Te llevaremos al pago automáticamente en {redirectCountdown}{' '}
                            {redirectCountdown === 1 ? 'segundo' : 'segundos'}.
                          </p>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={activeStep.id}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col justify-between md:min-h-[344px]"
                      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
                      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                      transition={slideTransition}
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-card bg-primary-50 text-primary-700 shadow-[inset_0_0_0_1px_rgba(45,82,168,0.08)] dark:bg-primary-500/12 dark:text-primary-100 md:size-[46px]">
                            <ActiveStepIcon className="size-[18px] md:size-5" />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-[0.14em] text-(--app-text-subtle)">
                            Paso {activeStepIndex + 1} de {steps.length}
                          </span>
                        </div>

                        <h2 className="mt-5 text-[1.4rem] font-bold leading-[1.12] tracking-tight text-(--app-text) md:mt-7 md:text-[1.7rem]">
                          {activeStep.title}
                        </h2>
                        {activeStep.description ? (
                          <p className="mt-2 max-w-xl text-sm leading-6 text-(--app-text-muted)">
                            {activeStep.description}
                          </p>
                        ) : null}

                        <form className="mt-5 space-y-4 md:mt-7 md:space-y-5" onSubmit={(event) => event.preventDefault()}>
                          {activeStep.id === 'identity' ? (
                            <>
                              <label className="block space-y-2">
                                <span className="text-[13px] font-semibold text-(--app-text)">Nombre completo</span>
                                <Input
                                  autoComplete="name"
                                  className="h-12 rounded-control md:h-[50px]"
                                  placeholder="Ej. John Doe"
                                  {...form.register('fullName')}
                                />
                                <FieldError message={form.formState.errors.fullName?.message} />
                              </label>

                              <label className="block space-y-2">
                                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-(--app-text)">
                                  <span>Nombre visible</span>
                                  <FieldHelp
                                    fieldLabel="Nombre visible"
                                    help="Así te verán otras personas dentro de la plataforma."
                                  />
                                </span>
                                <Input
                                  className="h-12 rounded-control md:h-[50px]"
                                  placeholder="Ej. John D."
                                  {...form.register('displayName')}
                                />
                                <FieldError message={form.formState.errors.displayName?.message} />
                              </label>
                            </>
                          ) : null}

                          {activeStep.id === 'context' ? (
                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="block space-y-2">
                                <span className="text-[13px] font-semibold text-(--app-text)">Idioma</span>
                                <Select className="h-12 rounded-control md:h-[50px]" {...form.register('locale')}>
                                  <option value="es">Español</option>
                                  <option value="en">English</option>
                                </Select>
                              </label>

                              <label className="block space-y-2">
                                <span className="text-[13px] font-semibold text-(--app-text)">País</span>
                                <CountryCodeSelect className="h-12 rounded-control md:h-[50px]" {...form.register('countryCode')} />
                                <FieldError message={form.formState.errors.countryCode?.message} />
                              </label>
                            </div>
                          ) : null}

                          {activeStep.id === 'avatar' ? (
                            <div className="space-y-4">
                              <label
                                className={cn(
                                  'flex cursor-pointer items-center gap-3 rounded-card border border-dashed px-3 py-2.5 text-left transition md:gap-4 md:px-4 md:py-3.5',
                                  avatarFile
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400/60 dark:bg-emerald-500/10 dark:text-emerald-200'
                                    : 'border-primary-300 bg-primary-50/70 text-primary-700 hover:bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-100'
                                )}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={handleAvatarDrop}
                              >
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--app-surface-elevated) shadow-sm md:size-11">
                                  {avatarFile ? <CheckCircle2 className="size-4 md:size-5" /> : <UploadCloud className="size-4 md:size-5" />}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[13px] font-semibold text-(--app-text) md:text-sm">
                                    {avatarFile ? avatarFile.name : 'Subir foto'}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[11px] leading-4 text-(--app-text-muted) md:text-xs">
                                    SVG, PNG, JPG o WEBP · hasta {MAX_UPLOAD_SIZE_LABEL}.
                                  </span>
                                </span>
                                <input
                                  accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                                  className="sr-only"
                                  type="file"
                                  onChange={(event) => void handleAvatarChange(event.target.files?.[0] ?? null)}
                                />
                              </label>
                              <p className="text-xs leading-5 text-(--app-text-subtle)">
                                Sin foto usaremos tus iniciales.{' '}
                                <button
                                  className="font-semibold text-(--app-text-muted) underline underline-offset-2"
                                  type="button"
                                  onClick={() => void handleNext()}
                                >
                                  Omitir por ahora
                                </button>
                              </p>
                              {isPreparingAvatar ? (
                                <p className="text-xs text-(--app-text-subtle)">Optimizando foto...</p>
                              ) : null}
                              {avatarFileError ? <p className="text-xs text-rose-600 dark:text-rose-300">{avatarFileError}</p> : null}
                            </div>
                          ) : null}
                        </form>
                      </div>

                      <div className="mt-8 hidden items-center justify-between border-t border-(--app-border) pt-6 md:flex">
                        <Button
                          className="h-12 rounded-card px-5"
                          disabled={activeStepIndex === 0 || form.formState.isSubmitting}
                          variant="outline"
                          onClick={() => setActiveStepIndex((value) => Math.max(value - 1, 0))}
                        >
                          <ArrowLeft className="size-4" />
                          Atrás
                        </Button>
                        <Button
                          className="h-12 rounded-card px-5"
                          disabled={form.formState.isSubmitting || isPreparingAvatar}
                          onClick={() => void handleNext()}
                        >
                          {primaryActionLabel}
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="border-t border-(--app-border) bg-linear-to-b from-(--app-surface-elevated) to-(--app-surface-muted) p-4 md:border-l md:border-t-0 md:p-6">
                <div className="flex h-full flex-col justify-between gap-4 md:gap-5">
                  <div>
                    <div className="overflow-hidden rounded-card border border-(--app-border) bg-(--app-surface-elevated) shadow-[0_6px_22px_rgba(29,54,120,0.07)]">
                      <div className="flex h-[46px] items-center justify-between bg-linear-to-br from-primary-700 to-primary-500 px-4 text-white">
                        <img
                          alt="ASI"
                          className="h-8 w-8 shrink-0 object-contain"
                          src="/brand/asi-logo-white-transparent-96.webp"
                        />
                        <span className="rounded-[5px] border border-white/40 px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-white/85">
                          Perfil
                        </span>
                      </div>
                      <div className="p-[18px]">
                        <div className="flex items-center gap-3">
                          <div className="flex size-[54px] shrink-0 items-center justify-center overflow-hidden rounded-card bg-linear-to-br from-primary-500 to-primary-300 text-lg font-bold text-white shadow-sm">
                            {avatarPreviewUrl ? (
                              <img alt="Vista previa de avatar" className="h-full w-full object-cover" src={avatarPreviewUrl} />
                            ) : (
                              previewInitials
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[17px] font-bold tracking-tight text-(--app-text)">{previewName}</p>
                            <p className="truncate text-xs text-(--app-text-subtle)">{session.authUser?.email ?? 'correo@asi.do'}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-dashed border-(--app-border) pt-4">
                          <div>
                            <span className="block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-(--app-text-subtle)">Idioma</span>
                            <strong className="mt-1 block text-sm font-semibold text-(--app-text)">{previewLocale}</strong>
                          </div>
                          <div>
                            <span className="block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-(--app-text-subtle)">País</span>
                            <strong className="mt-1 block truncate text-sm font-semibold text-(--app-text)">
                              {previewCountryLabel}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="hidden text-xs leading-5 text-(--app-text-subtle) md:block">
                    Este tour guarda solo lo necesario para activar la navegación. Lo demás queda disponible en tu perfil.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>

        <OnboardingFrame
          activeStep={isComplete ? 'done' : activeStep.id}
          completedStepCount={completedStepCount}
          onStepSelect={(stepIndex) => void goToStep(stepIndex)}
        />
      </div>

      {!isComplete ? (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex gap-3 border-t border-(--app-border) bg-(--app-surface-elevated)/90 px-4 py-3 shadow-[0_-18px_34px_rgba(21,32,59,0.12)] backdrop-blur md:hidden">
          <Button
            aria-label="Atrás"
            className="h-12 w-14 shrink-0 rounded-card px-0"
            disabled={activeStepIndex === 0 || form.formState.isSubmitting}
            variant="outline"
            onClick={() => setActiveStepIndex((value) => Math.max(value - 1, 0))}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <Button
            className="h-12 min-w-0 flex-1 rounded-card px-4"
            disabled={form.formState.isSubmitting || isPreparingAvatar}
            onClick={() => void handleNext()}
          >
            <span className="truncate">{primaryActionLabel}</span>
            <ArrowRight className="size-4 shrink-0" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
