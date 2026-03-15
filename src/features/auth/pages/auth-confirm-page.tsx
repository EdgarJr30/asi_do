import { useEffect, useRef, useState } from 'react'

import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { completeAuthConfirmation, toErrorMessage } from '@/features/auth/lib/auth-api'
import { resolveAuthCallback } from '@/features/auth/lib/auth-callback'

export function AuthConfirmPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const session = useAppSession()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasStartedRef = useRef(false)

  useEffect(() => {
    if (hasStartedRef.current) {
      return
    }

    hasStartedRef.current = true

    let isActive = true
    const callback = resolveAuthCallback(searchParams)

    async function confirmAuth() {
      if (!session.isSupabaseConfigured) {
        if (!isActive) {
          return
        }

        setStatus('error')
        setErrorMessage('Supabase no esta configurado para procesar esta confirmacion.')
        return
      }

      try {
        await completeAuthConfirmation({
          code: callback.code,
          tokenHash: callback.tokenHash,
          type: callback.type
        })
        await session.refresh()

        if (!isActive) {
          return
        }

        toast.success('Correo confirmado', {
          description: 'Tu cuenta ya puede iniciar sesion y continuar el onboarding.'
        })
        await navigate(callback.nextPath, { replace: true })
      } catch (error) {
        if (!isActive) {
          return
        }

        setStatus('error')
        setErrorMessage(toErrorMessage(error))
      }
    }

    void confirmAuth()

    return () => {
      isActive = false
    }
  }, [navigate, searchParams, session])

  if (status === 'error') {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <Badge variant="soft">Auth callback</Badge>
          <CardTitle>No pudimos confirmar tu correo</CardTitle>
          <CardDescription>
            El enlace de confirmacion no se pudo completar correctamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{errorMessage ?? 'Error inesperado.'}</p>
          <Button onClick={() => void navigate('/auth', { replace: true })}>Volver a Auth</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <Badge variant="soft">Auth callback</Badge>
        <CardTitle>Procesando confirmacion</CardTitle>
        <CardDescription>
          Estamos validando tu correo y cerrando el flujo de autenticacion con Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
        Si todo sale bien te llevaremos al onboarding automaticamente.
      </CardContent>
    </Card>
  )
}
