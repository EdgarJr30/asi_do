import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  bootstrapFirstPlatformOwner,
  signInWithPassword,
  signOutCurrentUser,
  signUpWithPassword,
  toErrorMessage
} from '@/features/auth/lib/auth-api'
import { signInSchema, signUpSchema, type SignInValues, type SignUpValues } from '@/features/auth/lib/auth-schemas'

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-rose-600 dark:text-rose-300">{message}</p>
}

export function AuthPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: ''
    }
  })

  async function handleSignIn(values: SignInValues) {
    try {
      await signInWithPassword(values)
      toast.success('Sesion iniciada', {
        description: 'Ya puedes completar tu perfil o solicitar validacion recruiter.'
      })
      await session.refresh()
      await navigate('/onboarding')
    } catch (error) {
      toast.error('No pudimos iniciar sesion', {
        description: toErrorMessage(error)
      })
    }
  }

  async function handleSignUp(values: SignUpValues) {
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
      setMode('signin')
    } catch (error) {
      toast.error('No pudimos crear tu cuenta', {
        description: toErrorMessage(error)
      })
    }
  }

  async function handleBootstrapOwner() {
    setIsBootstrapping(true)

    try {
      await bootstrapFirstPlatformOwner()
      await session.refresh()
      toast.success('Primer admin inicializado', {
        description: 'Tu cuenta ya puede revisar solicitudes recruiter y operar la plataforma.'
      })
      await navigate('/admin/recruiter-requests')
    } catch (error) {
      toast.error('No se pudo reclamar el rol inicial', {
        description: toErrorMessage(error)
      })
    } finally {
      setIsBootstrapping(false)
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true)

    try {
      await signOutCurrentUser()
      toast.success('Sesion cerrada')
      await navigate('/auth')
    } catch (error) {
      toast.error('No se pudo cerrar la sesion', {
        description: toErrorMessage(error)
      })
    } finally {
      setIsSigningOut(false)
    }
  }

  if (!session.isSupabaseConfigured) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <Badge variant="soft">Config requerida</Badge>
          <CardTitle>Supabase aun no esta configurado</CardTitle>
          <CardDescription>
            Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para habilitar registro, onboarding y aprobaciones.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (session.isAuthenticated) {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-primary-100 bg-[linear-gradient(135deg,#f0fdf4,white_42%,#eff6ff)] dark:border-zinc-800 dark:bg-[linear-gradient(135deg,rgba(11,20,16,0.96),rgba(9,9,11,0.95)_45%,rgba(10,18,28,0.94))]">
          <CardHeader>
            <Badge variant="soft">Sesion activa</Badge>
            <CardTitle>{session.profile?.display_name ?? session.authUser?.email ?? 'Usuario activo'}</CardTitle>
            <CardDescription>
              Todos los registros comienzan como usuario normal. Desde aqui puedes completar tu perfil y solicitar acceso recruiter.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Cuenta</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {session.authUser?.email ?? 'Sin correo'}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Locale: {session.profile?.locale ?? 'pendiente'} · Pais: {session.profile?.country_code ?? 'pendiente'}
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Estado recruiter</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {session.memberships.length > 0 ? 'Ya tienes acceso employer' : 'Aun sin tenant validado'}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {session.memberships.length > 0
                  ? `Tenant activo: ${session.primaryMembership?.tenantName ?? 'Tenant'}`
                  : 'Necesitas una aprobacion admin para aparecer como empresa recruiter.'}
              </p>
            </div>

            <Button className="w-full" onClick={() => void navigate('/onboarding')}>
              Completar onboarding
            </Button>
            <Button className="w-full" variant="outline" onClick={() => void navigate('/recruiter-request')}>
              Solicitar validacion recruiter
            </Button>

            {session.canReviewRecruiterRequests ? (
              <Button
                className="w-full sm:col-span-2"
                variant="secondary"
                onClick={() => void navigate('/admin/recruiter-requests')}
              >
                Abrir review admin
              </Button>
            ) : null}

            <Button className="w-full sm:col-span-2" variant="ghost" onClick={() => void handleSignOut()} disabled={isSigningOut}>
              {isSigningOut ? 'Cerrando sesion...' : 'Cerrar sesion'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="outline">Bootstrap</Badge>
            <CardTitle>Primer admin de plataforma</CardTitle>
            <CardDescription>
              Este boton solo funciona una vez. Sirve para inicializar el primer `platform_owner` desde la app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Usa este paso solo si todavia nadie puede aprobar `recruiter_requests`. Si ya existe un owner activo, Supabase rechazara la accion.
            </p>
            <Button className="w-full" onClick={() => void handleBootstrapOwner()} disabled={isBootstrapping}>
              {isBootstrapping ? 'Inicializando...' : 'Reclamar primer admin'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-primary-100 bg-[linear-gradient(145deg,#ecfeff,white_35%,#f0fdf4)] dark:border-zinc-800 dark:bg-[linear-gradient(145deg,rgba(9,20,26,0.96),rgba(9,9,11,0.94)_40%,rgba(9,20,16,0.95))]">
        <CardHeader>
          <Badge variant="soft">Auth + onboarding</Badge>
          <CardTitle className="max-w-xl text-2xl sm:text-3xl">
            Registro base para todos los usuarios y aprobacion administrativa para recruiters
          </CardTitle>
          <CardDescription className="max-w-xl">
            Nadie entra como recruiter desde el signup. Primero se registra como usuario normal, completa su perfil y luego solicita validacion de empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
          <div className="rounded-3xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/75">
            1. Crear cuenta base con email y contrasena.
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/75">
            2. Completar perfil estandar con locale, pais y avatar.
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/75">
            3. Enviar solicitud recruiter con datos de empresa y documentos privados.
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/75">
            4. Un admin revisa y, si aprueba, se crea el tenant y la primera membership owner.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex gap-2">
            <Button variant={mode === 'signup' ? 'primary' : 'outline'} onClick={() => setMode('signup')}>
              Crear cuenta
            </Button>
            <Button variant={mode === 'signin' ? 'primary' : 'outline'} onClick={() => setMode('signin')}>
              Iniciar sesion
            </Button>
          </div>
          <CardTitle>{mode === 'signup' ? 'Crea tu usuario base' : 'Entra a tu cuenta'}</CardTitle>
          <CardDescription>
            {mode === 'signup'
              ? 'Usa este formulario para crear el usuario inicial de plataforma.'
              : 'Si ya tienes cuenta, entra para continuar onboarding o revisar solicitudes.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'signup' ? (
            <form className="space-y-4" onSubmit={(event) => void signUpForm.handleSubmit(handleSignUp)(event)}>
              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Nombre completo</span>
                <Input placeholder="Edgar Perez" {...signUpForm.register('fullName')} />
                <FieldError message={signUpForm.formState.errors.fullName?.message} />
              </label>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Email</span>
                <Input autoComplete="email" placeholder="tu@correo.com" type="email" {...signUpForm.register('email')} />
                <FieldError message={signUpForm.formState.errors.email?.message} />
              </label>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Contrasena</span>
                <Input autoComplete="new-password" placeholder="Minimo 8 caracteres" type="password" {...signUpForm.register('password')} />
                <FieldError message={signUpForm.formState.errors.password?.message} />
              </label>

              <Button className="w-full" disabled={signUpForm.formState.isSubmitting} type="submit">
                {signUpForm.formState.isSubmitting ? 'Creando cuenta...' : 'Crear usuario base'}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void signInForm.handleSubmit(handleSignIn)(event)}>
              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Email</span>
                <Input autoComplete="email" placeholder="tu@correo.com" type="email" {...signInForm.register('email')} />
                <FieldError message={signInForm.formState.errors.email?.message} />
              </label>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Contrasena</span>
                <Input autoComplete="current-password" placeholder="Tu contrasena" type="password" {...signInForm.register('password')} />
                <FieldError message={signInForm.formState.errors.password?.message} />
              </label>

              <Button className="w-full" disabled={signInForm.formState.isSubmitting} type="submit">
                {signInForm.formState.isSubmitting ? 'Entrando...' : 'Iniciar sesion'}
              </Button>
            </form>
          )}

          <div className="mt-4 rounded-3xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-400">
            Si lo prefieres, puedes volver al <Link className="font-semibold text-primary-600" to="/">dashboard</Link> y seguir el flujo desde ahi.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
