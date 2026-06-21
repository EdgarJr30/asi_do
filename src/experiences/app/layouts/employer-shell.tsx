import type { CSSProperties, ReactNode } from 'react'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  Banknote,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  FileStack,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  Layers3,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  Sparkles,
  UserRound,
  UsersRound,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { RouteScrollManager } from '@/app/router/route-scroll-manager'
import { surfacePaths } from '@/app/router/surface-paths'
import { BrandLockup, BrandMark } from '@/components/ui/app-brand'
import { AppBottomNav, type AppNavGroup, type AppNavItem } from '@/components/ui/app-shell-navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { signOutCurrentUser, toErrorMessage } from '@/features/auth/lib/auth-api'
import { fetchMyNotifications, markNotificationRead, type AppNotification } from '@/lib/notifications/api'
import { filterNavigationItems } from '@/lib/permissions/guards'
import { cn } from '@/lib/utils/cn'
import { PLATFORM_REGISTRATION_LOCKED_MESSAGE } from '@/shared/config/launch-access'
import { adminNavigationItems, candidateNavigationItems, employerNavigationItems } from '@/shared/constants/navigation'
import type { NavigationItem } from '@/shared/types/navigation'

const WORKSPACE_NOTIFICATION_QUERY_KEY = ['workspace-shell', 'notifications'] as const
const WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY = 'asi:workspace-sidebar-collapsed:v1'
const DESKTOP_SIDEBAR_EXPANDED_WIDTH = 272
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = 88

type ShellExperience = 'workspace' | 'candidate' | 'storefront' | 'admin'
type ShellGuestAction = {
  href: string
  label: string
  variant: 'ghost' | 'outline' | 'primary'
  disabled?: boolean
}
type ShellConfig = {
  brand: string
  footerCaption: string
  hideFooterChrome?: boolean
  userRole?: string
  guestActions: ShellGuestAction[]
  mobileSidebarLabel: string
  primaryNav: AppNavItem[]
  profileHref: string
  profileMenuLinks: Array<{ href: string; label: string }>
  publicActionHref: string
  publicActionLabel: string
  routeMeta: Record<string, Pick<AppNavItem, 'title' | 'description'>>
  routeMetaDefault: Pick<AppNavItem, 'title' | 'description'>
  searchPlaceholder: string
  sidebarGroups: AppNavGroup[]
  tenantName: string
  topbarEyebrow: string
}

const workspaceIconByHref: Partial<Record<string, LucideIcon>> = {
  [surfacePaths.workspace.dashboard]: LayoutDashboard,
  [surfacePaths.workspace.activity]: Activity,
  [surfacePaths.workspace.jobs]: BriefcaseBusiness,
  [surfacePaths.workspace.applications]: FileStack,
  [surfacePaths.workspace.talent]: UsersRound,
  [surfacePaths.workspace.talentPool]: Database,
  [surfacePaths.workspace.pipeline]: KanbanSquare,
  [surfacePaths.workspace.reports]: BarChart3,
  [surfacePaths.workspace.settings]: Settings,
  [surfacePaths.workspace.access]: Shield
}

const candidateIconByHref: Partial<Record<string, LucideIcon>> = {
  [surfacePaths.candidate.home]: LayoutDashboard,
  [surfacePaths.storefront.jobs]: BriefcaseBusiness,
  [surfacePaths.candidate.applications]: FileText,
  [surfacePaths.candidate.profile]: UserRound,
  [surfacePaths.candidate.recruiterRequest]: Building2,
  [surfacePaths.candidate.authorityRequest]: Shield
}

const workspaceCopyByHref: Record<string, Pick<AppNavItem, 'title' | 'description'>> = {
  [surfacePaths.workspace.dashboard]: {
    title: 'Resumen',
    description: 'Estado general del reclutamiento de tu empresa'
  },
  [surfacePaths.workspace.activity]: {
    title: 'Mi actividad',
    description: 'Tu historial reciente de acciones dentro del workspace'
  },
  [surfacePaths.workspace.jobs]: {
    title: 'Vacantes',
    description: 'Publicacion, estado y ritmo del frente de reclutamiento'
  },
  [surfacePaths.workspace.applications]: {
    title: 'Aplicaciones',
    description: 'Todas las postulaciones del equipo en un solo lugar'
  },
  [surfacePaths.workspace.talent]: {
    title: 'Candidatos',
    description: 'Talento visible para el equipo con contexto suficiente para decidir'
  },
  [surfacePaths.workspace.talentPool]: {
    title: 'Banco de talento',
    description: 'Talento guardado y preseleccionado para futuras vacantes'
  },
  [surfacePaths.workspace.pipeline]: {
    title: 'Pipeline',
    description: 'Seguimiento colaborativo de cada aplicacion por etapa'
  },
  [surfacePaths.workspace.reports]: {
    title: 'Reportes',
    description: 'Metricas y desempeno del reclutamiento'
  },
  [surfacePaths.workspace.settings]: {
    title: 'Configuracion',
    description: 'Empresa, equipo y accesos del workspace'
  },
  [surfacePaths.workspace.access]: {
    title: 'Accesos',
    description: 'Roles, permisos y estructura operativa del equipo'
  }
}

