import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
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
            Estamos terminando de preparar el servicio de autenticacion para habilitar acceso, onboarding y aprobaciones.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (session.isAuthenticated) {
    return <Navigate replace to={getAuthenticatedHomePath(session.permissions.includes('workspace:read'))} />
  }

  async function handleSubmit(values: SignInValues) {
    try {
      await signInWithPassword(values)
      toast.success('Sesion iniciada', {
        description: 'Ya puedes continuar tu perfil o entrar al espacio que te corresponda.'
      })
      await session.refresh()
      await navigate(surfacePaths.candidate.onboarding)
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
    <section>
      <div className="mb-8">
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-(--app-text) sm:text-[2.1rem]">
          Bienvenida de vuelta
        </h1>
        <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
          Inicia sesion para gestionar tus procesos de contratacion desde una vista clara y operativa.
        </p>
      </div>

      <Card className="border-(--app-border) bg-(--app-surface) shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <CardHeader className="space-y-3 border-b border-(--app-border) pb-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-primary-700 uppercase">
            Acceso seguro
          </div>
          <CardTitle className="text-2xl tracking-[-0.02em]">Entra a tu cuenta</CardTitle>
          <CardDescription className="max-w-sm text-sm leading-6">
            Usa tu correo y tu contrasena para volver a tu perfil o a tu espacio de trabajo.
          </CardDescription>
        </CardHeader>

        <div className="space-y-6 p-6 sm:p-7">
          <form className="space-y-4" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
            <label className="block space-y-2">
              <span className="text-xs font-semibold tracking-[-0.01em] text-(--app-text)">Correo corporativo</span>
              <Input autoComplete="email" className="h-11.5 rounded-[18px]" placeholder="tu@empresa.com" type="email" {...form.register('email')} />
              <FieldError message={form.formState.errors.email?.message} />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold tracking-[-0.01em] text-(--app-text)">Contrasena</span>
              <div className="relative">
                <Input
                  autoComplete="current-password"
                  className="h-11.5 rounded-[18px] pr-11"
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

            <Button className="mt-2 h-11.5 w-full rounded-[18px] text-sm" disabled={form.formState.isSubmitting} type="submit">
              {form.formState.isSubmitting ? 'Entrando...' : 'Iniciar sesion'}
            </Button>
          </form>

          <div className="rounded-panel border border-(--app-border) bg-(--app-surface-elevated) px-4 py-3 text-sm leading-6 text-(--app-text-muted)">
            Aun no tienes cuenta?{' '}
            <Link className="font-semibold text-primary-700 transition hover:text-primary-800 hover:underline dark:hover:text-primary-200" to={surfacePaths.auth.signUp}>
              Registrate
            </Link>
          </div>
        </div>
      </Card>
    </section>
  )
}
