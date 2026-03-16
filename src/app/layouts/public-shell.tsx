import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils/cn'

const publicNavigation = [
  { label: 'Como funciona', to: '/#features' },
  { label: 'Pricing', to: '/#pricing' },
  { label: 'FAQ', to: '/#faq' },
  { label: 'Jobs', to: '/jobs' }
] as const

function scrollToHashTarget(hash: string) {
  if (!hash) {
    return
  }

  const target = document.getElementById(hash.replace('#', ''))

  if (!target) {
    return
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function PublicShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAppSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isLanding = location.pathname === '/'
  const primaryAction = session.isAuthenticated
    ? session.permissions.includes('workspace:read')
      ? { label: 'Abrir mi espacio', href: '/workspace' }
      : { label: 'Mi perfil', href: '/candidate/profile' }
    : { label: 'Iniciar sesion', href: '/auth/sign-in' }

  useEffect(() => {
    if (location.pathname !== '/' || !location.hash) {
      return
    }

    const timer = window.setTimeout(() => {
      scrollToHashTarget(location.hash)
    }, 40)

    return () => window.clearTimeout(timer)
  }, [location.hash, location.pathname])

  return (
    <div className="tm-shell">
      <header
        className={cn(
          'inset-x-0 top-0 z-40',
          isLanding
            ? 'absolute'
            : 'sticky border-b bg-[color:var(--app-surface-elevated)]/95 shadow-[var(--app-shadow-card)] backdrop-blur-xl'
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-3 text-left" to="/">
            <span className="flex size-11 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-sm font-semibold text-[var(--app-text)] shadow-[var(--app-shadow-card)] backdrop-blur">
              TM
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-[var(--app-text)]">Talent Marketplace</p>
              <p className="text-xs text-[var(--app-text-muted)]">Encuentra oportunidades y haz crecer tu equipo con más claridad</p>
            </div>
          </Link>

          <nav aria-label="Public" className="hidden items-center gap-2 lg:flex">
            {publicNavigation.map((item) => (
              <Link
                key={item.label}
                className="rounded-full px-4 py-2 text-sm font-medium text-[var(--app-text-muted)] transition hover:bg-white/70 hover:text-[var(--app-text)]"
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <ThemeToggle />
            <Button variant="outline" onClick={() => void navigate('/auth/sign-up')}>
              Crear cuenta
            </Button>
            <Button onClick={() => void navigate(primaryAction.href)}>{primaryAction.label}</Button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <Button
              aria-controls="public-mobile-menu"
              aria-expanded={mobileMenuOpen}
              className="h-11 w-11 rounded-2xl p-0"
              variant="outline"
              onClick={() => setMobileMenuOpen((current) => !current)}
            >
              <span className="sr-only">{mobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}</span>
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-50 bg-[color:var(--app-text)]/12 backdrop-blur-sm lg:hidden">
            <div className="absolute inset-x-4 top-4 rounded-[28px] border bg-[var(--app-surface-elevated)] p-5 shadow-[var(--app-shadow-floating)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--app-text)]">Explora el producto</p>
                  <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                    Jobs publicos, pricing visible y acceso claro para candidatos y empresas.
                  </p>
                </div>
                <Button
                  className="h-11 w-11 rounded-2xl p-0"
                  variant="outline"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="sr-only">Cerrar menu</span>
                  <X className="size-5" />
                </Button>
              </div>

              <div className="mt-6 space-y-2" id="public-mobile-menu">
                {publicNavigation.map((item) => (
                  <Link
                    key={item.label}
                    className="flex items-center justify-between rounded-[20px] border bg-[var(--app-surface)] px-4 py-3 text-sm font-semibold text-[var(--app-text)]"
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                    <span className="text-[var(--app-text-subtle)]">Abrir</span>
                  </Link>
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    void navigate('/auth/sign-up')
                  }}
                >
                  Crear cuenta
                </Button>
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    void navigate(primaryAction.href)
                  }}
                >
                  {primaryAction.label}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className={isLanding ? 'pb-0' : 'mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8'}>
        <Outlet />
      </main>
    </div>
  )
}
