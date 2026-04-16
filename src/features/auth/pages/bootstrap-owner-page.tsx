import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  bootstrapFirstPlatformOwner,
  signOutCurrentUser,
  toBootstrapFirstPlatformOwnerErrorMessage,
  toErrorMessage
} from '@/features/auth/lib/auth-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

export function BootstrapOwnerPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleBootstrapOwner() {
    setIsBootstrapping(true)

    try {
      await bootstrapFirstPlatformOwner()
      await session.refresh()
      toast.success('Primer admin inicializado', {
        description: 'Tu cuenta ya puede revisar solicitudes de operador y operar la plataforma.'
      })
      await navigate(surfacePaths.admin.approvals)
    } catch (error) {
      const description = toBootstrapFirstPlatformOwnerErrorMessage(error)

      await reportErrorWithToast({
        title: 'No se pudo reclamar el rol inicial',
        source: 'auth.bootstrap-first-platform-owner',
        route: surfacePaths.admin.bootstrapOwner,
        userId: session.authUser?.id ?? null,
        error,
        description,
        userMessage: description
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
      await navigate('/auth/sign-in')
    } catch (error) {
      await reportErrorWithToast({
        title: 'No se pudo cerrar la sesion',
        source: 'auth.bootstrap.sign-out',
        route: surfacePaths.admin.bootstrapOwner,
        userId: session.authUser?.id ?? null,
        error,
        description: toErrorMessage(error),
        userMessage: 'No pudimos cerrar tu sesion actual.'
      })
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Card className="border-zinc-200 bg-white">
        <CardHeader>
          <CardTitle>Bootstrap del primer admin</CardTitle>
          <CardDescription>
            Esta vista queda fuera del flujo publico normal. Solo usala para reclamar el primer `platform_owner` cuando la plataforma todavia no tenga uno.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7 text-zinc-600">
          <p>
            Si ya existe un owner activo, Supabase rechazara la operacion. Esta ruta se conserva solo como acceso controlado de arranque y no forma parte de la UX comercial.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => void handleBootstrapOwner()} disabled={isBootstrapping}>
              {isBootstrapping ? 'Inicializando...' : 'Reclamar primer admin'}
            </Button>
            <Button variant="outline" onClick={() => void handleSignOut()} disabled={isSigningOut}>
              {isSigningOut ? 'Cerrando...' : 'Cerrar sesion'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
