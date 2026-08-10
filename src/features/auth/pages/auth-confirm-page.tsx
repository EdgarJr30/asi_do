import { useEffect, useRef, useState } from 'react'

import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/loader'
import { completeAuthConfirmation, toErrorMessage } from '@/features/auth/lib/auth-api'
import { resolveAuthCallback } from '@/features/auth/lib/auth-callback'
import { captureClientError } from '@/lib/errors/client-error-logger'

/**
 * GoTrue devuelve el motivo en inglés y con vocabulario de plomería («token
 * hash», «code verifier»). Quien confirma su correo no puede hacer nada con
 * eso: aquí solo queda lo accionable, y el texto crudo vive en el registro de
 * errores, que es donde sirve.
 */
function toConfirmationMessage(error: unknown) {
  const raw = toErrorMessage(error).toLowerCase()

  if (raw.includes('expired') || raw.includes('invalid') || raw.includes('not found')) {
    return 'Este enlace ya caducó o se usó antes. Pide uno nuevo desde el acceso.'
  }

  if (raw.includes('verifier') || raw.includes('pkce')) {
    return 'Abre el enlace en el mismo navegador donde creaste tu cuenta, o pide uno nuevo desde el acceso.'
  }

  return 'No pudimos completar el enlace de confirmación. Pide uno nuevo desde el acceso.'
}

export function AuthConfirmPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const session = useAppSession()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasStartedRef = useRef(false)
  const isMountedRef = useRef(true)

  // El efecto corre **una sola vez** (deps vacías) y lee lo último por ref.
  // Tenerlos en dependencias era el bug: confirmar el correo cambia la sesión,
  // el provider re-renderiza con un objeto nuevo, el efecto se limpiaba a media
  // confirmación y su `isActive` apagado hacía que ni navegara ni mostrara error.
  // Resultado: la pantalla se quedaba en «Procesando confirmacion» para siempre.
  const latestRef = useRef({ navigate, searchParams, session })

  // Sin dependencias: se sincroniza tras cada render, así el flujo en vuelo
  // siempre usa la sesión y el navegador actuales sin volver a arrancar.
  useEffect(() => {
    latestRef.current = { navigate, searchParams, session }
  })

  useEffect(() => {
    // En un remontaje (StrictMode en desarrollo) volvemos a marcar montado sin
    // reiniciar el flujo: el enlace del correo es de un solo uso y reintentar el
    // intercambio del código fallaría.
    isMountedRef.current = true

    async function confirmAuth() {
      const { session: currentSession } = latestRef.current
      const callback = resolveAuthCallback(latestRef.current.searchParams)

      if (!currentSession.isSupabaseConfigured) {
        setStatus('error')
        setErrorMessage('El servicio de confirmación aún no está disponible para procesar este enlace.')
        return
      }

      try {
        await completeAuthConfirmation({
          code: callback.code,
          tokenHash: callback.tokenHash,
          type: callback.type
        })
      } catch (error) {
        await captureClientError({
          source: 'auth.confirm',
          route: surfacePaths.auth.confirm,
          userId: latestRef.current.session.authUser?.id ?? null,
          userMessage: 'No pudimos confirmar tu correo.',
          error,
          metadata: { nextPath: callback.nextPath }
        })

        if (isMountedRef.current) {
          setStatus('error')
          setErrorMessage(toConfirmationMessage(error))
        }
        return
      }

      // A partir de aquí el enlace ya se consumió: hidratar es una mejora, no un
      // requisito. Si falla, el provider vuelve a intentarlo por el evento de
      // auth y el destino pide lo que le falte; bloquear aquí dejaría a la
      // persona confirmada pero atrapada en una pantalla de error.
      try {
        await latestRef.current.session.refresh()
      } catch (error) {
        void captureClientError({
          source: 'auth.confirm.refresh',
          route: surfacePaths.auth.confirm,
          error,
          severity: 'warning',
          userMessage: 'No pudimos cargar tu sesion tras confirmar el correo.'
        })
      }

      toast.success('Correo confirmado', {
        description: 'Tu cuenta ya puede iniciar sesión y preparar tu perfil.'
      })
      await latestRef.current.navigate(callback.nextPath, { replace: true })
    }

    if (!hasStartedRef.current) {
      hasStartedRef.current = true
      void confirmAuth()
    }

    return () => {
      isMountedRef.current = false
    }
  }, [])

  if (status === 'error') {
    return (
      <Card className="mx-auto w-full max-w-xl text-center">
        <CardHeader>
          <CardTitle>No pudimos confirmar tu correo</CardTitle>
          <CardDescription>
            {errorMessage ?? 'No pudimos completar el enlace de confirmación. Pide uno nuevo desde el acceso.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button className="h-12 rounded-control text-sm" onClick={() => void navigate(surfacePaths.auth.signIn, { replace: true })}>
            Volver a acceso
          </Button>
        </CardContent>
      </Card>
    )
  }

  return <PageLoader className="min-h-full" label="Confirmando tu correo" hint="Un momento" />
}
