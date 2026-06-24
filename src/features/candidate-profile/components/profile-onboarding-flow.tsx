import { useEffect, useMemo, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Globe2,
  Search,
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { captureClientError } from '@/lib/errors/client-error-logger'
import {
  MAX_UPLOAD_SIZE_LABEL,
  ONBOARDING_AVATAR_MIME_TYPES,
  prepareUploadFile,
  UploadConstraintError
} from '@/lib/uploads/media'
import { cn } from '@/lib/utils/cn'

const steps = [
  {
    id: 'identity',
    label: 'Identidad',
    title: 'Como te presentamos',
    description: 'Dos nombres claros. Nada más.',
    icon: UserRound,
    fields: ['fullName', 'displayName'] satisfies FieldPath<OnboardingValues>[]
  },
  {
    id: 'context',
    label: 'Contexto',
    title: 'Idioma y país',
    description: 'ASI ajusta la experiencia inicial con estos datos.',
    icon: Globe2,
    fields: ['locale', 'countryCode'] satisfies FieldPath<OnboardingValues>[]
  },
  {
    id: 'avatar',
    label: 'Foto',
    title: 'Una foto ayuda, pero no bloquea',
    description: 'Puedes subirla ahora u omitirla sin perder progreso.',
    icon: Camera,
    fields: [] satisfies FieldPath<OnboardingValues>[]
  }
] as const

type StepId = (typeof steps)[number]['id'] | 'done'

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="min-h-4 text-xs text-rose-600 dark:text-rose-300">{message}</p>
}