const candidateCopyByHref: Record<string, Pick<AppNavItem, 'title' | 'description'>> = {
  [surfacePaths.candidate.home]: {
    title: 'Inicio',
    description: 'Tu panel con perfil, vacantes y aplicaciones en un vistazo'
  },
  [surfacePaths.storefront.jobs]: {
    title: 'Vacantes',
    description: 'Explora oportunidades abiertas y aplica con mas contexto'
  },
  [surfacePaths.candidate.applications]: {
    title: 'Aplicaciones',
    description: 'Sigue el avance de cada proceso con un solo vistazo'
  },
  [surfacePaths.candidate.profile]: {
    title: 'Perfil',
    description: 'Tu presencia profesional, CV y datos clave en un mismo lugar'
  },
  [surfacePaths.candidate.recruiterRequest]: {
    title: 'Reclutar con mi empresa',
    description: 'Lleva tu empresa a la plataforma y publica vacantes'
  }
}

const storefrontCopyByHref: Record<string, Pick<AppNavItem, 'title' | 'description'>> = {
  [surfacePaths.storefront.home]: {
    title: 'Producto',
    description: 'Resumen comercial, beneficios y propuesta de valor'
  },
  [surfacePaths.storefront.jobs]: {
    title: 'Jobs',
    description: 'Oportunidades para miembros, detalles y acceso al flujo de aplicación'
  },
  [surfacePaths.auth.signIn]: {
    title: 'Iniciar sesión',
    description: 'Accede a tu cuenta para continuar en la plataforma'
  },
  [surfacePaths.auth.signUp]: {
    title: 'Registro cerrado',
    description: 'El alta de cuentas nuevas esta deshabilitada temporalmente'
  },
  [surfacePaths.workspace.root]: {
    title: 'Workspace',
    description: 'Entra al espacio operativo de tu empresa'
  },
  [surfacePaths.candidate.profile]: {
    title: 'Mi perfil',
    description: 'Abre tu espacio profesional dentro de la plataforma'
  }
}

function mapNavItem(
  item: NavigationItem,
  experience: Extract<ShellExperience, 'workspace' | 'candidate'>
): AppNavItem {
  const copy = experience === 'workspace' ? workspaceCopyByHref[item.href] : candidateCopyByHref[item.href]
  const icon = experience === 'workspace' ? workspaceIconByHref[item.href] : candidateIconByHref[item.href]

  return {
    ...item,
    ...(copy ?? {
      title: item.title,
      description: item.description
    }),
    icon
  }
}

function findNavItem(items: AppNavItem[], href: string) {
  return items.find((item) => item.href === href)
}

function resolveUserIdentity(session: ReturnType<typeof useAppSession>) {
  const displayName = session.profile?.display_name ?? session.profile?.full_name ?? session.authUser?.email ?? 'Usuario'
  const email = session.profile?.email ?? session.authUser?.email ?? 'Sin correo disponible'
  const initialsSource = displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  const initials = initialsSource.map((part) => part.charAt(0).toUpperCase()).join('') || 'U'

  return {
    displayName,
    email,
    initials
  }
}

function formatNotificationTimestamp(value: string) {
  return new Date(value).toLocaleString('es-DO', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}

function isExternalUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function getInitialSidebarCollapsed() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
}

function getRouteMeta(
  pathname: string,
  eyebrow: string,
  routes: Record<string, Pick<AppNavItem, 'title' | 'description'>>,
  fallback: Pick<AppNavItem, 'title' | 'description'>
) {
  const entries = Object.entries(routes).sort((left, right) => right[0].length - left[0].length)
  const matchedEntry = entries.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))

  if (matchedEntry) {
    return {
      eyebrow,
      title: matchedEntry[1].title,
      description: matchedEntry[1].description ?? fallback.description
    }
  }

  return {
    eyebrow,
    title: fallback.title,
    description: fallback.description
  }
}

