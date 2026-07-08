import type { AppNotification } from '@/lib/notifications/api'

import { surfacePaths } from '@/app/router/surface-paths'

export function isExternalNotificationUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

/**
 * Prefijos de ruta que el router realmente sirve. Un action_url interno solo se
 * usa tal cual si coincide con alguno; lo demás (rutas viejas como '/applications')
 * se resuelve por tipo para no aterrizar en el 404.
 */
const KNOWN_ROUTE_PREFIXES = [
  surfacePaths.institutional.home,
  surfacePaths.storefront.home,
  surfacePaths.auth.root,
  surfacePaths.app.home,
  surfacePaths.account.root,
  surfacePaths.legacy.candidateRoot,
  surfacePaths.workspace.root,
  surfacePaths.admin.root
]

function isKnownRoute(pathname: string) {
  return KNOWN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || (prefix !== '/' && pathname.startsWith(`${prefix}/`))
  )
}

/** Destino por tipo cuando el action_url guardado no apunta a una ruta real. */
function fallbackTargetForType(type: string) {
  if (type === 'application.submitted' || type.startsWith('recruiter')) {
    return surfacePaths.workspace.applications
  }
  if (type.startsWith('application') || type === 'application_update') {
    return surfacePaths.account.applications
  }
  if (type === 'job_match') {
    return surfacePaths.account.jobs
  }
  if (type === 'membership.application_submitted' || type === 'membership.payment_submitted') {
    return surfacePaths.admin.membership
  }
  if (type.startsWith('membership') || type.startsWith('member')) {
    return surfacePaths.account.membership
  }
  if (type.startsWith('email')) {
    return surfacePaths.admin.correos
  }
  return surfacePaths.account.home
}

/**
 * Resuelve la URL a la que debe llevar una notificación al hacer clic.
 * Devuelve null cuando no hay destino (solo marcar como leída).
 */
export function resolveNotificationTarget(notification: AppNotification): string | null {
  const actionUrl = notification.action_url?.trim() ?? ''

  if (actionUrl && isExternalNotificationUrl(actionUrl)) {
    return actionUrl
  }

  if (!actionUrl) {
    return null
  }

  const pathname = actionUrl.startsWith('/') ? actionUrl : `/${actionUrl}`

  if (isKnownRoute(pathname)) {
    return pathname
  }

  return fallbackTargetForType(notification.type)
}
