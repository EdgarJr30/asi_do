import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { getAuthenticatedHomePath, surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  { label: 'Minimo 8 caracteres', test: (value: string) => value.length >= 8 },
  { label: 'Una letra mayuscula', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Un numero', test: (value: string) => /\d/.test(value) }
] as const

export function SignUpPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: ''
    }
  })

  if (!session.isSupabaseConfigured) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>El registro aun no esta disponible</CardTitle>
          <CardDescription>
            Estamos terminando de preparar el servicio de autenticacion para habilitar la creacion de cuentas.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (session.isAuthenticated) {
    return <Navigate replace to={getAuthenticatedHomePath(session.permissions.includes('workspace:read'))} />
  }

  const passwordValue = form.watch('password') ?? ''

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
      <div className="mb-8">
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-(--app-text) sm:text-[2.1rem]">
          Crea tu espacio
        </h1>
        <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
          Configura tu cuenta de ASI ATS en menos de un minuto.
        </p>
      </div>

      <form className="space-y-5" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-(--app-text)">Nombre</span>
            <Input className="h-12 rounded-[14px]" placeholder="Maria" {...form.register('firstName')} />
            <FieldError message={form.formState.errors.firstName?.message} />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-(--app-text)">Apellido</span>
            <Input className="h-12 rounded-[14px]" placeholder="Reyes" {...form.register('lastName')} />
            <FieldError message={form.formState.errors.lastName?.message} />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-(--app-text)">Correo corporativo</span>
          <Input
            autoComplete="email"
            className="h-12 rounded-[14px]"
            placeholder="tu@empresa.com.do"
            type="email"
            {...form.register('email')}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-(--app-text)">Contrasena</span>
          <div className="relative">
            <Input
              autoComplete="new-password"
              className="h-12 rounded-[14px] pr-11"
              placeholder="Crea una contrasena segura"
              type={showPassword ? 'text' : 'password'}
              {...form.register('password')}
            />
            <button
              aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-(--app-text-subtle) transition hover:text-(--app-text)"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <ul className="grid gap-1.5 pt-1 sm:grid-cols-2">
            {passwordRules.map((rule) => {
              const passed = rule.test(passwordValue)

              return (
                <li
                  key={rule.label}
                  className={
                    passed
                      ? 'flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400'
                      : 'flex items-center gap-1.5 text-xs text-(--app-text-subtle)'
                  }
                >
                  <span
                    className={
                      passed
                        ? 'flex size-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'flex size-4 items-center justify-center rounded-full border border-(--app-border)'
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

        <Button
          className="h-12 w-full rounded-[14px] text-sm"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Creando cuenta...' : 'Continuar'}
          {form.formState.isSubmitting ? null : <ArrowRight className="size-4" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-(--app-text-muted)">
        Ya tienes cuenta?{' '}
        <button
          className="font-semibold text-primary-600 transition hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
          type="button"
          onClick={() => void navigate(surfacePaths.auth.signIn)}
        >
          Inicia sesion
        </button>
      </p>

      {PLATFORM_REGISTRATION_LOCKED ? (
        <div className="mt-6 rounded-[14px] border border-(--app-border) bg-(--app-surface-elevated) px-4 py-3 text-xs leading-5 text-(--app-text-subtle)">
          {PLATFORM_REGISTRATION_LOCKED_MESSAGE}
        </div>
      ) : null}
    </section>
  )
}
