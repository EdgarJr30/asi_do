import type { ReactNode } from 'react'

import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { RouteScrollManager } from '@/app/router/route-scroll-manager'
import { BrandMark } from '@/components/ui/app-brand'
import { AppSidebarNav } from '@/components/ui/app-shell-navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { filterNavigationItems } from '@/lib/permissions/guards'
import { surfacePaths } from '@/app/router/surface-paths'
import { adminNavigationItems } from '@/shared/constants/navigation'

export function AdminShell({ fallbackContent }: { fallbackContent?: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAppSession()
  const visibleNavigation = filterNavigationItems(adminNavigationItems, session.permissions, session.isAuthenticated)
  const currentItem = visibleNavigation.find((item) => item.href === location.pathname)

  return (
    <div className="tm-shell overflow-x-clip">
      <RouteScrollManager />

      <div className="mx-auto flex min-h-screen max-w-[1420px] gap-6 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <AppSidebarNav
          activeHref={location.pathname}
          brand="ASI admin"
          brandMark={<BrandMark panelClassName="bg-(--app-text)" />}
          description="Zona restringida para operaciones, aprobaciones, moderación y seguimiento técnico."
          footer={
            <Button className="w-full" variant="outline" onClick={() => void navigate(surfacePaths.public.home)}>
              Volver al producto
            </Button>
          }
          items={visibleNavigation}
          title="Platform console"
          onNavigate={(href) => void navigate(href)}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col gap-5">
          <header className="tm-shell-panel sticky top-4 z-20 rounded-[24px]">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--app-text-subtle)">
                  Restricted surface
                </p>
                <p className="text-lg font-semibold tracking-tight text-(--app-text)">
                  {currentItem?.title ?? 'Admin console'}
                </p>
                <p className="text-sm text-(--app-text-muted)">
                  {currentItem?.description ?? 'Herramientas administrativas separadas del producto que ve el cliente final.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ThemeToggle />
                <Button variant="ghost" onClick={() => void navigate(surfacePaths.admin.root)}>
                  Overview
                </Button>
                <Button variant="outline" onClick={() => void navigate(surfacePaths.public.home)}>
                  Producto
                </Button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1">
            {fallbackContent ?? <Outlet />}
          </main>
        </div>
      </div>
    </div>
  )
}
