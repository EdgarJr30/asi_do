import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { AppBottomNav, AppSidebarNav, type AppNavItem } from '@/components/ui/app-shell-navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { filterNavigationItems } from '@/lib/permissions/guards'
import { employerNavigationItems } from '@/shared/constants/navigation'

function findNavItem(items: typeof employerNavigationItems, href: string) {
  return items.find((item) => item.href === href)
}

export function EmployerShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAppSession()
  const visibleNavigation = filterNavigationItems(employerNavigationItems, session.permissions, session.isAuthenticated)

  const primaryNav: AppNavItem[] = ['/jobs/manage', '/talent', '/pipeline', '/workspace']
    .map((href) => findNavItem(visibleNavigation, href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const sidebarNav: AppNavItem[] = [
    ...primaryNav,
    ...['/rbac']
      .map((href) => findNavItem(visibleNavigation, href))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  ]

  const currentItem = sidebarNav.find((item) => item.href === location.pathname)

  return (
    <div className="tm-shell">
      <div className="mx-auto flex min-h-screen max-w-[1420px] gap-6 px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <AppSidebarNav
          activeHref={location.pathname}
          brand="Para equipos"
          description="Publica vacantes, descubre talento y coordina contrataciones con una experiencia clara."
          footer={
            <Button className="w-full" variant="outline" onClick={() => void navigate('/jobs')}>
              Ver job board publico
            </Button>
          }
          items={sidebarNav}
          title={session.primaryMembership?.tenantName ?? 'Tu espacio de empresa'}
          onNavigate={(href) => void navigate(href)}
        />

        <div className="flex min-h-screen flex-1 flex-col gap-5">
          <header className="tm-shell-panel sticky top-4 z-20 rounded-[24px]">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">
                  Tu empresa
                </p>
                <p className="text-lg font-semibold tracking-tight text-[var(--app-text)]">
                  {currentItem?.title ?? 'Tu espacio de hiring'}
                </p>
                <p className="text-sm text-[var(--app-text-muted)]">
                  {currentItem?.description ?? 'Organiza vacantes, personas y procesos con un ritmo fácil de seguir.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ThemeToggle />
                <Button variant="outline" onClick={() => void navigate('/workspace')}>
                  Company
                </Button>
                <Button onClick={() => void navigate('/jobs/manage')}>Nueva vacante</Button>
              </div>
            </div>
          </header>

          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>

      <AppBottomNav activeHref={location.pathname} items={primaryNav} onNavigate={(href) => void navigate(href)} />
    </div>
  )
}
