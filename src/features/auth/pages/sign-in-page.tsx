import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { getAuthenticatedHomePath, surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { signInWithPassword, toErrorMessage } from '@/features/auth/lib/auth-api'
import { signInSchema, type SignInValues } from '@/features/auth/lib/auth-schemas'
import { hasCompletedBaseOnboarding } from '@/features/auth/lib/onboarding-status'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-rose-600">{message}</p>
}

export function SignInPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  if (!session.isSupabaseConfigured) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>El acceso aun no esta disponible</CardTitle>
          <CardDescription>
            Estamos terminando de preparar el servicio de autenticacion para habilitar acceso, perfil inicial y aprobaciones.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (session.isAuthenticated) {
    return (
      <Navigate
        replace
        to={getAuthenticatedHomePath(
          session.permissions.includes('workspace:read'),
          hasCompletedBaseOnboarding(session.profile)
        )}
      />
    )
  }

  async function handleSubmit(values: SignInValues) {
    try {
      await signInWithPassword(values)
      toast.success('Sesion iniciada', {
        description: 'Te llevaremos al siguiente paso para dejar tu cuenta lista.'
      })
      await session.refresh()
      // Tras el refresh, `isAuthenticated` pasa a true y el <Navigate> de arriba
      // redirige al home correcto (workspace o candidato) según permisos.
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos iniciar sesion',
        source: 'auth.sign-in',
        route: '/auth/sign-in',
        userId: session.authUser?.id ?? null,
        error,
        description: toErrorMessage(error),
        userMessage: 'No pudimos iniciar sesion con esas credenciales.'
      })
    }
  }

  return (
    <section className="w-full">
      <div className="mb-8">
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-(--app-text) sm:text-[2.1rem]">
          Bienvenida de vuelta
        </h1>
        <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
          Inicia sesion para gestionar tus procesos de contratacion.
        </p>
      </div>

      <form className="space-y-5" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-(--app-text)">Correo corporativo</span>
          <Input
            autoComplete="email"
            className="h-12 rounded-[14px]"
            placeholder="maria.reyes@empresa.com.do"
            type="email"
            {...form.register('email')}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </label>

        <label className="block space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-(--app-text)">Contrasena</span>
            <button
              className="text-xs font-medium text-primary-600 transition hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
              type="button"
              onClick={() =>
                toast('Recuperacion de contrasena', {
                  description:
                    'Escribenos a soporte@asi.do y te ayudamos a restablecer el acceso mientras habilitamos el flujo automatico.'
                })
              }
            >
              Olvidaste tu contrasena?
            </button>
          </div>
          <div className="relative">
            <Input
              autoComplete="current-password"
              className="h-12 rounded-[14px] pr-11"
              placeholder="Tu contrasena"
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
          <FieldError message={form.formState.errors.password?.message} />
        </label>

        <Button
          className="h-12 w-full rounded-[14px] text-sm"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Entrando...' : 'Iniciar sesion'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-(--app-text-muted)">
        No tienes una cuenta?{' '}
        <button
          className="font-semibold text-primary-600 transition hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
          type="button"
          onClick={() => void navigate(surfacePaths.auth.signUp)}
        >
          Registrate
        </button>
      </p>
    </section>
  )
}
