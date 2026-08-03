import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/loader'
import { PasswordPolicyHints } from '@/features/auth/components/password-policy-hints'
import { signOutCurrentUser, toErrorMessage, updateAccountPassword } from '@/features/auth/lib/auth-api'
import { passwordResetSchema, type PasswordResetValues } from '@/features/auth/lib/auth-schemas'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-rose-600">{message}</p>
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<PasswordResetValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { password: '', confirmPassword: '' }
  })
  // `useWatch` y no `form.watch`: el compilador de React no puede memoizar el
  // segundo, igual que en la página de registro.
  const passwordValue = useWatch({ control: form.control, name: 'password' }) ?? ''

  if (!session.isSupabaseConfigured) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>La recuperación aún no está disponible</CardTitle>
          <CardDescription>
            Estamos terminando de preparar el servicio de autenticación para habilitar el restablecimiento de contraseñas.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // El enlace del correo llega con la sesión de recuperación en el fragmento de
  // la URL y el SDK la consume al arrancar, así que hasta que la sesión hidrata
  // no se puede distinguir «enlace inválido» de «todavía cargando».
  if (session.isLoading) {
    return <PageLoader className="min-h-full" label="Validando tu enlace" hint="Un momento" />
  }

  // Sin sesión aquí solo hay tres causas: el enlace caducó, ya se usó, o alguien
  // entró a la ruta a mano. Ninguna se arregla mostrando el formulario.
  if (!session.isAuthenticated) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Este enlace ya no sirve</CardTitle>
          <CardDescription>
            Los enlaces de recuperación caducan en una hora y solo pueden usarse una vez. Pide uno nuevo para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="h-12 rounded-control text-sm"
            onClick={() => void navigate(surfacePaths.auth.forgotPassword)}
          >
            Pedir un enlace nuevo
          </Button>
        </CardContent>
      </Card>
    )
  }

  async function handleSubmit(values: PasswordResetValues) {
    try {
      await updateAccountPassword(values.password)
      // Cerramos la sesión de recuperación a propósito: es una credencial de un
      // solo uso que llegó por correo, y dejarla viva después del cambio alarga
      // su vida sin razón. Además obliga a estrenar la contraseña nueva, que es la
      // única confirmación real de que quedó guardada.
      await signOutCurrentUser()
      await session.refresh()
      toast.success('Contraseña actualizada', {
        description: 'Inicia sesión con tu contraseña nueva.'
      })
      await navigate(surfacePaths.auth.signIn, { replace: true })
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos actualizar tu contraseña',
        source: 'auth.reset-password',
        route: surfacePaths.auth.resetPassword,
        userId: session.authUser?.id ?? null,
        error,
        description: toErrorMessage(error),
        userMessage: 'No pudimos actualizar tu contraseña.'
      })
    }
  }

  return (
    <section className="w-full">
      <div className="mb-8">
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-(--app-text) sm:text-[2.1rem]">
          Crea tu contraseña nueva
        </h1>
        <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
          Elige una contraseña que no uses en otro sitio. Al guardarla te pediremos iniciar sesión con ella.
        </p>
      </div>

      <form className="space-y-5" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-(--app-text)">Contraseña nueva</span>
          <div className="relative">
            <Input
              autoComplete="new-password"
              className="h-12 rounded-control pr-11"
              placeholder="Tu contraseña nueva"
              type={showPassword ? 'text' : 'password'}
              {...form.register('password')}
            />
            <button
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-(--app-text-subtle) transition hover:text-(--app-text)"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FieldError message={form.formState.errors.password?.message} />
          <PasswordPolicyHints value={passwordValue} />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-(--app-text)">Confirma la contraseña</span>
          <Input
            autoComplete="new-password"
            className="h-12 rounded-control"
            placeholder="Repite tu contraseña nueva"
            type={showPassword ? 'text' : 'password'}
            {...form.register('confirmPassword')}
          />
          <FieldError message={form.formState.errors.confirmPassword?.message} />
        </label>

        <Button className="h-12 w-full rounded-control text-sm" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar contraseña'}
        </Button>
      </form>
    </section>
  )
}
