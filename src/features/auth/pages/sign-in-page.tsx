import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { signInWithPassword, toErrorMessage } from '@/features/auth/lib/auth-api'
import { signInSchema, type SignInValues } from '@/features/auth/lib/auth-schemas'
import { AuthHeroPanel } from '@/features/auth/components/auth-hero-panel'
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
    return <Navigate replace to={session.permissions.includes('workspace:read') ? '/workspace' : '/candidate/profile'} />
  }

  async function handleSubmit(values: SignInValues) {
    try {
      await signInWithPassword(values)
      toast.success('Sesion iniciada', {
        description: 'Ya puedes continuar tu perfil o entrar al espacio que te corresponda.'
      })
      await session.refresh()
      await navigate('/onboarding')
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
    <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
      <AuthHeroPanel
        eyebrow="Acceso"
        title="Vuelve a tu cuenta y sigue justo donde lo dejaste"
        description="Entra a tu perfil, revisa tus procesos o retoma el trabajo de tu equipo con un acceso simple y directo."
      />

      <Card className="bg-[var(--app-surface)]">
        <CardHeader className="space-y-3">
          <div className="tm-kicker w-fit">
            Iniciar sesion
          </div>
          <CardTitle>Entra a tu cuenta</CardTitle>
          <CardDescription>
            Usa tu correo y tu contrasena para volver a tus vacantes, tu perfil o el espacio de tu empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="space-y-4" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
            <label className="space-y-2 text-sm font-medium text-[var(--app-text)]">
              <span>Email</span>
              <Input autoComplete="email" placeholder="tu@correo.com" type="email" {...form.register('email')} />
              <FieldError message={form.formState.errors.email?.message} />
            </label>

            <label className="space-y-2 text-sm font-medium text-[var(--app-text)]">
              <span>Contrasena</span>
              <Input autoComplete="current-password" placeholder="Tu contrasena" type="password" {...form.register('password')} />
              <FieldError message={form.formState.errors.password?.message} />
            </label>

            <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
              {form.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="rounded-[24px] border bg-[var(--app-surface)] px-4 py-4 text-sm leading-6 text-[var(--app-text-muted)]">
            Aun no tienes cuenta?{' '}
            <Link className="font-semibold text-primary-700 transition hover:text-primary-800 hover:underline dark:hover:text-primary-200" to="/auth/sign-up">
              Crea tu cuenta
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
