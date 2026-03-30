import type { CSSProperties, ReactNode } from 'react'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Grid2x2,
  Layers3,
  LogOut,
  Menu,
  Search,
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
import { surfacePaths } from '@/app/router/surface-paths'
import { BrandMark } from '@/components/ui/app-brand'
import { AppBottomNav, type AppNavGroup, type AppNavItem } from '@/components/ui/app-shell-navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { signOutCurrentUser, toErrorMessage } from '@/features/auth/lib/auth-api'
import { fetchMyNotifications, markNotificationRead, type AppNotification } from '@/lib/notifications/api'
import { filterNavigationItems } from '@/lib/permissions/guards'
import { cn } from '@/lib/utils/cn'
import { candidateNavigationItems, employerNavigationItems } from '@/shared/constants/navigation'
import type { NavigationItem } from '@/shared/types/navigation'

const WORKSPACE_NOTIFICATION_QUERY_KEY = ['workspace-shell', 'notifications'] as const
const WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY = 'asi:workspace-sidebar-collapsed:v1'
const DESKTOP_SIDEBAR_EXPANDED_WIDTH = 272
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = 88

type ShellExperience = 'workspace' | 'candidate' | 'storefront'
type ShellGuestAction = {
  href: string
  label: string
  variant: 'ghost' | 'outline' | 'primary'
}
type ShellConfig = {
  brand: string
  footerCaption: string
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
  tenantRoleSummary?: string
  topbarEyebrow: string
}

const workspaceIconByHref: Partial<Record<string, LucideIcon>> = {
  [surfacePaths.workspace.root]: Building2,
  [surfacePaths.workspace.jobs]: BriefcaseBusiness,
  [surfacePaths.workspace.talent]: UsersRound,
  [surfacePaths.workspace.pipeline]: Grid2x2,
  [surfacePaths.workspace.access]: Shield
}

const candidateIconByHref: Partial<Record<string, LucideIcon>> = {
  [surfacePaths.storefront.jobs]: BriefcaseBusiness,
  [surfacePaths.candidate.applications]: FileText,
  [surfacePaths.candidate.profile]: UserRound,
  [surfacePaths.candidate.onboarding]: Layers3,
  [surfacePaths.candidate.recruiterRequest]: Building2
}

const workspaceCopyByHref: Record<string, Pick<AppNavItem, 'title' | 'description'>> = {
  [surfacePaths.workspace.root]: {
    title: 'Company',
    description: 'Marca, equipo y presencia compartida de tu empresa'
  },
  [surfacePaths.workspace.jobs]: {
    title: 'Jobs',
    description: 'Vacantes, visibilidad y ritmo comercial del hiring'
  },
  [surfacePaths.workspace.talent]: {
    title: 'Candidates',
    description: 'Directorio de talento visible para tu equipo'
  },
  [surfacePaths.workspace.pipeline]: {
    title: 'Pipeline',
    description: 'Seguimiento colaborativo de cada aplicación'
  },
  [surfacePaths.workspace.access]: {
    title: 'Roles',
    description: 'Permisos, accesos y estructura del equipo'
  }
}

const candidateCopyByHref: Record<string, Pick<AppNavItem, 'title' | 'description'>> = {
  [surfacePaths.storefront.jobs]: {
    title: 'Jobs',
    description: 'Explora oportunidades abiertas y aplica con más contexto'
  },
  [surfacePaths.candidate.applications]: {
    title: 'Aplicaciones',
    description: 'Sigue el avance de cada proceso con un solo vistazo'
  },
  [surfacePaths.candidate.profile]: {
    title: 'Perfil',
    description: 'Tu presencia profesional, CV y datos clave en un mismo lugar'
  },
  [surfacePaths.candidate.onboarding]: {
    title: 'Onboarding',
    description: 'Ajustes esenciales para dejar tu cuenta lista'
  },
  [surfacePaths.candidate.recruiterRequest]: {
    title: 'Acceso employer',
    description: 'Solicita llevar tu empresa a la plataforma'
  }
}

