import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { getAuthenticatedHomePath, surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/loader'
import { signUpFormSchema, type SignUpFormValues } from '@/features/auth/lib/auth-schemas'
import { Input } from '@/components/ui/input'
import { signUpWithPassword, toErrorMessage } from '@/features/auth/lib/auth-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { PLATFORM_REGISTRATION_LOCKED, PLATFORM_REGISTRATION_LOCKED_MESSAGE } from '@/shared/config/launch-access'

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-rose-600 dark:text-rose-300">{message}</p>
}

const passwordRules = [
  { label: 'Mínimo 8 caracteres', test: (value: string) => value.length >= 8 },
  { label: 'Una letra mayúscula', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Un número', test: (value: string) => /\d/.test(value) }
] as const

export function SignUpPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  })
  const passwordValue = useWatch({ control: form.control, name: 'password' }) ?? ''

  if (!session.isSupabaseConfigured) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>El registro aún no está disponible</CardTitle>
          <CardDescription>
            Estamos terminando de preparar el servicio de autenticación para habilitar la creación de cuentas.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (session.isLoading) {
    return <PageLoader fullScreen label="Preparando tu plataforma" hint="Cargando tu menú y tu cuenta" />
  }

  if (session.isAuthenticated) {
    return <Navigate replace to={getAuthenticatedHomePath(session.permissions.includes('workspace:read'))} />
  }

  async function handleSubmit(values: SignUpFormValues) {
    try {
      const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim()
      const result = await signUpWithPassword({
        email: values.email,
        password: values.password,
        fullName
      })

      if (result.session) {
        await session.refresh()
        toast.success('Cuenta creada', {
          description: 'Vamos a completar tu perfil para dejar tu espacio listo.'
        })
        await navigate(surfacePaths.candidate.profile)
        return
      }

      toast.success('Revisa tu correo', {
        description: 'Te enviamos un enlace para confirmar tu cuenta y preparar tu perfil.'
      })
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos crear tu cuenta',
        source: 'auth.sign-up',
        route: '/auth/sign-up',
        userId: session.authUser?.id ?? null,
        error,
        description: toErrorMessage(error),
        userMessage: 'No pudimos crear tu cuenta con esos datos.'
      })
    }
  }

  return (
    <section className="w-full">
      <div className="mb-3">
        <h1 className="text-[1.55rem] font-bold tracking-[-0.03em] text-(--app-text) sm:text-[1.72rem]">
          Crea tu espacio
        </h1>
        <p className="mt-1 text-[13px] leading-5 text-(--app-text-muted)">
          Configura tu cuenta de ASI en menos de un minuto.
        </p>
      </div>

      <form className="space-y-2.5" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <label className="block space-y-0.5">
            <span className="text-xs font-semibold text-(--app-text)">Nombre</span>
            <Input className="h-9 rounded-[12px]" placeholder="John" {...form.register('firstName')} />
            <FieldError message={form.formState.errors.firstName?.message} />
          </label>

          <label className="block space-y-0.5">
            <span className="text-xs font-semibold text-(--app-text)">Apellido</span>
            <Input className="h-9 rounded-[12px]" placeholder="Doe" {...form.register('lastName')} />
            <FieldError message={form.formState.errors.lastName?.message} />
          </label>

          <label className="block space-y-0.5">
            <span className="text-xs font-semibold text-(--app-text)">Correo</span>
            <Input
              autoComplete="email"
              className="h-9 rounded-[12px] px-2.5 text-xs"
              placeholder="tu@empresa.com.do"
              type="email"
              {...form.register('email')}
            />
            <FieldError message={form.formState.errors.email?.message} />
          </label>
        </div>

        <label className="block space-y-0.5">
          <span className="text-xs font-semibold text-(--app-text)">Contraseña</span>
          <div className="relative">
            <Input
              autoComplete="new-password"
              className="h-9 rounded-[12px] pr-10"
              placeholder="Crea una contraseña segura"
              type={showPassword ? 'text' : 'password'}
              {...form.register('password')}
            />
            <button
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-(--app-text-subtle) transition hover:text-(--app-text)"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FieldError message={form.formState.errors.password?.message} />
          <ul className="grid gap-1 pt-0.5 sm:grid-cols-3">
            {passwordRules.map((rule) => {
              const passed = rule.test(passwordValue)

              return (
                <li
                  key={rule.label}
                  className={
                    passed
                      ? 'flex items-center gap-1 text-[11px] leading-4 text-emerald-600 dark:text-emerald-400'
                      : 'flex items-center gap-1 text-[11px] leading-4 text-(--app-text-subtle)'
                  }
                >
                  <span
                    className={
                      passed
                        ? 'flex size-3.5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'flex size-3.5 items-center justify-center rounded-full border border-(--app-border)'
                    }
                  >
                    {passed ? <Check className="size-2.5" strokeWidth={3} /> : null}
                  </span>
                  {rule.label}
                </li>
              )
            })}
          </ul>
        </label>

        <label className="block space-y-0.5">
          <span className="text-xs font-semibold text-(--app-text)">Confirmar contraseña</span>
          <div className="relative">
            <Input
              autoComplete="new-password"
              className="h-9 rounded-[12px] pr-10"
              placeholder="Repite tu contraseña"
              type={showConfirmPassword ? 'text' : 'password'}
              {...form.register('confirmPassword')}
            />
            <button
              aria-label={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-(--app-text-subtle) transition hover:text-(--app-text)"
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FieldError message={form.formState.errors.confirmPassword?.message} />
        </label>

        <Button
          className="h-9 w-full rounded-[12px] text-sm"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Creando cuenta...' : 'Continuar'}
          {form.formState.isSubmitting ? null : <ArrowRight className="size-4" />}
        </Button>
      </form>

      <p className="mt-3 text-center text-sm text-(--app-text-muted)">
        ¿Ya tienes cuenta?{' '}
        <button
          className="font-semibold text-primary-600 transition hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
          type="button"
          onClick={() => void navigate(surfacePaths.auth.signIn)}
        >
          Inicia sesión
        </button>
      </p>

      {PLATFORM_REGISTRATION_LOCKED ? (
        <div className="mt-3 rounded-[14px] border border-(--app-border) bg-(--app-surface-elevated) px-4 py-3 text-xs leading-5 text-(--app-text-subtle)">
          {PLATFORM_REGISTRATION_LOCKED_MESSAGE}
        </div>
      ) : null}
    </section>
  )
}
