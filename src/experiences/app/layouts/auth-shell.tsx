import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAppSession } from '@/app/providers/app-session-provider';
import { RouteScrollManager } from '@/app/router/route-scroll-manager';
import {
  getAuthenticatedHomePath,
  surfacePaths,
} from '@/app/router/surface-paths';
import { BrandLockup } from '@/components/ui/app-brand';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function AuthShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAppSession();

  const isSignUp = location.pathname.includes('/sign-up');

  return (
    <div className="tm-shell">
      <RouteScrollManager />

      <header className="border-b bg-(--app-surface-elevated) backdrop-blur-xl">
        <div className="mx-auto flex max-w-300 items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            className="rounded-[22px] border bg-(--app-surface) px-3 py-2 shadow-sm transition hover:border-primary-200"
            type="button"
            onClick={() => void navigate(surfacePaths.public.home)}
          >
            <BrandLockup className="w-27.5 sm:w-31.5" />
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Button
              variant="ghost"
              onClick={() => void navigate(surfacePaths.public.jobsRoot)}
            >
              Jobs
            </Button>
            {session.isAuthenticated ? (
              <Button
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
                variant="outline"
                onClick={() =>
                  void navigate(isSignUp ? '/auth/sign-in' : '/auth/sign-up')
                }
              >
                {isSignUp ? 'Iniciar sesion' : 'Crear cuenta'}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-300 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
