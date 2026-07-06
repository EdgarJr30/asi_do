import type { PropsWithChildren } from 'react'

import { Navigate, useLocation } from 'react-router-dom'

import { RoutePending } from '@/app/router/route-suspense'
import { surfacePaths } from '@/app/router/surface-paths'
import type { AppSurface } from '@/app/router/routes/surface-status-page'
import { useAppSession } from '@/app/providers/app-session-provider'
import { hasCompletedBaseOnboarding } from '@/features/auth/lib/onboarding-status'
import { GuardFallbackShell } from '@/lib/auth/guard-fallback-shell'
import { hasAnyPermission } from '@/lib/permissions/guards'
import type { PermissionCode } from '@/shared/constants/permissions'

export function RequireAuth({ children }: PropsWithChildren) {
  const session = useAppSession()

  if (session.isLoading) {
    return <RoutePending fullScreen label="Recuperando tu sesión" hint="Validando tu acceso y permisos" />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  return children
}

export function RequireCompletedBaseOnboarding({ children }: PropsWithChildren) {
  const location = useLocation()
  const session = useAppSession()
  const isProfileRoute = location.pathname === surfacePaths.candidate.profile

  if (session.isLoading) {
    return <RoutePending fullScreen label="Preparando tu perfil" hint="Revisando los datos mínimos de tu cuenta" />
  }

  if (!session.isAuthenticated || isProfileRoute || hasCompletedBaseOnboarding(session.profile)) {
    return children
  }

  return <Navigate replace state={{ from: location.pathname }} to={surfacePaths.candidate.profile} />
}

export function RequireActiveAsiAccess({
  children
}: PropsWithChildren<{
  // Aceptado por compatibilidad con los call-sites; el redirect ya no depende de la superficie.
  surface?: Extract<AppSurface, 'storefront' | 'candidate' | 'workspace'>
}>) {
  const session = useAppSession()

  if (session.isLoading) {
    return <RoutePending fullScreen label="Validando tu membresía" hint="Comprobando aprobación y suscripción ASI" />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  // Autenticado pero sin membresía activa: lo guiamos al panel de membresía
  // (solicitud → pago → aprobación → activación) en vez de bloquearlo en seco.
  if (!session.hasActiveAsiAccess) {
    return <Navigate replace to={surfacePaths.account.membership} />
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
    return <RoutePending fullScreen label="Validando permisos" hint="Comprobando tu acceso" />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  if (!session.permissions.includes(permission)) {
    return <GuardFallbackShell surface={surface} />
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
    return <RoutePending fullScreen label="Validando permisos" hint="Comprobando tu acceso" />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  if (!hasAnyPermission(session.permissions, permissions)) {
    return <GuardFallbackShell surface={surface} />
  }

  return children
}

export function RequireAdminAccess({ children }: PropsWithChildren) {
  const session = useAppSession()

  if (session.isLoading) {
    return <RoutePending fullScreen label="Validando acceso admin" hint="Comprobando tu acceso a la consola" />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  if (!session.canAccessAdminConsole) {
    return <GuardFallbackShell surface="admin" />
  }

  return children
}

export function RequirePlatformAdmin({ children }: PropsWithChildren) {
  // Reservado para herramientas de super admin (arnés de estrés, tooling sensible).
  // El flag isPlatformAdmin cubre platform_owner/platform_admin; el backend (Edge
  // Function) impone además platform_owner como gate estricto del lado servidor.
  const session = useAppSession()

  if (session.isLoading) {
    return <RoutePending fullScreen label="Validando acceso de plataforma" hint="Comprobando tu rol" />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  if (!session.isPlatformAdmin) {
    return <GuardFallbackShell surface="admin" />
  }

  return children
}

export function RequirePlatformOwner({ children }: PropsWithChildren) {
  const session = useAppSession()

  if (session.isLoading) {
    return <RoutePending fullScreen label="Validando acceso de owner" hint="Comprobando tu rol de plataforma" />
  }

  if (!session.isAuthenticated) {
    return <Navigate replace to="/auth/sign-in" />
  }

  if (!session.isPlatformOwner) {
    return <GuardFallbackShell surface="admin" />
  }

  return children
}
