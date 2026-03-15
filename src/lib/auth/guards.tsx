import type { PropsWithChildren } from 'react'

import { Navigate } from 'react-router-dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppSession } from '@/app/providers/app-session-provider'
import type { PermissionCode } from '@/shared/constants/permissions'

function GuardFeedback({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
        Las rutas protegidas usan estado de sesion real y permisos derivados de Supabase.
      </CardContent>
    </Card>
  )
}

export function RequireAuth({ children }: PropsWithChildren) {
  const session = useAppSession()

  if (session.isLoading) {
    return <GuardFeedback title="Cargando sesion" description="Estamos recuperando tu acceso y permisos." />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth" />
  }

  return children
}

export function RequirePermission({
  permission,
  children
}: PropsWithChildren<{
  permission: PermissionCode
}>) {
  const session = useAppSession()

  if (session.isLoading) {
    return <GuardFeedback title="Validando permisos" description="Estamos comprobando tu acceso." />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth" />
  }

  if (!session.permissions.includes(permission)) {
    return (
      <GuardFeedback
        title="Acceso restringido"
        description="Tu sesion no tiene el permiso requerido para abrir esta ruta."
      />
    )
  }

  return children
}
