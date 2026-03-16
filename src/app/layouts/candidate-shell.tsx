import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { AppBottomNav, AppSidebarNav, type AppNavItem } from '@/components/ui/app-shell-navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { filterNavigationItems } from '@/lib/permissions/guards'
import { candidateNavigationItems } from '@/shared/constants/navigation'

function findNavItem(items: typeof candidateNavigationItems, href: string) {
  return items.find((item) => item.href === href)
}

export function CandidateShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAppSession()
  const visibleNavigation = filterNavigationItems(candidateNavigationItems, session.permissions, session.isAuthenticated)

  const primaryNav: AppNavItem[] = ['/jobs', '/applications', '/candidate/profile', '/onboarding']
    .map((href) => findNavItem(visibleNavigation, href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => (item.href === '/onboarding' ? { ...item, title: 'More' } : item))

  const sidebarNav: AppNavItem[] = [
    ...['/candidate/profile', '/applications', '/jobs']
      .map((href) => findNavItem(visibleNavigation, href))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    ...['/onboarding', '/recruiter-request']
      .map((href) => findNavItem(visibleNavigation, href))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  ]

  const currentItem = sidebarNav.find((item) => item.href === location.pathname)

  return (
    <div className="tm-shell">
      <div className="mx-auto flex min-h-screen max-w-[1380px] gap-6 px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <AppSidebarNav
          activeHref={location.pathname}
          brand="Para talento"
          description="Tu perfil, tus oportunidades y el avance de cada proceso en un solo lugar."
          footer={
            <Button className="w-full" variant="outline" onClick={() => void navigate('/recruiter-request')}>
              Llevar mi empresa a la plataforma
            </Button>
          }
          items={sidebarNav}
          title="Tu espacio profesional"
          onNavigate={(href) => void navigate(href)}
        />

        <div className="flex min-h-screen flex-1 flex-col gap-5">
          <header className="tm-shell-panel sticky top-4 z-20 rounded-[24px]">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">
                  Tu cuenta
                </p>
                <p className="text-lg font-semibold tracking-tight text-[var(--app-text)]">
                  {currentItem?.title ?? 'Tu espacio de oportunidades'}
                </p>
                <p className="text-sm text-[var(--app-text-muted)]">
                  {currentItem?.description ?? 'Mantén tu perfil al día, aplica más rápido y revisa tu avance con calma.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ThemeToggle />
                <Button variant="outline" onClick={() => void navigate('/jobs')}>
                  Explorar jobs
                </Button>
                <Button variant="ghost" onClick={() => void navigate('/onboarding')}>
                  Onboarding
                </Button>
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
