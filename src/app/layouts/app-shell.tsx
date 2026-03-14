import { NavLink, Outlet } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { filterNavigationItems } from '@/lib/permissions/guards'
import { cn } from '@/lib/utils/cn'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { demoSession, navigationItems } from '@/shared/constants/navigation'
import type { NavigationItem } from '@/shared/types/navigation'

function NavigationLinks({ items, compact = false }: { items: NavigationItem[]; compact?: boolean }) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
              compact ? 'justify-center' : 'justify-between',
              isActive
                ? 'bg-primary-100 text-primary-700 shadow-sm'
                : 'text-zinc-600 hover:bg-white hover:text-zinc-900'
            )
          }
        >
          <span>{item.title}</span>
          {!compact ? <span className="text-xs text-zinc-400">{item.description}</span> : null}
        </NavLink>
      ))}
    </>
  )
}

export function AppShell() {
  const isOnline = useOnlineStatus()
  const visibleNavigation = filterNavigationItems(navigationItems, demoSession.permissions)

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {!isOnline ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Offline mode activo. La shell sigue disponible y las mutaciones deben reintentarse cuando vuelva la red.
        </div>
      ) : null}

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
        <aside className="hidden w-80 shrink-0 border-r border-zinc-200 bg-white/70 px-6 py-8 backdrop-blur md:flex md:flex-col">
          <div className="space-y-4">
            <Badge variant="soft">Fase 0</Badge>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Talent Marketplace SaaS</h1>
              <p className="text-sm leading-6 text-zinc-600">
                Base mobile-first, PWA-first, RBAC-first y Supabase-first para el marketplace de talento.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sesion demo</p>
            <p className="mt-2 text-base font-semibold text-zinc-900">{demoSession.displayName}</p>
            <p className="mt-1 text-sm text-zinc-600">{demoSession.activeRole}</p>
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-2">
            <NavigationLinks items={visibleNavigation} />
          </nav>

          <div className="rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            Las rutas y la navegacion ya respetan permisos visibles desde el scaffold.
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Recruiting SaaS Platform</p>
                <h2 className="text-lg font-semibold text-zinc-950">Arquitectura base del proyecto</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>React 19</Badge>
                <Badge>Tailwind v4</Badge>
                <Badge>Supabase-first</Badge>
                <Badge>PWA</Badge>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200 bg-white/95 px-3 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-2">
          <NavigationLinks items={visibleNavigation.slice(0, 4)} compact />
        </div>
      </nav>
    </div>
  )
}
