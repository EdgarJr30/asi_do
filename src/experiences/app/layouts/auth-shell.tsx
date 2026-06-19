import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { RouteScrollManager } from '@/app/router/route-scroll-manager'
import {
  getAuthenticatedHomePath,
  surfacePaths
} from '@/app/router/surface-paths'
import { BrandLockup } from '@/components/ui/app-brand'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { AuthHeroPanel } from '@/features/auth/components/auth-hero-panel'

export function AuthShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAppSession()

  const isSignUp = location.pathname.includes('/sign-up')

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-canvas)_88%,white)_0%,var(--app-canvas)_100%)]">
      <RouteScrollManager />
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.96fr)] xl:grid-cols-[minmax(0,1fr)_minmax(30rem,0.94fr)]">
        <main className="flex min-h-screen flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 xl:px-14">
          <div className="flex items-start justify-between gap-4">
            <button
              className="rounded-[24px] p-1 transition hover:opacity-90"
              type="button"
              onClick={() => void navigate(surfacePaths.institutional.home)}
            >
              <BrandLockup className="w-26 sm:w-30" />
            </button>

            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle compact />
              {session.isAuthenticated ? (
                <Button
                  className="px-4"
                  onClick={() =>
                    void navigate(
                      getAuthenticatedHomePath(
                        session.permissions.includes('workspace:read')
                      )
                    )
                  }
                >
                  Abrir app
                </Button>
              ) : (
                <Button
                  className="px-4"
                  variant="outline"
                  onClick={() =>
                    void navigate(isSignUp ? surfacePaths.auth.signIn : surfacePaths.auth.signUp)
                  }
                >
                  {isSignUp ? 'Iniciar sesion' : 'Crear cuenta'}
                </Button>
              )}
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 lg:py-14">
            <Outlet />
          </div>

          <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-(--app-border) pt-6 text-center text-xs text-(--app-text-subtle) sm:flex-row sm:text-left">
            <p>© 2026 ASI Rep. Dominicana</p>
            <div className="flex items-center gap-4">
              <button
                className="transition hover:text-(--app-text)"
                type="button"
                onClick={() => void navigate(surfacePaths.institutional.contactUs)}
              >
                Contacto
              </button>
              <button
                className="transition hover:text-(--app-text)"
                type="button"
                onClick={() => void navigate(surfacePaths.public.jobsRoot)}
              >
                Vacantes
              </button>
            </div>
          </footer>
        </main>

        <AuthHeroPanel />
      </div>
    </div>
  )
}
