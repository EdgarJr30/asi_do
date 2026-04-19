import type { PropsWithChildren } from 'react'

import { Navigate } from 'react-router-dom'

import { AdminShell } from '@/experiences/app/layouts/admin-shell'
import { CandidateShell } from '@/experiences/app/layouts/candidate-shell'
import { EmployerShell } from '@/experiences/app/layouts/employer-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SurfaceStatusPage, type AppSurface } from '@/app/router/routes/surface-status-page'
import { useAppSession } from '@/app/providers/app-session-provider'
import { hasAnyPermission } from '@/lib/permissions/guards'
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
    return <Navigate replace to="/auth/sign-in" />
  }

  return children
}

export function RequireActiveAsiAccess({
  children,
  surface = 'storefront'
}: PropsWithChildren<{
  surface?: Extract<AppSurface, 'storefront' | 'candidate' | 'workspace'>
}>) {
  const session = useAppSession()

  if (session.isLoading) {
    return <GuardFeedback title="Validando membresia" description="Estamos comprobando tu aprobacion, membresia y suscripcion ASI." />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  if (!session.hasActiveAsiAccess) {
    const content = <SurfaceStatusPage kind="forbidden" surface={surface} />

    if (surface === 'candidate') {
      return <CandidateShell fallbackContent={content} />
    }

    if (surface === 'workspace') {
      return <EmployerShell fallbackContent={content} />
    }

    return content
  }

  return children
}

export function RequirePermission({
  permission,
  children,
  surface = 'workspace'
}: PropsWithChildren<{
  permission: PermissionCode
  surface?: Extract<AppSurface, 'candidate' | 'workspace' | 'admin'>
}>) {
  const session = useAppSession()

  if (session.isLoading) {
    return <GuardFeedback title="Validando permisos" description="Estamos comprobando tu acceso." />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  if (!session.permissions.includes(permission)) {
    const content = <SurfaceStatusPage kind="forbidden" surface={surface} />

    if (surface === 'candidate') {
      return <CandidateShell fallbackContent={content} />
    }

    if (surface === 'admin') {
      return <AdminShell fallbackContent={content} />
    }

    return <EmployerShell fallbackContent={content} />
  }

  return children
}

export function RequireAnyPermission({
  permissions,
  children,
  surface = 'workspace'
}: PropsWithChildren<{
  permissions: PermissionCode[]
  surface?: Extract<AppSurface, 'candidate' | 'workspace' | 'admin'>
}>) {
  const session = useAppSession()

  if (session.isLoading) {
    return <GuardFeedback title="Validando permisos" description="Estamos comprobando tu acceso." />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  if (!hasAnyPermission(session.permissions, permissions)) {
    const content = <SurfaceStatusPage kind="forbidden" surface={surface} />

    if (surface === 'candidate') {
      return <CandidateShell fallbackContent={content} />
    }

    if (surface === 'admin') {
      return <AdminShell fallbackContent={content} />
    }

    return <EmployerShell fallbackContent={content} />
  }

  return children
}

export function RequireAdminAccess({ children }: PropsWithChildren) {
  const session = useAppSession()

  if (session.isLoading) {
    return <GuardFeedback title="Validando acceso admin" description="Estamos comprobando tu acceso a la consola de plataforma." />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  if (!session.canAccessAdminConsole) {
    return <AdminShell fallbackContent={<SurfaceStatusPage kind="forbidden" surface="admin" />} />
  }

  return children
}
