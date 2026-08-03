import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { requestPasswordRecovery, toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  passwordRecoveryRequestSchema,
  type PasswordRecoveryRequestValues
} from '@/features/auth/lib/auth-schemas'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-rose-600">{message}</p>
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [sentToEmail, setSentToEmail] = useState<string | null>(null)
  const form = useForm<PasswordRecoveryRequestValues>({
    resolver: zodResolver(passwordRecoveryRequestSchema),
    defaultValues: { email: '' }
  })

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

  async function handleSubmit(values: PasswordRecoveryRequestValues) {
    try {
      await requestPasswordRecovery(values.email)
      setSentToEmail(values.email)
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos enviar el enlace',
        source: 'auth.forgot-password',
        route: surfacePaths.auth.forgotPassword,
        userId: null,
        error,
        description: toErrorMessage(error),
        userMessage: 'No pudimos enviar el enlace de recuperación.'
      })
    }
  }

  // Confirmación deliberadamente idéntica exista o no la cuenta: decir «ese
  // correo no está registrado» convierte esta pantalla en un verificador de
  // quién tiene cuenta en ASI.
  if (sentToEmail) {
    return (
      <section className="w-full">
        <div className="mb-8 flex flex-col items-start gap-4">
          <span className="flex size-11 items-center justify-center rounded-control bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
            <MailCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-(--app-text) sm:text-[2.1rem]">
              Revisa tu correo
            </h1>
            <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
              Si <span className="font-semibold text-(--app-text)">{sentToEmail}</span> tiene una cuenta en ASI, le
              acabamos de enviar un enlace para crear una contraseña nueva. El enlace caduca en una hora y solo puede
              usarse una vez.
            </p>
          </div>
        </div>

        <Button
          className="h-12 w-full rounded-control text-sm"
          variant="outline"
          onClick={() => void navigate(surfacePaths.auth.signIn)}
        >
          Volver al acceso
        </Button>

        <p className="mt-6 text-center text-sm text-(--app-text-muted)">
          ¿No te llegó?{' '}
          <button
            className="font-semibold text-primary-600 transition hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
            type="button"
            onClick={() => setSentToEmail(null)}
          >
            Intenta otra vez
          </button>
        </p>
      </section>
    )
  }

  return (
    <section className="w-full">
      <div className="mb-8">
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-(--app-text) sm:text-[2.1rem]">
          Recupera tu acceso
        </h1>
        <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
          Escribe el correo de tu cuenta y te enviamos un enlace para crear una contraseña nueva.
        </p>
      </div>

      <form className="space-y-5" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-(--app-text)">Correo</span>
          <Input
            autoComplete="email"
            className="h-12 rounded-control"
            placeholder="john.doe@empresa.com.do"
            type="email"
            {...form.register('email')}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </label>

        <Button className="h-12 w-full rounded-control text-sm" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting ? 'Enviando...' : 'Enviar enlace'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-(--app-text-muted)">
        ¿Ya la recordaste?{' '}
        <Link
          className="font-semibold text-primary-600 transition hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
          to={surfacePaths.auth.signIn}
        >
          Inicia sesión
        </Link>
      </p>
    </section>
  )
}