function getRouteBreadcrumbs(groups: AppNavGroup[], pathname: string, fallbackTitle: string) {
  let best: { group: AppNavGroup; item: AppNavItem } | null = null

  for (const group of groups) {
    for (const item of group.items) {
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`)

      if (!matches) {
        continue
      }

      if (!best || item.href.length > best.item.href.length) {
        best = { group, item }
      }
    }
  }

  if (best) {
    const breadcrumbs = best.group.title ? [best.group.title] : []

    if (breadcrumbs.at(-1) !== best.item.title) {
      breadcrumbs.push(best.item.title)
    }

    return breadcrumbs
  }

  return [fallbackTitle]
}

function resolveActiveShellItemHref(groups: AppNavGroup[], pathname: string) {
  return groups
    .flatMap((group) => group.items)
    .filter((item) => {
      if (pathname === item.href) {
        return true
      }

      if (item.href === '/' || item.href.includes('#')) {
        return false
      }

      return pathname.startsWith(`${item.href}/`)
    })
    .sort((left, right) => right.href.length - left.href.length)[0]?.href
}

function WorkspaceNotificationPanel({
  isLoading,
  notifications,
  onMarkRead,
  onOpenNotification
}: {
  isLoading: boolean
  notifications: AppNotification[]
  onMarkRead: (notificationId: string) => void
  onOpenNotification: (notification: AppNotification) => void
}) {
  return (
    <div className="w-[min(24rem,calc(100vw-2rem))] rounded-[26px] border border-(--app-border) bg-(--app-surface-elevated) p-3 shadow-[0_28px_72px_rgba(8,12,24,0.22)]">
      <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
        <div>
          <p className="text-sm font-semibold text-(--app-text)">Notificaciones</p>
          <p className="text-xs text-(--app-text-muted)">Últimos eventos relevantes para tu cuenta.</p>
        </div>
        <span className="rounded-full border border-(--app-border) bg-(--app-surface) px-2.5 py-1 text-[0.72rem] font-semibold text-(--app-text-muted)">
          {notifications.filter((notification) => !notification.read_at).length} sin leer
        </span>
      </div>

      {isLoading ? (
        <div className="rounded-panel border border-dashed border-(--app-border) bg-(--app-surface) px-4 py-6 text-sm text-(--app-text-muted)">
          Cargando notificaciones...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-panel border border-dashed border-(--app-border) bg-(--app-surface) px-4 py-6 text-sm text-(--app-text-muted)">
          Aún no tienes notificaciones recientes.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={cn(
                'rounded-[22px] border px-3.5 py-3 transition-colors',
                notification.read_at
                  ? 'border-(--app-border) bg-(--app-surface)'
                  : 'border-primary-200 bg-primary-50/80 dark:border-primary-500/24 dark:bg-primary-500/10'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-(--app-text)">{notification.title}</p>
                  <p className="mt-1 text-sm leading-6 text-(--app-text-muted)">{notification.body}</p>
                </div>
                {!notification.read_at ? (
                  <span className="mt-1 size-2.5 shrink-0 rounded-full bg-primary-500 shadow-[0_0_0_4px_rgba(74,99,211,0.14)]" />
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-(--app-text-subtle)">
                  {formatNotificationTimestamp(notification.created_at)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {notification.action_url ? (
                    <Button className="h-9 rounded-full px-3 text-xs" variant="outline" onClick={() => onOpenNotification(notification)}>
                      Abrir
                    </Button>
                  ) : null}
                  {!notification.read_at ? (
                    <Button className="h-9 rounded-full px-3 text-xs" variant="ghost" onClick={() => onMarkRead(notification.id)}>
                      Marcar leida
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-50 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900/95 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-[0_12px_28px_rgba(8,12,24,0.45)] backdrop-blur transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
    >
      <span className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rotate-45 border-b border-l border-white/10 bg-slate-900/95" />
      {label}
    </span>
  )
}

function SidebarFooter({
  config,
  isDesktop,
  session,
  showCollapsedLabels,
  signOutPending,
  userEmail,
  userInitials,
  userName,
  onActionNavigate,
  onOpenNotifications,
  onOpenProfile,
  onSignOut
}: {
  config: ShellConfig
  isDesktop: boolean
  session: ReturnType<typeof useAppSession>
  showCollapsedLabels: boolean
  signOutPending: boolean
  userEmail: string
  userInitials: string
  userName: string
  onActionNavigate: (href: string) => void
  onOpenNotifications: () => void
  onOpenProfile: () => void
  onSignOut: () => void
}) {
  const footerYear = new Date().getFullYear()

  if (!session.isAuthenticated) {
    return (
      <div className="border-t border-white/10 px-2.5 py-3">
        <button
          className={cn(
            'flex min-h-11 w-full items-center rounded-xl text-left text-sm font-medium transition',
            showCollapsedLabels ? 'justify-center px-2' : 'gap-3 px-3',
            'text-white/78 hover:bg-white/6 hover:text-white'
          )}
          title={showCollapsedLabels ? config.publicActionLabel : undefined}
          type="button"
          onClick={() => onActionNavigate(config.publicActionHref)}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/8 text-white/78">
            <Sparkles className="size-4.5" />
          </span>
          {!showCollapsedLabels ? <span>{config.publicActionLabel}</span> : <span className="sr-only">{config.publicActionLabel}</span>}
        </button>

        <div className="mt-3 grid gap-2">
          {config.guestActions.map((action) => (
            <Button
              key={action.href}
              className="w-full"
              disabled={action.disabled}
              title={action.disabled ? PLATFORM_REGISTRATION_LOCKED_MESSAGE : undefined}
              variant={action.variant === 'primary' ? undefined : action.variant}
              onClick={() => onActionNavigate(action.href)}
            >
              {action.label}
            </Button>
          ))}
        </div>

        {!showCollapsedLabels ? (
          <div className="mt-4 border-t border-white/10 pt-4 text-center">
            <p className="text-xs leading-5 text-white/42">© {footerYear} {config.brand}</p>
            <p className="mt-1 text-xs font-medium text-white/42">{config.footerCaption}</p>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="border-t border-white/10 px-2.5 py-3">
      {!config.hideFooterChrome ? (
        <button
          className={cn(
            'flex min-h-11 w-full items-center rounded-xl text-left text-sm font-medium transition',
            showCollapsedLabels ? 'justify-center px-2' : 'gap-3 px-3',
            'text-white/78 hover:bg-white/6 hover:text-white'
          )}
          title={showCollapsedLabels ? config.publicActionLabel : undefined}
          type="button"
          onClick={() => onActionNavigate(config.publicActionHref)}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/8 text-white/78">
            <BriefcaseBusiness className="size-4.5" />
          </span>
          {!showCollapsedLabels ? <span>{config.publicActionLabel}</span> : <span className="sr-only">{config.publicActionLabel}</span>}
        </button>
      ) : null}

      {!isDesktop ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/6 p-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{userName}</p>
              <p className="truncate text-xs text-white/58">{userEmail}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <button
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white"
              type="button"
              onClick={onOpenProfile}
            >
              <UserRound className="size-4" />
              Mi perfil
            </button>
            <button
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white"
              type="button"
              onClick={onOpenNotifications}
            >
              <Bell className="size-4" />
              Notificaciones
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={`Abrir perfil de ${userName}`}
        onClick={onOpenProfile}
        className={cn(
          'group relative mt-3 flex w-full items-center rounded-2xl outline-none transition-[background-color,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-white/40',
          showCollapsedLabels ? 'justify-center py-1' : 'gap-3 px-2 py-2',
          !showCollapsedLabels && config.hideFooterChrome ? 'border border-white/10 bg-white/6 hover:border-white/16 hover:bg-white/10' : ''
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3a63d6,#9fb6f0)] text-[11px] font-semibold text-white ring-2 ring-white/15">
          {userInitials}
        </span>
        {!showCollapsedLabels ? (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13px] font-semibold text-white">{userName}</span>
            <span className="block truncate text-[11px] text-white/52">{config.userRole ?? userEmail}</span>
          </span>
        ) : (
          <>
            <span className="sr-only">{userName}</span>
            <SidebarTooltip label={userName} />
          </>
        )}
      </button>

      <button
        aria-label="Cerrar sesion"
        className={cn(
          'group relative mt-1.5 flex w-full items-center rounded-xl text-left text-sm font-medium text-rose-200/90 outline-none transition-[background-color,color] duration-150 hover:bg-rose-400/12 hover:text-rose-100 focus-visible:ring-2 focus-visible:ring-rose-300/50',
          showCollapsedLabels ? 'h-11 justify-center px-0' : 'min-h-10 gap-3 px-3 py-2'
        )}
        type="button"
        onClick={onSignOut}
      >
        <LogOut className="size-[1.15rem] shrink-0" />
        {!showCollapsedLabels ? (
          <span>{signOutPending ? 'Cerrando...' : 'Cerrar sesión'}</span>
        ) : (
          <>
            <span className="sr-only">Cerrar sesión</span>
            <SidebarTooltip label="Cerrar sesión" />
          </>
        )}
      </button>

      {!showCollapsedLabels && !config.hideFooterChrome ? (
        <div className="mt-4 border-t border-white/10 pt-4 text-center">
          <p className="text-xs leading-5 text-white/42">© {footerYear} {config.brand}</p>
          <p className="mt-1 text-xs font-medium text-white/42">{config.footerCaption}</p>
        </div>
      ) : null}
    </div>
  )
}

function WorkspaceSidebarContent({
  activeHref,
  config,
  isCollapsed,
  mode,
  session,
  signOutPending,
  userEmail,
  userInitials,
  userName,
  onActionNavigate,
  onOpenNotifications,
  onOpenProfile,
  onSignOut,
  onToggleSidebar
}: {
  activeHref: string
  config: ShellConfig
  isCollapsed: boolean
  mode: 'desktop' | 'mobile'
  session: ReturnType<typeof useAppSession>
  signOutPending: boolean
  userEmail: string
  userInitials: string
  userName: string
  onActionNavigate: (href: string) => void
  onOpenNotifications: () => void
  onOpenProfile: () => void
  onSignOut: () => void
  onToggleSidebar: () => void
}) {
  const isDesktop = mode === 'desktop'
  const showCollapsedLabels = isDesktop && isCollapsed
  const activeItemHref = resolveActiveShellItemHref(config.sidebarGroups, activeHref)

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col text-white',
        showCollapsedLabels ? 'overflow-visible' : 'overflow-hidden',
        config.hideFooterChrome
          ? 'bg-[linear-gradient(180deg,#16336d_0%,#1b3a7a_55%,#1d3d80_100%)]'
          : 'bg-[linear-gradient(180deg,#132a61_0%,#163777_34%,#1a3b88_100%)]'
      )}
    >
      <div className="border-b border-white/10 px-3 py-3">
        <div className={cn('flex', showCollapsedLabels ? 'flex-col items-center gap-2.5' : 'items-center gap-2')}>
          {showCollapsedLabels ? (
            <BrandMark panelClassName="size-10 rounded-[14px] border-white/12 bg-white/10 p-2 shadow-none" />
          ) : (
            <div
              className={cn(
                'flex min-w-0 flex-1 flex-col justify-center',
                config.hideFooterChrome ? '' : 'rounded-[18px] bg-white/6 px-3 py-2'
              )}
            >
              <BrandLockup className={config.hideFooterChrome ? 'w-20' : 'w-28'} surface="dark" />
              <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">{config.tenantName}</p>
            </div>
          )}
          {!showCollapsedLabels ? (
            <span className="sr-only">{config.brand}</span>
          ) : null}
          <button
            aria-label={
              isDesktop
                ? isCollapsed
                  ? `Expandir sidebar de ${config.mobileSidebarLabel}`
                  : `Contraer sidebar de ${config.mobileSidebarLabel}`
                : `Cerrar sidebar de ${config.mobileSidebarLabel}`
            }
            className="group relative inline-flex size-8 shrink-0 items-center justify-center self-center rounded-lg border border-white/10 bg-white/6 text-white/70 outline-none transition-[background-color,border-color,color] duration-150 hover:border-white/20 hover:bg-white/12 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
            type="button"
            onClick={onToggleSidebar}
          >
            {isDesktop ? isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" /> : <X className="size-4" />}
            {showCollapsedLabels ? <SidebarTooltip label="Expandir menú" /> : null}
          </button>
        </div>
        {showCollapsedLabels ? <span className="sr-only">{config.tenantName}</span> : null}
      </div>

      <div className={cn('flex min-h-0 flex-1 flex-col', showCollapsedLabels ? 'overflow-visible' : 'overflow-hidden')}>
        <nav
          aria-label={`${config.brand} navigation`}
          className={cn(
            'flex-1 px-3 py-4 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]',
            showCollapsedLabels ? 'overflow-visible' : 'overflow-y-auto'
          )}
        >
          {config.sidebarGroups.map((group, groupIndex) => (
            <div key={group.title ?? `group-${groupIndex}`} className={cn(groupIndex === 0 ? '' : showCollapsedLabels ? 'mt-4' : 'mt-6')}>
              {group.title && !showCollapsedLabels ? (
                <p className="px-3 pb-2 text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-white/35">{group.title}</p>
              ) : groupIndex > 0 && showCollapsedLabels ? (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeItemHref === item.href
                  const Icon = item.icon

                  return (
                    <button
                      key={item.href}
                      aria-label={item.title}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group relative flex w-full items-center rounded-xl text-left text-[0.875rem] font-medium outline-none transition-[background-color,color] duration-150',
                        showCollapsedLabels ? 'h-11 justify-center px-0' : 'min-h-10 gap-3 px-3 py-2',
                        'focus-visible:ring-2 focus-visible:ring-white/40',
                        isActive
                          ? 'bg-white/12 text-white'
                          : 'text-white/60 hover:bg-white/8 hover:text-white'
                      )}
                      data-active={isActive ? 'true' : 'false'}
                      type="button"
                      onClick={() => onActionNavigate(item.href)}
                    >
                      {isActive && !showCollapsedLabels ? (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]" />
                      ) : null}
                      <span
                        className={cn(
                          'flex shrink-0 items-center justify-center transition-colors',
                          showCollapsedLabels ? 'size-10 rounded-xl' : 'size-5',
                          showCollapsedLabels && isActive ? 'bg-white/12' : ''
                        )}
                      >
                        {Icon ? <Icon className={cn(showCollapsedLabels ? 'size-[1.15rem]' : 'size-[1.15rem]', isActive ? 'text-white' : 'text-current')} strokeWidth={isActive ? 2.4 : 2} /> : null}
                      </span>
                      {!showCollapsedLabels ? (
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      ) : (
                        <>
                          <span className="sr-only">{item.title}</span>
                          <SidebarTooltip label={item.title} />
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <SidebarFooter
          config={config}
          isDesktop={isDesktop}
          session={session}
          showCollapsedLabels={showCollapsedLabels}
          signOutPending={signOutPending}
          userEmail={userEmail}
          userInitials={userInitials}
          userName={userName}
          onActionNavigate={onActionNavigate}
          onOpenNotifications={onOpenNotifications}
          onOpenProfile={onOpenProfile}
          onSignOut={onSignOut}
        />
      </div>
    </div>
  )
}

function buildStorefrontConfig(session: ReturnType<typeof useAppSession>) {
  const hasWorkspaceAccess = session.permissions.includes('workspace:read')
  const accountItems: AppNavItem[] = session.isAuthenticated
    ? [
        {
          href: surfacePaths.candidate.profile,
          title: 'Mi perfil',
          description: 'Abre tu espacio profesional y tus aplicaciones',
          icon: UserRound
        },
        ...(hasWorkspaceAccess
          ? [
              {
                href: surfacePaths.workspace.root,
                title: 'Workspace',
                description: 'Entra al espacio operativo de tu empresa',
                icon: Building2
              } satisfies AppNavItem
            ]
          : [])
      ]
    : [
        {
          href: surfacePaths.auth.signIn,
          title: 'Iniciar sesión',
          description: 'Accede a tu cuenta para continuar en la plataforma',
          icon: UserRound
        }
      ]

  const navigationItems: AppNavItem[] = [
    {
      href: surfacePaths.storefront.home,
      title: 'Producto',
      description: 'Resumen comercial, pricing y propuesta',
      icon: Sparkles
    },
    {
      href: surfacePaths.storefront.jobs,
      title: 'Jobs',
      description: 'Oportunidades para miembros, detalles y aplicación',
      icon: BriefcaseBusiness
    },
    ...accountItems
  ]

  return {
    brand: 'Plataforma ASI',
    footerCaption: 'Shell compartido de plataforma',
    hideFooterChrome: true,
    guestActions: [
      { href: surfacePaths.institutional.home, label: 'ASI institucional', variant: 'ghost' },
      { href: surfacePaths.auth.signUp, label: 'Registro cerrado', variant: 'outline', disabled: true },
      { href: surfacePaths.auth.signIn, label: 'Iniciar sesion', variant: 'primary' }
    ],
    mobileSidebarLabel: 'plataforma',
    primaryNav: [surfacePaths.storefront.home, surfacePaths.storefront.jobs, accountItems[0]?.href]
      .map((href) => (href ? findNavItem(navigationItems, href) : undefined))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    profileHref: surfacePaths.candidate.profile,
    profileMenuLinks: session.isAuthenticated
      ? [
          { href: surfacePaths.candidate.profile, label: 'Mi perfil' },
          ...(hasWorkspaceAccess ? [{ href: surfacePaths.workspace.root, label: 'Abrir mi workspace' }] : [])
        ]
      : [],
    publicActionHref: surfacePaths.institutional.home,
    publicActionLabel: 'ASI institucional',
    routeMeta: storefrontCopyByHref,
    routeMetaDefault: {
      title: 'Plataforma',
      description: 'Acceso a oportunidades para miembros, pricing y rutas de entrada al producto.'
    },
    searchPlaceholder: 'Buscar jobs (próximamente)',
    sidebarGroups: [
      {
        title: 'Explora',
        items: navigationItems.filter((item) => item.href === surfacePaths.storefront.home || item.href === surfacePaths.storefront.jobs)
      },
      {
        title: 'Cuenta',
        items: navigationItems.filter((item) => item.href !== surfacePaths.storefront.home && item.href !== surfacePaths.storefront.jobs)
      }
    ],
    tenantName: session.isAuthenticated
      ? session.activeMembership?.tenantName ?? 'Cuenta ASI'
      : 'Explora la plataforma',
    topbarEyebrow: 'Acceso miembros'
  } satisfies ShellConfig
}

const adminIconByHref: Partial<Record<string, LucideIcon>> = {
  [surfacePaths.admin.root]: LayoutDashboard,
  [surfacePaths.admin.approvals]: Shield,
  [surfacePaths.admin.platform]: Building2,
  [surfacePaths.admin.moderation]: Layers3,
  [surfacePaths.admin.errors]: FileText,
  [surfacePaths.admin.payments]: Banknote
}

/**
 * Sidebar unificado: una sola navegación para todos los usuarios autenticados.
 * La base ("Tu espacio") la ve todo el mundo; las secciones "Mi empresa" y
 * "Administración" se SUMAN según permisos, en lugar de reemplazar el sidebar.
 * Así la navegación nunca cambia al moverse entre módulos.
 */
function buildUnifiedConfig(session: ReturnType<typeof useAppSession>): ShellConfig {
  const { permissions, isAuthenticated } = session
  const hasWorkspace = permissions.includes('workspace:read')

  const candidateItems = filterNavigationItems(candidateNavigationItems, permissions, isAuthenticated).map((item) =>
    mapNavItem(item, 'candidate')
  )
  const pick = (items: AppNavItem[], hrefs: string[]) =>
    hrefs.map((href) => findNavItem(items, href)).filter((item): item is AppNavItem => Boolean(item))

  const baseItems = pick(candidateItems, [
    surfacePaths.candidate.home,
    surfacePaths.storefront.jobs,
    surfacePaths.candidate.applications,
    surfacePaths.candidate.profile
  ]).map((item) => (item.href === surfacePaths.storefront.jobs ? { ...item, title: 'Empleos' } : item))

  const accountItems = pick(candidateItems, [
    // "Reclutar con mi empresa" solo tiene sentido para quien aún no tiene empresa.
    ...(hasWorkspace ? [] : [surfacePaths.candidate.recruiterRequest]),
    surfacePaths.candidate.authorityRequest
  ])

  const workspaceItems = hasWorkspace
    ? filterNavigationItems(employerNavigationItems, permissions, isAuthenticated).map((item) => mapNavItem(item, 'workspace'))
    : []

  const adminItems: AppNavItem[] = session.canAccessAdminConsole
    ? filterNavigationItems(adminNavigationItems, permissions, isAuthenticated).map((item) => ({
        href: item.href,
        title: item.title,
        icon: adminIconByHref[item.href] ?? Shield
      }))
    : []

  const sidebarGroups: AppNavGroup[] = [
    { title: 'Tu espacio', items: baseItems },
    ...(workspaceItems.length ? [{ title: 'Mi empresa', items: workspaceItems }] : []),
    ...(adminItems.length ? [{ title: 'Administración', items: adminItems }] : []),
    ...(accountItems.length ? [{ title: 'Cuenta', items: accountItems }] : [])
  ].filter((group) => group.items.length > 0)

  const settingsItem = workspaceItems.find((item) => item.href === surfacePaths.workspace.settings)

  return {
    brand: 'Plataforma ASI',
    footerCaption: 'Shell compartido de plataforma',
    hideFooterChrome: true,
    // Etiqueta genérica: no exponemos el rol del tenant (p. ej. "Owner") en el chrome.
    userRole: hasWorkspace ? 'Miembro del equipo' : 'Candidato',
    guestActions: [],
    mobileSidebarLabel: 'plataforma',
    primaryNav: baseItems,
    profileHref: surfacePaths.candidate.profile,
    profileMenuLinks: [
      { href: surfacePaths.candidate.profile, label: 'Mi perfil' },
      { href: surfacePaths.candidate.applications, label: 'Aplicaciones' },
      ...(settingsItem ? [{ href: settingsItem.href, label: settingsItem.title }] : [])
    ],
    publicActionHref: surfacePaths.storefront.jobs,
    publicActionLabel: 'Ver empleos',
    routeMeta: {
      ...candidateCopyByHref,
      ...workspaceCopyByHref,
      ...storefrontCopyByHref,
      ...Object.fromEntries(adminNavigationItems.map((item) => [item.href, { title: item.title, description: item.description }]))
    },
    routeMetaDefault: {
      title: 'Tu espacio',
      description: 'Tu perfil, oportunidades y módulos en un solo lugar.'
    },
    searchPlaceholder: 'Buscar en la plataforma...',
    sidebarGroups,
    tenantName: hasWorkspace ? session.activeMembership?.tenantName ?? 'Tu empresa' : 'Tu espacio',
    topbarEyebrow: 'Plataforma ASI'
  }
}

function buildShellConfig(experience: ShellExperience, session: ReturnType<typeof useAppSession>) {
  // Usuarios no autenticados en la vitrina pública conservan su navegación comercial.
  if (experience === 'storefront' && !session.isAuthenticated) {
    return buildStorefrontConfig(session)
  }

  // Todos los usuarios autenticados comparten el mismo sidebar unificado.
  return buildUnifiedConfig(session)
}

export function PlatformAppShell({
  experience = 'workspace',
  fallbackContent
}: {
  experience?: ShellExperience
  fallbackContent?: ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAppSession()
  const queryClient = useQueryClient()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(getInitialSidebarCollapsed)
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const notificationPanelRef = useRef<HTMLDivElement | null>(null)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  const config = buildShellConfig(experience, session)
  const isWorkspace = experience === 'workspace'
  const userIdentity = resolveUserIdentity(session)
  const routeMeta = getRouteMeta(location.pathname, config.topbarEyebrow, config.routeMeta, config.routeMetaDefault)
  const breadcrumbs = getRouteBreadcrumbs(config.sidebarGroups, location.pathname, routeMeta.title)

  const shellLayoutStyle = useMemo(
    () =>
      ({
        '--shell-sidebar-width': `${isDesktopSidebarCollapsed ? DESKTOP_SIDEBAR_COLLAPSED_WIDTH : DESKTOP_SIDEBAR_EXPANDED_WIDTH}px`
      }) as CSSProperties,
    [isDesktopSidebarCollapsed]
  )

  const notificationsQuery = useQuery({
    queryKey: [...WORKSPACE_NOTIFICATION_QUERY_KEY, experience, session.authUser?.id],
    queryFn: () => fetchMyNotifications(6),
    enabled: session.isAuthenticated
  })

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...WORKSPACE_NOTIFICATION_QUERY_KEY, experience, session.authUser?.id]
      })
    }
  })

  const signOutMutation = useMutation({
    mutationFn: () => signOutCurrentUser(),
    onSuccess: () => {
      setProfileMenuOpen(false)
      setNotificationPanelOpen(false)
      toast.success('Sesion cerrada')
      void navigate(surfacePaths.storefront.home)
    },
    onError: (error) => {
      toast.error('No se pudo cerrar la sesion', {
        description: toErrorMessage(error)
      })
    }
  })

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY, isDesktopSidebarCollapsed ? '1' : '0')
  }, [isDesktopSidebarCollapsed])

  useEffect(() => {
    if (!notificationPanelOpen && !profileMenuOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node

      if (notificationPanelOpen && notificationPanelRef.current && !notificationPanelRef.current.contains(target)) {
        setNotificationPanelOpen(false)
      }

      if (profileMenuOpen && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNotificationPanelOpen(false)
        setProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [notificationPanelOpen, profileMenuOpen])

  async function handleOpenNotification(notification: AppNotification) {
    if (!notification.read_at) {
      await markReadMutation.mutateAsync(notification.id)
    }

    setNotificationPanelOpen(false)

    if (!notification.action_url) {
      return
    }

    if (isExternalUrl(notification.action_url)) {
      window.location.assign(notification.action_url)
      return
    }

    void navigate(notification.action_url)
  }

  function handleMarkRead(notificationId: string) {
    markReadMutation.mutate(notificationId)
  }

  function handleActionNavigate(href: string) {
    setProfileMenuOpen(false)
    setNotificationPanelOpen(false)
    setMobileSidebarOpen(false)
    void navigate(href)
  }

  function handleSignOut() {
    signOutMutation.mutate()
  }

  return (
    <div className="tm-shell min-h-screen overflow-x-clip bg-[#f4f7fc] dark:bg-slate-900" style={shellLayoutStyle}>
      <RouteScrollManager />

      <aside
        className="fixed inset-y-0 left-0 z-50 hidden transition-[width] duration-200 ease-out lg:block"
        style={{ width: isDesktopSidebarCollapsed ? DESKTOP_SIDEBAR_COLLAPSED_WIDTH : DESKTOP_SIDEBAR_EXPANDED_WIDTH }}
      >
        <WorkspaceSidebarContent
          activeHref={location.pathname}
          config={config}
          isCollapsed={isDesktopSidebarCollapsed}
          mode="desktop"
          session={session}
          signOutPending={signOutMutation.isPending}
          userEmail={userIdentity.email}
          userInitials={userIdentity.initials}
          userName={userIdentity.displayName}
          onActionNavigate={handleActionNavigate}
          onOpenNotifications={() => setNotificationPanelOpen(true)}
          onOpenProfile={() => handleActionNavigate(config.profileHref)}
          onSignOut={handleSignOut}
          onToggleSidebar={() => setIsDesktopSidebarCollapsed((current) => !current)}
        />
      </aside>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label={`Cerrar navegacion de ${config.mobileSidebarLabel}`}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-full max-w-[20rem]">
            <WorkspaceSidebarContent
              activeHref={location.pathname}
              config={config}
              isCollapsed={false}
              mode="mobile"
              session={session}
              signOutPending={signOutMutation.isPending}
              userEmail={userIdentity.email}
              userInitials={userIdentity.initials}
              userName={userIdentity.displayName}
              onActionNavigate={handleActionNavigate}
              onOpenNotifications={() => {
                setMobileSidebarOpen(false)
                setNotificationPanelOpen(true)
              }}
              onOpenProfile={() => handleActionNavigate(config.profileHref)}
              onSignOut={handleSignOut}
              onToggleSidebar={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="min-w-0 transition-[padding] duration-200 ease-out lg:pl-(--shell-sidebar-width)">
        <header className="sticky top-0 z-40 border-b border-(--app-border) bg-white/94 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
          <div className="flex min-h-18 items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <button
              aria-label={`Abrir sidebar de ${config.mobileSidebarLabel}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-slate-300 hover:bg-white lg:hidden dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="size-5" />
            </button>

            <div className={cn('min-w-0', isWorkspace ? 'shrink-0' : 'flex-1')}>
              {!isWorkspace ? (
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{routeMeta.eyebrow}</p>
              ) : null}
              <div className={cn('flex min-w-0 flex-wrap items-center gap-2', isWorkspace ? '' : 'mt-0.5')}>
                {breadcrumbs.map((crumb, index) => (
                  <div key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-2">
                    {index > 0 ? <span className="text-sm text-slate-300">/</span> : null}
                    <span
                      className={cn(
                        'truncate text-sm font-medium',
                        index === breadcrumbs.length - 1 ? 'text-slate-950 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {crumb}
                    </span>
                  </div>
                ))}
                {!isWorkspace ? (
                  <>
                    <span className="hidden h-5 w-px bg-slate-200 lg:block dark:bg-white/10" />
                    <p className="hidden truncate text-sm text-slate-500 lg:block dark:text-slate-400">{routeMeta.description}</p>
                  </>
                ) : null}
              </div>
            </div>

            <div className={cn('hidden lg:block', isWorkspace ? 'flex-1 px-2' : 'max-w-sm flex-1')}>
              <div
                className={cn(
                  'flex h-11 items-center gap-3 rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/10 dark:bg-white/5 dark:shadow-none',
                  isWorkspace ? 'mx-auto max-w-xl' : ''
                )}
              >
                <Search aria-hidden="true" className="size-4 text-slate-400" />
                <input
                  aria-label={config.searchPlaceholder}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                  placeholder={config.searchPlaceholder}
                  readOnly
                  value=""
                />
              </div>
            </div>

            {session.isAuthenticated ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="relative" ref={notificationPanelRef}>
                  <button
                    aria-expanded={notificationPanelOpen}
                    aria-label="Abrir notificaciones"
                    className="relative inline-flex size-11 items-center justify-center rounded-2xl border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
                    type="button"
                    onClick={() => {
                      setNotificationPanelOpen((current) => !current)
                      setProfileMenuOpen(false)
                    }}
                  >
                    <Bell className="size-5" />
                    {notificationsQuery.data?.some((notification) => !notification.read_at) ? (
                      <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-primary-500" />
                    ) : null}
                  </button>

                  {notificationPanelOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40">
                      <WorkspaceNotificationPanel
                        isLoading={notificationsQuery.isLoading}
                        notifications={notificationsQuery.data ?? []}
                        onMarkRead={handleMarkRead}
                        onOpenNotification={(notification) => void handleOpenNotification(notification)}
                      />
                    </div>
                  ) : null}
                </div>

                <ThemeToggle
                  className="size-11 rounded-2xl border-transparent bg-transparent px-0 text-slate-500 shadow-none hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-transparent dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
                  compact
                />

                <div aria-hidden="true" className="hidden h-6 w-px bg-slate-200 lg:block dark:bg-white/10" />

                <div className="relative" ref={profileMenuRef}>
                  <button
                    aria-expanded={profileMenuOpen}
                    aria-label="Abrir menu de perfil"
                    className="flex items-center gap-3 rounded-2xl border border-transparent px-1.5 py-1.5 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/10 dark:hover:bg-white/5"
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen((current) => !current)
                      setNotificationPanelOpen(false)
                    }}
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 outline -outline-offset-1 outline-black/5 dark:bg-slate-800 dark:text-white dark:outline-white/10">
                      {userIdentity.initials}
                    </span>
                    <span className="hidden min-w-0 text-left lg:block">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{userIdentity.displayName}</span>
                      <span className="block truncate text-xs text-slate-400">{userIdentity.email}</span>
                    </span>
                    <ChevronDown className="hidden size-4 text-slate-400 lg:block dark:text-slate-500" />
                  </button>

                  {profileMenuOpen ? (
                    <div className="absolute right-0 z-10 mt-2.5 w-56 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_48px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-slate-900">
                      <div className="border-b border-slate-100 px-3 py-2 dark:border-white/10">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userIdentity.displayName}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userIdentity.email}</p>
                      </div>

                      <button
                        className="mt-2 block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-900 transition hover:bg-slate-50 dark:text-white dark:hover:bg-white/5"
                        type="button"
                        onClick={() => handleActionNavigate(config.profileHref)}
                      >
                        Mi perfil
                      </button>
                      {config.profileMenuLinks
                        .filter((item) => item.href !== config.profileHref)
                        .map((item) => (
                          <button
                            key={item.href}
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-900 transition hover:bg-slate-50 dark:text-white dark:hover:bg-white/5"
                            type="button"
                            onClick={() => handleActionNavigate(item.href)}
                          >
                            {item.label}
                          </button>
                        ))}
                      <button
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-900 transition hover:bg-slate-50 dark:text-white dark:hover:bg-white/5"
                        type="button"
                        onClick={handleSignOut}
                      >
                        {signOutMutation.isPending ? 'Cerrando...' : 'Cerrar sesion'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <ThemeToggle
                  className="size-11 rounded-2xl border-transparent bg-transparent px-0 text-slate-500 shadow-none hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-transparent dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
                  compact
                />
                {config.guestActions.map((action) => (
                  <Button
                    key={action.href}
                    className="rounded-full px-5"
                    disabled={action.disabled}
                    title={action.disabled ? PLATFORM_REGISTRATION_LOCKED_MESSAGE : undefined}
                    variant={action.variant === 'primary' ? undefined : action.variant}
                    onClick={() => handleActionNavigate(action.href)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main
          className={cn(
            'min-w-0 py-8 dark:bg-none',
            isWorkspace
              ? 'bg-[#f7f9fc] dark:bg-transparent'
              : 'bg-[radial-gradient(circle_at_top_right,rgba(143,171,229,0.16),transparent_24%),linear-gradient(180deg,#f4f7fc_0%,#eef3fb_100%)]'
          )}
        >
          <div className="min-w-0 px-4 sm:px-6 lg:px-8">{fallbackContent ?? <Outlet />}</div>
        </main>
      </div>

      <AppBottomNav activeHref={location.pathname} items={config.primaryNav} variant="workspace" onNavigate={(href) => void navigate(href)} />
    </div>
  )
}

export function EmployerShell({ fallbackContent }: { fallbackContent?: ReactNode }) {
  return <PlatformAppShell experience="workspace" fallbackContent={fallbackContent} />
}
