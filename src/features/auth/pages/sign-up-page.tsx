import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AuthHeroPanel } from '@/features/auth/components/auth-hero-panel'
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
    return <Navigate replace to={session.permissions.includes('workspace:read') ? '/workspace' : '/candidate/profile'} />
  }

  async function handleSubmit(values: SignUpValues) {
    try {
      const data = await signUpWithPassword(values)

      if (data.session) {
        toast.success('Cuenta creada', {
          description: 'Tu usuario base ya existe. Vamos a completar el onboarding.'
        })
        await session.refresh()
        await navigate('/onboarding')
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
    <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
      <AuthHeroPanel
        eyebrow="Registro"
        title="Crea tu cuenta y empieza con una experiencia simple desde el primer minuto"
        description="Todo arranca con tu cuenta personal. Después completas tu perfil y, si tu empresa entra a la plataforma, sumas ese acceso más adelante."
      />

      <Card className="bg-[var(--app-surface)]">
        <CardHeader className="space-y-3">
          <div className="tm-kicker w-fit">
            Crear cuenta
          </div>
          <CardTitle>Crea tu usuario base</CardTitle>
          <CardDescription>
            Abre tu cuenta para descubrir vacantes, completar tu perfil y más adelante sumar a tu empresa si lo necesitas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="space-y-4" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
            <label className="space-y-2 text-sm font-medium text-[var(--app-text)]">
              <span>Nombre completo</span>
              <Input placeholder="Edgar Perez" {...form.register('fullName')} />
              <FieldError message={form.formState.errors.fullName?.message} />
            </label>

            <label className="space-y-2 text-sm font-medium text-[var(--app-text)]">
              <span>Email</span>
              <Input autoComplete="email" placeholder="tu@correo.com" type="email" {...form.register('email')} />
              <FieldError message={form.formState.errors.email?.message} />
            </label>

            <label className="space-y-2 text-sm font-medium text-[var(--app-text)]">
              <span>Contrasena</span>
              <Input autoComplete="new-password" placeholder="Minimo 8 caracteres" type="password" {...form.register('password')} />
              <FieldError message={form.formState.errors.password?.message} />
            </label>

            <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
              {form.formState.isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>

          <div className="rounded-[24px] border bg-[var(--app-surface)] px-4 py-4 text-sm leading-6 text-[var(--app-text-muted)]">
            Ya tienes cuenta?{' '}
            <Link className="font-semibold text-primary-700 transition hover:text-primary-800 hover:underline dark:hover:text-primary-200" to="/auth/sign-in">
              Inicia sesion
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
