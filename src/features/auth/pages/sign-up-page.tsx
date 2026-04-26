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
import { signUpWithPassword, toErrorMessage } from '@/features/auth/lib/auth-api'
import { signUpSchema, type SignUpValues } from '@/features/auth/lib/auth-schemas'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-rose-600">{message}</p>
}

export function SignUpPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
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
            Estamos terminando de preparar el servicio de autenticacion para habilitar registro, onboarding y aprobaciones.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (session.isAuthenticated) {
    return <Navigate replace to={getAuthenticatedHomePath(session.permissions.includes('workspace:read'))} />
  }

  async function handleSubmit(values: SignUpValues) {
    try {
      const data = await signUpWithPassword(values)

      if (data.session) {
        toast.success('Cuenta creada', {
          description: 'Tu usuario base ya existe. Vamos a completar el onboarding.'
        })
        await session.refresh()
        await navigate(surfacePaths.candidate.onboarding)
        return
      }

      toast.message('Cuenta creada', {
        description: 'Revisa tu correo para confirmar la cuenta y luego inicia sesion.'
      })
      await navigate('/auth/sign-in')
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos crear tu cuenta',
        source: 'auth.sign-up',
        route: '/auth/sign-up',
        userId: session.authUser?.id ?? null,
        error,
        description: toErrorMessage(error),
        userMessage: 'No pudimos crear tu cuenta en este momento.'
      })
    }
  }

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-(--app-text) sm:text-[2.1rem]">
          Crea tu espacio
        </h1>
        <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
          Configura tu cuenta base de ASI en menos de un minuto y luego completa tu onboarding.
        </p>
      </div>

      <Card className="border-(--app-border) bg-(--app-surface) shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <CardHeader className="space-y-3 border-b border-(--app-border) pb-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-primary-700 uppercase">
            Registro inicial
          </div>
          <CardTitle className="text-2xl tracking-[-0.02em]">Crea tu usuario base</CardTitle>
          <CardDescription className="max-w-sm text-sm leading-6">
            Empiezas con tu cuenta personal. El acceso a empresas y espacios de trabajo llega despues, segun tu caso.
          </CardDescription>
        </CardHeader>

        <div className="space-y-6 p-6 sm:p-7">
          <form className="space-y-4" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
            <label className="block space-y-2">
              <span className="text-xs font-semibold tracking-[-0.01em] text-(--app-text)">Nombre completo</span>
              <Input className="h-11.5 rounded-[18px]" placeholder="Maria Reyes" {...form.register('fullName')} />
              <FieldError message={form.formState.errors.fullName?.message} />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold tracking-[-0.01em] text-(--app-text)">Correo corporativo</span>
              <Input autoComplete="email" className="h-11.5 rounded-[18px]" placeholder="tu@empresa.com" type="email" {...form.register('email')} />
              <FieldError message={form.formState.errors.email?.message} />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold tracking-[-0.01em] text-(--app-text)">Contrasena</span>
              <div className="relative">
                <Input
                  autoComplete="new-password"
                  className="h-11.5 rounded-[18px] pr-11"
                  placeholder="Minimo 8 caracteres"
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
              {form.formState.isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>

          <div className="rounded-panel border border-(--app-border) bg-(--app-surface-elevated) px-4 py-3 text-sm leading-6 text-(--app-text-muted)">
            Ya tienes cuenta?{' '}
            <Link className="font-semibold text-primary-700 transition hover:text-primary-800 hover:underline dark:hover:text-primary-200" to={surfacePaths.auth.signIn}>
              Inicia sesion
            </Link>
          </div>
        </div>
      </Card>
    </section>
  )
}