const storefrontCopyByHref: Record<string, Pick<AppNavItem, 'title' | 'description'>> = {
  [surfacePaths.storefront.home]: {
    title: 'Producto',
    description: 'Resumen comercial, beneficios y propuesta de valor'
  },
  [surfacePaths.storefront.jobs]: {
    title: 'Jobs',
    description: 'Vacantes públicas, detalles y acceso al flujo de aplicación'
  },
  [surfacePaths.auth.signIn]: {
    title: 'Iniciar sesión',
    description: 'Accede a tu cuenta para continuar en la plataforma'
  },
  [surfacePaths.auth.signUp]: {
    title: 'Crear cuenta',
    description: 'Comienza tu acceso a la plataforma con una cuenta nueva'
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
        <div className="rounded-[20px] border border-dashed border-(--app-border) bg-(--app-surface) px-4 py-6 text-sm text-(--app-text-muted)">
          Cargando notificaciones...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-(--app-border) bg-(--app-surface) px-4 py-6 text-sm text-(--app-text-muted)">
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
      <div className="border-t border-slate-200 px-2.5 py-3 dark:border-white/10">
        <button
          className={cn(
            'flex min-h-11 w-full items-center rounded-xl text-left text-sm font-medium transition',
            showCollapsedLabels ? 'justify-center px-2' : 'gap-3 px-3',
            'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
          )}
          title={showCollapsedLabels ? config.publicActionLabel : undefined}
          type="button"
          onClick={() => onActionNavigate(config.publicActionHref)}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300">
            <Sparkles className="size-4.5" />
          </span>
          {!showCollapsedLabels ? <span>{config.publicActionLabel}</span> : <span className="sr-only">{config.publicActionLabel}</span>}
        </button>

        <div className="mt-3 grid gap-2">
          {config.guestActions.map((action) => (
            <Button
              key={action.href}
              className="w-full"
              variant={action.variant === 'primary' ? undefined : action.variant}
              onClick={() => onActionNavigate(action.href)}
            >
              {action.label}
            </Button>
          ))}
        </div>

        {!showCollapsedLabels ? (
          <div className="mt-4 border-t border-slate-200 pt-4 text-center dark:border-white/10">
            <p className="text-xs leading-5 text-slate-400">© {footerYear} {config.brand}</p>
            <p className="mt-1 text-xs font-medium text-slate-400">{config.footerCaption}</p>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="border-t border-slate-200 px-2.5 py-3 dark:border-white/10">
      <button
        className={cn(
          'flex min-h-11 w-full items-center rounded-xl text-left text-sm font-medium transition',
          showCollapsedLabels ? 'justify-center px-2' : 'gap-3 px-3',
          'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
        )}
        title={showCollapsedLabels ? config.publicActionLabel : undefined}
        type="button"
        onClick={() => onActionNavigate(config.publicActionHref)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300">
          <BriefcaseBusiness className="size-4.5" />
        </span>
        {!showCollapsedLabels ? <span>{config.publicActionLabel}</span> : <span className="sr-only">{config.publicActionLabel}</span>}
      </button>

      {!isDesktop ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900 dark:border-white/10 dark:bg-white/10 dark:text-white">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userEmail}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <button
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 transition hover:bg-white dark:text-slate-200 dark:hover:bg-white/10"
              type="button"
              onClick={onOpenProfile}
            >
              <UserRound className="size-4" />
              Mi perfil
            </button>
            <button
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 transition hover:bg-white dark:text-slate-200 dark:hover:bg-white/10"
              type="button"
              onClick={onOpenNotifications}
            >
              <Bell className="size-4" />
              Notificaciones
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'mt-3 flex items-center',
          showCollapsedLabels ? 'justify-center' : 'gap-3 px-1'
        )}
        title={showCollapsedLabels ? userName : undefined}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-950">
          {userInitials}
        </div>
        {!showCollapsedLabels ? (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{userName}</p>
            {config.tenantRoleSummary ? <p className="truncate text-[11px] text-slate-400">{config.tenantRoleSummary}</p> : null}
          </div>
        ) : (
          <span className="sr-only">{userName}</span>
        )}
      </div>

      <button
        aria-label="Cerrar sesion"
        className={cn(
          'mt-4 flex min-h-11 w-full items-center rounded-xl text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-200',
          showCollapsedLabels ? 'justify-center px-2' : 'gap-3 px-3'
        )}
        title={showCollapsedLabels ? 'Cerrar sesion' : undefined}
        type="button"
        onClick={onSignOut}
      >
        <LogOut className="size-4.5" />
        {!showCollapsedLabels ? <span>{signOutPending ? 'Cerrando...' : 'Cerrar sesion'}</span> : <span className="sr-only">Cerrar sesion</span>}
      </button>

      {!showCollapsedLabels ? (
        <div className="mt-4 border-t border-slate-200 pt-4 text-center dark:border-white/10">
          <p className="text-xs leading-5 text-slate-400">© {footerYear} {config.brand}</p>
          <p className="mt-1 text-xs font-medium text-slate-400">{config.footerCaption}</p>
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-white">
      <div className="border-b border-slate-200 px-3 py-3.5 dark:border-white/10">
        <div className={cn('flex items-center', showCollapsedLabels ? 'justify-center' : 'gap-3')}>
          <BrandMark panelClassName="size-10 rounded-[14px] border-primary-200/40 bg-primary-600 p-2 shadow-[0_16px_36px_rgba(43,69,143,0.2)] dark:border-white/10" />
          {!showCollapsedLabels ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-950 dark:text-white">{config.brand}</p>
              <p className="mt-0.5 truncate text-xs uppercase tracking-[0.18em] text-slate-400">{config.tenantName}</p>
            </div>
          ) : null}
          <button
            aria-label={
              isDesktop
                ? isCollapsed
                  ? `Expandir sidebar de ${config.mobileSidebarLabel}`
                  : `Contraer sidebar de ${config.mobileSidebarLabel}`
                : `Cerrar sidebar de ${config.mobileSidebarLabel}`
            }
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
            type="button"
            onClick={onToggleSidebar}
          >
            {isDesktop ? isCollapsed ? <ChevronRight className="size-4.5" /> : <ChevronLeft className="size-4.5" /> : <X className="size-4.5" />}
          </button>
        </div>
        {showCollapsedLabels ? <span className="sr-only">{config.tenantName}</span> : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <nav aria-label={`${config.brand} navigation`} className="flex-1 overflow-y-auto px-2.5 py-3">
          {config.sidebarGroups.map((group, groupIndex) => (
            <div key={group.title ?? `group-${groupIndex}`} className={cn(groupIndex === 0 ? '' : 'mt-3 border-t border-slate-200 pt-3 dark:border-white/10')}>
              {group.title && !showCollapsedLabels ? (
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group.title}</p>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeItemHref === item.href
                  const Icon = item.icon

                  return (
                    <button
                      key={item.href}
                      aria-label={item.title}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group flex min-h-11 w-full items-center rounded-xl text-left text-sm font-medium transition',
                        showCollapsedLabels ? 'justify-center px-2' : 'gap-3 px-3',
                        isActive
                          ? 'bg-slate-900 text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)] dark:bg-white dark:text-slate-950'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                      )}
                      data-active={isActive ? 'true' : 'false'}
                      title={showCollapsedLabels ? item.title : undefined}
                      type="button"
                      onClick={() => onActionNavigate(item.href)}
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg transition',
                          isActive
                            ? 'bg-white/12 text-current dark:bg-slate-900/10'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-900 dark:bg-white/5 dark:text-slate-300 dark:group-hover:bg-white/10 dark:group-hover:text-white'
                        )}
                      >
                        {Icon ? <Icon className="size-4.5" /> : null}
                      </span>
                      {!showCollapsedLabels ? (
                        <span className="min-w-0">
                          <span className="block truncate">{item.title}</span>
                          {item.description ? <span className={cn('mt-0.5 block truncate text-[11px]', isActive ? 'text-white/72 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500')}>{item.description}</span> : null}
                        </span>
                      ) : (
                        <span className="sr-only">{item.title}</span>
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

function buildWorkspaceConfig(session: ReturnType<typeof useAppSession>) {
  const shouldExposeRoleSummary = session.canAccessAdminConsole
  const visibleNavigation = filterNavigationItems(employerNavigationItems, session.permissions, session.isAuthenticated).map((item) =>
    mapNavItem(item, 'workspace')
  )
  const candidateNavItem = session.isAuthenticated
    ? ({
        href: surfacePaths.candidate.profile,
        title: 'Mi perfil',
        description: 'Abre tu espacio de candidato sin salir de la plataforma',
        icon: UserRound
      } satisfies AppNavItem)
    : null

  const primaryNav: AppNavItem[] = [
    surfacePaths.workspace.jobs,
    surfacePaths.workspace.talent,
    surfacePaths.workspace.pipeline,
    surfacePaths.workspace.root,
    ...(candidateNavItem ? [surfacePaths.candidate.profile] : [])
  ]
    .map((href) => (href === surfacePaths.candidate.profile ? candidateNavItem : findNavItem(visibleNavigation, href)))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const secondaryNav: AppNavItem[] = [surfacePaths.workspace.access]
    .map((href) => findNavItem(visibleNavigation, href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return {
    brand: 'ASI para equipos',
    footerCaption: 'Shell compartido de plataforma',
    guestActions: [],
    mobileSidebarLabel: 'workspace',
    primaryNav,
    profileHref: surfacePaths.candidate.profile,
    profileMenuLinks: secondaryNav.map((item) => ({ href: item.href, label: item.title })),
    publicActionHref: surfacePaths.storefront.jobs,
    publicActionLabel: 'Ver job board publico',
    routeMeta: workspaceCopyByHref,
    routeMetaDefault: {
      title: 'Workspace',
      description: 'Centro operativo del equipo de reclutamiento.'
    },
    searchPlaceholder: 'Buscar en el workspace (próximamente)',
    sidebarGroups: [
      {
        title: 'Workspace',
        items: [
          ...[surfacePaths.workspace.root, surfacePaths.workspace.jobs, surfacePaths.workspace.talent, surfacePaths.workspace.pipeline]
            .map((href) => findNavItem(visibleNavigation, href))
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
        ]
      },
      ...(candidateNavItem
        ? [
            {
              title: 'Mi cuenta',
              items: [candidateNavItem]
            }
          ]
        : []),
      ...(secondaryNav.length
        ? [
            {
              title: 'Administra',
              items: secondaryNav
            }
          ]
        : [])
    ],
    tenantName: session.activeMembership?.tenantName ?? 'Tu espacio de empresa',
    tenantRoleSummary: shouldExposeRoleSummary
      ? session.activeMembership?.roleNames.filter(Boolean).join(', ') || 'Miembro del workspace'
      : undefined,
    topbarEyebrow: 'Workspace operativo'
  } satisfies ShellConfig
}

function buildCandidateConfig(session: ReturnType<typeof useAppSession>) {
  const shouldExposeRoleSummary = session.canAccessAdminConsole
  const visibleNavigation = filterNavigationItems(candidateNavigationItems, session.permissions, session.isAuthenticated).map((item) =>
    mapNavItem(item, 'candidate')
  )
  const hasWorkspaceAccess = session.permissions.includes('workspace:read')
  const workspaceNavItem = hasWorkspaceAccess
    ? ({
        href: surfacePaths.workspace.root,
        title: 'Workspace',
        description: 'Entra al espacio operativo de tu empresa',
        icon: Building2
      } satisfies AppNavItem)
    : null

  const primaryNav: AppNavItem[] = [
    surfacePaths.storefront.jobs,
    surfacePaths.candidate.applications,
    surfacePaths.candidate.profile,
    surfacePaths.candidate.onboarding,
    ...(hasWorkspaceAccess ? [surfacePaths.workspace.root] : [])
  ]
    .map((href) => (href === surfacePaths.workspace.root ? workspaceNavItem : findNavItem(visibleNavigation, href)))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return {
    brand: 'ASI para talento',
    footerCaption: 'Shell compartido de plataforma',
    guestActions: [],
    mobileSidebarLabel: 'candidate',
    primaryNav,
    profileHref: surfacePaths.candidate.profile,
    profileMenuLinks: [
      ...(hasWorkspaceAccess && workspaceNavItem ? [{ href: workspaceNavItem.href, label: workspaceNavItem.title }] : []),
      ...[surfacePaths.candidate.applications, surfacePaths.candidate.onboarding]
        .map((href) => findNavItem(visibleNavigation, href))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => ({ href: item.href, label: item.title }))
    ],
    publicActionHref: surfacePaths.storefront.jobs,
    publicActionLabel: 'Explorar jobs',
    routeMeta: candidateCopyByHref,
    routeMetaDefault: {
      title: 'Tu espacio',
      description: 'Tu perfil, oportunidades y progreso en un solo lugar.'
    },
    searchPlaceholder: 'Buscar oportunidades (próximamente)',
    sidebarGroups: [
      {
        title: 'Candidato',
        items: [
          ...(workspaceNavItem ? [workspaceNavItem] : []),
          ...[surfacePaths.candidate.profile, surfacePaths.candidate.applications, surfacePaths.storefront.jobs]
            .map((href) => findNavItem(visibleNavigation, href))
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
        ]
      },
      {
        title: 'Cuenta',
        items: [
          ...[surfacePaths.candidate.onboarding, surfacePaths.candidate.recruiterRequest]
            .map((href) => findNavItem(visibleNavigation, href))
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
        ]
      }
    ],
    tenantName: session.profile?.display_name ?? session.profile?.full_name ?? 'Tu espacio profesional',
    tenantRoleSummary: shouldExposeRoleSummary ? 'Cuenta de candidato' : undefined,
    topbarEyebrow: 'Ruta de candidato'
  } satisfies ShellConfig
}

function buildStorefrontConfig(session: ReturnType<typeof useAppSession>) {
  const hasWorkspaceAccess = session.permissions.includes('workspace:read')
  const shouldExposeRoleSummary = session.canAccessAdminConsole
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
        },
        {
          href: surfacePaths.auth.signUp,
          title: 'Crear cuenta',
          description: 'Comienza tu acceso a la plataforma',
          icon: Building2
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
      description: 'Vacantes públicas, detalles y aplicación',
      icon: BriefcaseBusiness
    },
    ...accountItems
  ]

  return {
    brand: 'Plataforma ASI',
    footerCaption: 'Shell compartido de plataforma',
    guestActions: [
      { href: surfacePaths.institutional.home, label: 'ASI institucional', variant: 'ghost' },
      { href: surfacePaths.auth.signUp, label: 'Crear cuenta', variant: 'outline' },
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
      description: 'Acceso público a jobs, pricing y rutas de entrada al producto.'
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
    tenantRoleSummary:
      session.isAuthenticated && shouldExposeRoleSummary
        ? hasWorkspaceAccess
          ? 'Cuenta con acceso a workspace'
          : 'Cuenta autenticada'
        : undefined,
    topbarEyebrow: 'Plataforma pública'
  } satisfies ShellConfig
}

function buildShellConfig(experience: ShellExperience, session: ReturnType<typeof useAppSession>) {
  if (experience === 'candidate') {
    return buildCandidateConfig(session)
  }

  if (experience === 'storefront') {
    return buildStorefrontConfig(session)
  }

  return buildWorkspaceConfig(session)
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
  const userIdentity = resolveUserIdentity(session)
  const routeMeta = getRouteMeta(location.pathname, config.topbarEyebrow, config.routeMeta, config.routeMetaDefault)

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
    <div className="tm-shell min-h-screen overflow-x-clip bg-white dark:bg-slate-900" style={shellLayoutStyle}>
      <aside
        className="fixed inset-y-0 left-0 z-50 hidden lg:block"
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

      <div className="min-w-0 lg:pl-[var(--shell-sidebar-width)]">
        <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/92 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
          <div className="flex min-h-18 items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <button
              aria-label={`Abrir sidebar de ${config.mobileSidebarLabel}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-slate-300 hover:bg-white lg:hidden dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="size-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{routeMeta.eyebrow}</p>
              <div className="mt-0.5 flex min-w-0 items-center gap-3">
                <p className="truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{routeMeta.title}</p>
                <span className="hidden h-5 w-px bg-slate-200 lg:block dark:bg-white/10" />
                <p className="hidden truncate text-sm text-slate-500 lg:block dark:text-slate-400">{routeMeta.description}</p>
              </div>
            </div>

            <div className="hidden max-w-sm flex-1 lg:block">
              <div className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
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
                      {config.tenantRoleSummary ? (
                        <span className="block truncate text-xs text-slate-400">{config.tenantRoleSummary}</span>
                      ) : null}
                    </span>
                    <ChevronDown className="hidden size-4 text-slate-400 lg:block dark:text-slate-500" />
                  </button>

                  {profileMenuOpen ? (
                    <div className="absolute right-0 z-10 mt-2.5 w-56 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_48px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-slate-900">
                      <div className="border-b border-slate-100 px-3 py-2 dark:border-white/10">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userIdentity.displayName}</p>
                        {config.tenantRoleSummary ? (
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{config.tenantRoleSummary}</p>
                        ) : null}
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

        <main className="min-w-0 py-8">
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