function OnboardingFrame({
  activeStep,
  completedStepCount
}: {
  activeStep: StepId
  completedStepCount: number
}) {
  const activeIndex = activeStep === 'done' ? steps.length : steps.findIndex((step) => step.id === activeStep)
  const progress = Math.round((completedStepCount / steps.length) * 100)

  return (
    <aside className="relative overflow-hidden rounded-[28px] border border-(--app-border) bg-(--app-surface-muted) p-4 shadow-[0_24px_64px_rgba(21,32,59,0.08)] sm:p-5 lg:sticky lg:top-24">
      <div className="absolute inset-x-8 top-0 h-px bg-primary-300/60" />
      <div className="flex items-center justify-between gap-3">
        <Badge variant="soft" className="gap-1.5">
          <Sparkles className="size-3.5" />
          Tour guiado
        </Badge>
        <span className="text-xs font-semibold text-(--app-text-muted)">{progress}%</span>
      </div>

      <div className="mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-(--app-surface)">
          <motion.div
            className="h-full rounded-full bg-primary-600"
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 24 }}
          />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = index === activeIndex
          const isDone = index < completedStepCount || activeStep === 'done'

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 rounded-[18px] border p-3 transition',
                isActive
                  ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/12 dark:text-primary-100'
                  : 'border-transparent bg-(--app-surface-elevated) text-(--app-text-muted)'
              )}
            >
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-[14px]',
                  isDone ? 'bg-primary-600 text-white' : 'bg-(--app-surface) text-current'
                )}
              >
                {isDone ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-current">{step.label}</p>
                <p className="truncate text-xs text-(--app-text-muted)">{step.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-[22px] border border-(--app-border) bg-(--app-surface-elevated) p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary-600" />
          <p className="text-sm leading-6 text-(--app-text-muted)">
            Tus datos base habilitan el acceso. El CV, experiencia y solicitud de empresa pueden completarse despues.
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

  const activeStep = steps[activeStepIndex]
  const ActiveStepIcon = activeStep.icon
  const completedStepCount = isComplete ? steps.length : activeStepIndex
  const previewName = form.watch('displayName') || form.watch('fullName') || session.authUser?.email || 'Tu nombre'
  const previewCountry = form.watch('countryCode') || 'DO'
  const previewLocale = form.watch('locale') === 'en' ? 'English' : 'Espanol'
  const isLastStep = activeStepIndex === steps.length - 1

  const nextActions = useMemo(
    () => [
      {
        title: 'Explorar empleos',
        description: 'Busca oportunidades disponibles.',
        icon: Search,
        action: () => void navigate(surfacePaths.storefront.jobs)
      },
      {
        title: 'Completar CV',
        description: 'Agrega experiencia y documentos.',
        icon: UserRound,
        action: () => void navigate(surfacePaths.candidate.profile)
      },
      {
        title: session.permissions.includes('workspace:read') ? 'Ir al workspace' : 'Solicitar empresa',
        description: session.permissions.includes('workspace:read') ? 'Abre tu espacio operativo.' : 'Pide revisión para reclutar.',
        icon: BriefcaseBusiness,
        action: () =>
          void navigate(
            session.permissions.includes('workspace:read') ? surfacePaths.workspace.root : surfacePaths.candidate.recruiterRequest
          )
      }
    ],
    [navigate, session.permissions]
  )

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

      await session.refresh()
      setIsComplete(true)
      toast.success('Perfil listo', {
        description: 'Tu perfil base quedó preparado.'
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

  const slideTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 230, damping: 28, mass: 0.85 }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <main className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="soft">Perfil inicial</Badge>
            <h1 className="mt-3 text-[1.85rem] font-bold leading-tight text-(--app-text) sm:text-[2.25rem]">
              Dejemos tu cuenta lista
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-(--app-text-muted)">
              Un recorrido corto, obligatorio solo en lo esencial.
            </p>
          </div>
          {isComplete ? (
            <Button
              className="h-11 rounded-full px-4"
              variant="ghost"
              onClick={() => void navigate(surfacePaths.candidate.profile)}
            >
              Completar despues
            </Button>
          ) : null}
        </div>

        <section className="overflow-hidden rounded-[30px] border border-(--app-border) bg-(--app-surface-elevated) shadow-[0_24px_72px_rgba(21,32,59,0.08)]">
          <div className="grid min-h-128 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="p-5 sm:p-7">
              <AnimatePresence mode="wait">
                {isComplete ? (
                  <motion.div
                    key="done"
                    animate={{ opacity: 1, y: 0 }}
                    className="flex min-h-108 flex-col justify-between"
                    exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
                    initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 14 }}
                    transition={slideTransition}
                  >
                    <div>
                      <div className="flex size-14 items-center justify-center rounded-panel bg-primary-600 text-white">
                        <CheckCircle2 className="size-7" />
                      </div>
                      <h2 className="mt-5 text-[1.65rem] font-bold leading-tight text-(--app-text) sm:text-[2rem]">
                        Listo, {previewName.split(' ')[0]}
                      </h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-(--app-text-muted)">
                        Ya tienes la base para moverte por ASI. Lo profesional y lo empresarial puede crecer paso a paso.
                      </p>
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                      {nextActions.map((item) => {
                        const Icon = item.icon

                        return (
                          <button
                            key={item.title}
                            className="group flex min-h-36 flex-col justify-between rounded-[22px] border border-(--app-border) bg-(--app-surface) p-4 text-left transition hover:border-primary-300 hover:bg-primary-50 dark:hover:border-primary-500/30 dark:hover:bg-primary-500/12"
                            type="button"
                            onClick={item.action}
                          >
                            <Icon className="size-5 text-primary-600 dark:text-primary-200" />
                            <span>
                              <span className="block text-sm font-semibold text-(--app-text)">{item.title}</span>
                              <span className="mt-1 block text-xs leading-5 text-(--app-text-muted)">{item.description}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={activeStep.id}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex min-h-108 flex-col justify-between"
                    exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -18 }}
                    initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 18 }}
                    transition={slideTransition}
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-[18px] bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-100">
                          <ActiveStepIcon className="size-5" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-(--app-text-subtle)">
                          Paso {activeStepIndex + 1} de {steps.length}
                        </span>
                      </div>

                      <h2 className="mt-5 text-[1.65rem] font-bold leading-tight text-(--app-text) sm:text-[2rem]">
                        {activeStep.title}
                      </h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-(--app-text-muted)">
                        {activeStep.description}
                      </p>

                      <form className="mt-7 space-y-5" onSubmit={(event) => event.preventDefault()}>
                        {activeStep.id === 'identity' ? (
                          <>
                            <label className="block space-y-1.5">
                              <span className="text-[13px] font-semibold text-(--app-text)">Nombre completo</span>
                              <Input
                                autoComplete="name"
                                className="h-13 rounded-2xl"
                                placeholder="Ej. John Doe"
                                {...form.register('fullName')}
                              />
                              <FieldError message={form.formState.errors.fullName?.message} />
                            </label>

                            <label className="block space-y-1.5">
                              <span className="text-[13px] font-semibold text-(--app-text)">Nombre visible</span>
                              <Input
                                className="h-13 rounded-2xl"
                                placeholder="Ej. John D."
                                {...form.register('displayName')}
                              />
                              <FieldError message={form.formState.errors.displayName?.message} />
                            </label>
                          </>
                        ) : null}

                        {activeStep.id === 'context' ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block space-y-1.5">
                              <span className="text-[13px] font-semibold text-(--app-text)">Idioma</span>
                              <Select className="h-13 rounded-2xl" {...form.register('locale')}>
                                <option value="es">Espanol</option>
                                <option value="en">English</option>
                              </Select>
                            </label>

                            <label className="block space-y-1.5">
                              <span className="text-[13px] font-semibold text-(--app-text)">País</span>
                              <CountryCodeSelect className="h-13 rounded-2xl" {...form.register('countryCode')} />
                              <FieldError message={form.formState.errors.countryCode?.message} />
                            </label>
                          </div>
                        ) : null}

                        {activeStep.id === 'avatar' ? (
                          <div className="space-y-4">
                            <label className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-primary-300 bg-primary-50/70 px-4 py-8 text-center transition hover:bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10">
                              <UploadCloud className="size-8 text-primary-600 dark:text-primary-200" />
                              <span className="mt-3 text-sm font-semibold text-(--app-text)">Subir foto</span>
                              <span className="mt-1 max-w-xs text-xs leading-5 text-(--app-text-muted)">
                                SVG, PNG, JPG o WEBP. Limite {MAX_UPLOAD_SIZE_LABEL}.
                              </span>
                              <input
                                accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                                className="sr-only"
                                type="file"
                                onChange={(event) => void handleAvatarChange(event.target.files?.[0] ?? null)}
                              />
                            </label>
                            {isPreparingAvatar ? (
                              <p className="text-xs text-(--app-text-subtle)">Optimizando foto...</p>
                            ) : null}
                            {avatarFileError ? <p className="text-xs text-rose-600 dark:text-rose-300">{avatarFileError}</p> : null}
                          </div>
                        ) : null}
                      </form>
                    </div>

                    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        className="h-12 rounded-2xl px-4"
                        disabled={activeStepIndex === 0 || form.formState.isSubmitting}
                        variant="outline"
                        onClick={() => setActiveStepIndex((value) => Math.max(value - 1, 0))}
                      >
                        <ArrowLeft className="size-4" />
                        Atras
                      </Button>
                      <Button
                        className="h-12 rounded-2xl px-5"
                        disabled={form.formState.isSubmitting || isPreparingAvatar}
                        onClick={() => void handleNext()}
                      >
                        {form.formState.isSubmitting ? 'Guardando...' : isLastStep ? 'Guardar y entrar' : 'Continuar'}
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-(--app-border) bg-(--app-surface-muted) p-5 lg:border-t-0 lg:border-l">
              <div className="flex h-full flex-col justify-between gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--app-text-subtle)">Vista viva</p>
                  <div className="mt-4 rounded-[24px] border border-(--app-border) bg-(--app-surface-elevated) p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-panel bg-primary-100 text-xs font-semibold text-primary-700">
                        {avatarPreviewUrl ? (
                          <img alt="Vista previa de avatar" className="h-full w-full object-cover" src={avatarPreviewUrl} />
                        ) : (
                          'Foto'
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-(--app-text)">{previewName}</p>
                        <p className="truncate text-xs text-(--app-text-muted)">{session.authUser?.email ?? 'correo@asi.do'}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-[14px] bg-(--app-surface) p-3">
                        <span className="block text-(--app-text-subtle)">Idioma</span>
                        <strong className="mt-1 block text-(--app-text)">{previewLocale}</strong>
                      </div>
                      <div className="rounded-[14px] bg-(--app-surface) p-3">
                        <span className="block text-(--app-text-subtle)">País</span>
                        <strong className="mt-1 block text-(--app-text)">{previewCountry.toUpperCase()}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs leading-5 text-(--app-text-subtle)">
                  Este tour guarda solo lo necesario para activar la navegacion. Lo demas queda disponible en tu perfil.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <OnboardingFrame
        activeStep={isComplete ? 'done' : activeStep.id}
        completedStepCount={completedStepCount}
      />
    </div>
  )
}
