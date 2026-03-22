import type { ReactNode } from 'react'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  UserRound
} from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import {
  AppBottomNav,
  AppWorkspaceSidebar,
  AppWorkspaceSidebarDrawer,
  type AppNavGroup,
  type AppNavItem
} from '@/components/ui/app-shell-navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { signOutCurrentUser, toErrorMessage } from '@/features/auth/lib/auth-api'
import { fetchMyNotifications, markNotificationRead, type AppNotification } from '@/lib/notifications/api'
import { filterNavigationItems } from '@/lib/permissions/guards'
import { cn } from '@/lib/utils/cn'
import { employerNavigationItems } from '@/shared/constants/navigation'

const WORKSPACE_NOTIFICATION_QUERY_KEY = ['workspace-shell', 'notifications'] as const

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

function mapWorkspaceItem(item: (typeof employerNavigationItems)[number]): AppNavItem {
  const copy = workspaceCopyByHref[item.href] ?? {
    title: item.title,
    description: item.description
  }

  return {
    ...item,
    ...copy
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
    <div className="w-[min(24rem,calc(100vw-2rem))] rounded-[26px] border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-3 shadow-[0_28px_72px_rgba(8,12,24,0.22)]">
      <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
        <div>
          <p className="text-sm font-semibold text-[var(--app-text)]">Notificaciones</p>
          <p className="text-xs text-[var(--app-text-muted)]">Últimos eventos relevantes para tu cuenta.</p>
        </div>
        <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--app-text-muted)]">
          {notifications.filter((notification) => !notification.read_at).length} sin leer
        </span>
      </div>

      {isLoading ? (
        <div className="rounded-[20px] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-6 text-sm text-[var(--app-text-muted)]">
          Cargando notificaciones...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-6 text-sm text-[var(--app-text-muted)]">
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
                  ? 'border-[var(--app-border)] bg-[var(--app-surface)]'
                  : 'border-primary-200 bg-primary-50/80 dark:border-primary-500/24 dark:bg-primary-500/10'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--app-text)]">{notification.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">{notification.body}</p>
                </div>
                {!notification.read_at ? (
                  <span className="mt-1 size-2.5 shrink-0 rounded-full bg-primary-500 shadow-[0_0_0_4px_rgba(74,99,211,0.14)]" />
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">
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

export function EmployerShell({ fallbackContent }: { fallbackContent?: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAppSession()
  const queryClient = useQueryClient()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const notificationPanelRef = useRef<HTMLDivElement | null>(null)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  const visibleNavigation = filterNavigationItems(employerNavigationItems, session.permissions, session.isAuthenticated).map(mapWorkspaceItem)

  const primaryNav: AppNavItem[] = [
    surfacePaths.workspace.jobs,
    surfacePaths.workspace.talent,
    surfacePaths.workspace.pipeline,
    surfacePaths.workspace.root
  ]
    .map((href) => findNavItem(visibleNavigation, href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const secondaryNav: AppNavItem[] = [surfacePaths.workspace.access]
    .map((href) => findNavItem(visibleNavigation, href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const sidebarGroups: AppNavGroup[] = [
    {
      title: 'Workspace',
      items: [
        ...[surfacePaths.workspace.root, surfacePaths.workspace.jobs, surfacePaths.workspace.talent, surfacePaths.workspace.pipeline]
          .map((href) => findNavItem(visibleNavigation, href))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      ]
    },
    ...(secondaryNav.length
      ? [
          {
            title: 'Administra',
            items: secondaryNav
          }
        ]
      : [])
  ]

  const tenantName = session.activeMembership?.tenantName ?? 'Tu espacio de empresa'
  const tenantRoleSummary =
    session.activeMembership?.roleNames.filter(Boolean).join(', ') || 'Miembro del workspace'
  const userIdentity = resolveUserIdentity(session)

  const notificationsQuery = useQuery({
    queryKey: [...WORKSPACE_NOTIFICATION_QUERY_KEY, session.authUser?.id],
    queryFn: () => fetchMyNotifications(6),
    enabled: session.isAuthenticated
  })

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...WORKSPACE_NOTIFICATION_QUERY_KEY, session.authUser?.id]
      })
    }
  })

  const signOutMutation = useMutation({
    mutationFn: () => signOutCurrentUser(),
    onSuccess: () => {
      setProfileMenuOpen(false)
      setNotificationPanelOpen(false)
      toast.success('Sesion cerrada')
      void navigate(surfacePaths.public.home)
    },
    onError: (error) => {
      toast.error('No se pudo cerrar la sesion', {
        description: toErrorMessage(error)
      })
    }
  })

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

  function handleSignOut() {
    signOutMutation.mutate()
  }

  function renderSidebarFooter() {
    return (
      <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/10">
        <Button
          className="w-full justify-start rounded-md border-slate-200 bg-white text-slate-900 hover:border-primary-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
          variant="outline"
          onClick={() => void navigate(surfacePaths.public.jobs)}
        >
          <BriefcaseBusiness className="size-4" />
          Ver job board publico
        </Button>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900 dark:border-white/10 dark:bg-white/10 dark:text-white">
              {userIdentity.initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userIdentity.displayName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userIdentity.email}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <Button
              className="justify-start rounded-md text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
              variant="ghost"
              onClick={() => {
                setMobileSidebarOpen(false)
                void navigate(surfacePaths.candidate.profile)
              }}
            >
              <UserRound className="size-4" />
              Mi perfil
            </Button>
            <Button
              className="justify-start rounded-md text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
              variant="ghost"
              onClick={() => {
                setMobileSidebarOpen(false)
                setNotificationPanelOpen(true)
              }}
            >
              <Bell className="size-4" />
              Notificaciones
            </Button>
          </div>
        </div>

        <Button
          aria-label="Cerrar sesion"
          className="w-full justify-start rounded-md border-rose-200/80 bg-rose-50/80 text-rose-700 hover:border-rose-300 hover:bg-rose-100/80 hover:text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/16 dark:hover:text-rose-100"
          variant="ghost"
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
          {signOutMutation.isPending ? 'Cerrando...' : 'Cerrar sesion'}
        </Button>
      </div>
    )
  }

  return (
    <div className="tm-shell min-h-screen overflow-x-clip bg-white dark:bg-slate-900">
      <AppWorkspaceSidebar
        activeHref={location.pathname}
        brand="ASI para equipos"
        footer={renderSidebarFooter()}
        groups={sidebarGroups}
        onNavigate={(href) => void navigate(href)}
        tenantName={tenantName}
      />

      <AppWorkspaceSidebarDrawer
        activeHref={location.pathname}
        brand="ASI para equipos"
        footer={renderSidebarFooter()}
        groups={sidebarGroups}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        onNavigate={(href) => void navigate(href)}
        tenantName={tenantName}
      />

      <div className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 dark:border-white/10 dark:bg-slate-900 dark:shadow-none">
          <button
            aria-label="Abrir sidebar del workspace"
            className="-m-2.5 p-2.5 text-slate-700 hover:text-slate-900 lg:hidden dark:text-slate-400 dark:hover:text-white"
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="size-6" />
          </button>

          <div aria-hidden="true" className="h-6 w-px bg-slate-200 lg:hidden dark:bg-white/10" />

          <div className="flex min-w-0 flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="grid flex-1 grid-cols-1">
              <input
                aria-label="Buscar en el workspace"
                className="col-start-1 row-start-1 block size-full bg-transparent pl-8 text-base text-slate-900 outline-none placeholder:text-slate-400 sm:text-sm/6 dark:text-white dark:placeholder:text-slate-500"
                placeholder="Buscar en el workspace (próximamente)"
                readOnly
                value=""
              />
              <Search
                aria-hidden="true"
                className="pointer-events-none col-start-1 row-start-1 size-5 self-center text-slate-400"
              />
            </div>

            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <div className="relative" ref={notificationPanelRef}>
                <button
                  aria-expanded={notificationPanelOpen}
                  aria-label="Abrir notificaciones"
                  className="relative -m-2.5 p-2.5 text-slate-400 hover:text-slate-500 dark:hover:text-white"
                  type="button"
                  onClick={() => {
                    setNotificationPanelOpen((current) => !current)
                    setProfileMenuOpen(false)
                  }}
                >
                  <Bell className="size-6" />
                  {notificationsQuery.data?.some((notification) => !notification.read_at) ? (
                    <span className="absolute right-1 top-1.5 size-2 rounded-full bg-primary-500" />
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
                className="size-10 rounded-md border-transparent bg-transparent px-0 text-slate-500 shadow-none hover:bg-slate-100 hover:text-slate-900 dark:bg-transparent dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                compact
              />

              <div aria-hidden="true" className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200 dark:lg:bg-white/10" />

              <div className="relative" ref={profileMenuRef}>
                <button
                  aria-expanded={profileMenuOpen}
                  aria-label="Abrir menu de perfil"
                  className="relative flex items-center"
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen((current) => !current)
                    setNotificationPanelOpen(false)
                  }}
                >
                  <span className="absolute -inset-1.5" />
                  <span className="sr-only">Abrir menu de perfil</span>
                  <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 outline -outline-offset-1 outline-black/5 dark:bg-slate-800 dark:text-white dark:outline-white/10">
                    {userIdentity.initials}
                  </span>
                  <span className="hidden lg:flex lg:items-center">
                    <span aria-hidden="true" className="ml-4 text-sm/6 font-semibold text-slate-900 dark:text-white">
                      {userIdentity.displayName}
                    </span>
                    <ChevronDown aria-hidden="true" className="ml-2 size-5 text-slate-400 dark:text-slate-500" />
                  </span>
                </button>

                {profileMenuOpen ? (
                  <div className="absolute right-0 z-10 mt-2.5 w-44 origin-top-right rounded-md bg-white py-2 shadow-lg outline-1 outline-slate-900/5 dark:bg-slate-800 dark:outline-white/10">
                    <div className="border-b border-slate-100 px-3 py-2 dark:border-white/10">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userIdentity.displayName}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{tenantRoleSummary}</p>
                    </div>

                    <button
                      className="block w-full px-3 py-2 text-left text-sm/6 text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-white/5"
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false)
                        void navigate(surfacePaths.candidate.profile)
                      }}
                    >
                      Mi perfil
                    </button>
                    {secondaryNav.length ? (
                      <button
                        className="block w-full px-3 py-2 text-left text-sm/6 text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-white/5"
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false)
                          void navigate(surfacePaths.workspace.access)
                        }}
                      >
                        Roles y acceso
                      </button>
                    ) : null}
                    <button
                      className="block w-full px-3 py-2 text-left text-sm/6 text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-white/5"
                      type="button"
                      onClick={handleSignOut}
                    >
                      {signOutMutation.isPending ? 'Cerrando...' : 'Cerrar sesion'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 py-8">
          <div className="min-w-0 px-4 sm:px-6 lg:px-8">
            {fallbackContent ?? <Outlet />}
          </div>
        </main>
      </div>

      <AppBottomNav activeHref={location.pathname} items={primaryNav} variant="workspace" onNavigate={(href) => void navigate(href)} />
    </div>
  )
}
