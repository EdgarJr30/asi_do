import { useEffect, useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, MoveRight, X } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAppSession } from '@/app/providers/app-session-provider';
import { RouteScrollManager } from '@/app/router/route-scroll-manager';
import {
  getAuthenticatedHomePath,
  surfacePaths,
} from '@/app/router/surface-paths';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils/cn';
import { PLATFORM_REGISTRATION_LOCKED } from '@/shared/config/launch-access';

const SHOW_PRICING_SECTION = false;

const storefrontNavigation = [
  { label: '¿Cómo funciona?', to: `${surfacePaths.storefront.home}#features` },
  ...(SHOW_PRICING_SECTION
    ? [{ label: 'Pricing', to: `${surfacePaths.storefront.home}#pricing` }]
    : []),
  { label: 'FAQ', to: `${surfacePaths.storefront.home}#faq` },
] as const;

const HEADER_BACKGROUND_SCROLL_DISTANCE = 72;
const HEADER_BACKGROUND_ALPHA = 0.92;
const HEADER_BORDER_ALPHA = 0.55;
const HEADER_SHADOW_ALPHA = 0.08;

function getHeaderScrollProgress(scrollY: number) {
  return Math.min(
    1,
    Math.max(0, scrollY / HEADER_BACKGROUND_SCROLL_DISTANCE)
  );
}

function isActiveNav(currentPathname: string, to: string) {
  const [path] = to.split('#');

  if (to.includes('#')) {
    return false;
  }

  return currentPathname === path || currentPathname.startsWith(`${path}/`);
}

export function StorefrontShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAppSession();
  const shouldReduceMotion = useReducedMotion();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCondensed, setIsCondensed] = useState(false);
  const [headerScrollProgress, setHeaderScrollProgress] = useState(0);

  const showGuestAction = !session.isAuthenticated;
  const primaryAction = session.isAuthenticated
    ? {
        label: session.permissions.includes('workspace:read')
          ? 'Abrir mi workspace'
          : 'Mi perfil',
        href: getAuthenticatedHomePath(
          session.permissions.includes('workspace:read')
        ),
      }
    : { label: 'Iniciar sesión', href: surfacePaths.auth.signIn };

  useEffect(() => {
    let animationFrame: number | null = null;

    const updateHeaderState = () => {
      const scrollY = window.scrollY;

      setHeaderScrollProgress(getHeaderScrollProgress(scrollY));
      setIsCondensed(scrollY > 24);
      animationFrame = null;
    };

    const handleScroll = () => {
      if (animationFrame !== null) {
        return;
      }

      animationFrame = window.requestAnimationFrame(updateHeaderState);
    };

    updateHeaderState();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);

      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMobileMenuOpen(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  // A diferencia de la web institucional (siempre clara), la plataforma tiene
  // modo oscuro: mantenemos un panel claro base para que el header sea legible
  // sobre el hero en ambos temas, e intensificamos al hacer scroll.
  const headerBackdropBlur = 12 + 6 * headerScrollProgress;
  const headerPanelAlpha = 0.8 + (HEADER_BACKGROUND_ALPHA - 0.8) * headerScrollProgress;
  const headerBorderAlpha = 0.35 + (HEADER_BORDER_ALPHA - 0.35) * headerScrollProgress;
  const headerShadowAlpha = 0.06 + (HEADER_SHADOW_ALPHA - 0.06) * headerScrollProgress;

  const isLanding = location.pathname === surfacePaths.storefront.home;

  return (
    <div className="tm-shell overflow-x-clip">
      <RouteScrollManager />

      {/* Cabecera reutiliza el diseño institucional; el token-provider
          `asi-site-platform` se limita al header/menú y trae su propia variante
          oscura (ver index.css) para poder ir a dark solo en la plataforma. */}
      <div className="asi-site asi-site-platform" style={{ background: 'transparent' }}>
      <motion.header
        className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 lg:px-6"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -18 }}
        transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      >
        <div className="asi-container px-0">
          <motion.div
            className="rounded-card-lg border px-4 py-3 transition-all duration-300 ease-out sm:px-5"
            style={{
              WebkitBackdropFilter: `blur(${headerBackdropBlur}px)`,
              backdropFilter: `blur(${headerBackdropBlur}px)`,
              backgroundColor: `rgb(var(--asi-header-rgb) / ${headerPanelAlpha})`,
              borderColor: `rgba(255, 255, 255, ${headerBorderAlpha})`,
              boxShadow: `0 12px 40px rgba(0, 47, 110, ${headerShadowAlpha})`,
            }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    paddingTop: isCondensed ? 10 : 12,
                    paddingBottom: isCondensed ? 10 : 12,
                    borderRadius: 'var(--radius-card-lg)',
                  }
            }
          >
            <div className="flex items-center justify-between gap-3 lg:gap-5">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  className="relative h-12 w-38 shrink-0 overflow-visible sm:h-14 sm:w-42"
                  to={surfacePaths.storefront.home}
                >
                  <motion.span
                    className="absolute inset-0 flex items-center justify-start overflow-visible"
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    animate={
                      shouldReduceMotion
                        ? undefined
                        : { scale: isCondensed ? 0.94 : 1 }
                    }
                  >
                    <motion.img
                      alt="ASI República Dominicana"
                      className="pointer-events-none absolute left-0 top-1/2 w-[10.8rem] -translate-y-1/2 sm:w-[10.8rem]"
                      loading="lazy"
                      width={512}
                      height={512}
                      sizes="173px"
                      srcSet="/brand/asi-logo-light.no-bg-192.webp 192w, /brand/asi-logo-light.no-bg-384.webp 384w, /brand/asi-logo-light.no-bg.webp 512w"
                      src="/brand/asi-logo-light.no-bg.webp"
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      animate={
                        shouldReduceMotion
                          ? undefined
                          : { scale: isCondensed ? 0.86 : 1 }
                      }
                    />
                  </motion.span>
                </Link>
                <motion.span
                  className="hidden min-w-0 select-text sm:block"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : {
                          opacity: 1,
                          scale: isCondensed ? 0.96 : 1,
                        }
                  }
                >
                  <p className="max-w-44 text-[0.6rem] font-semibold uppercase leading-[1.45] tracking-[0.18em] text-(--asi-primary)/84 sm:max-w-50 sm:text-[0.64rem]">
                    Servicios e Industrias de Laicos Adventistas
                  </p>
                </motion.span>
              </div>

              <nav
                aria-label="Plataforma"
                className="hidden items-center gap-1 xl:flex"
              >
                {storefrontNavigation.map((item) => (
                  <Link
                    key={item.label}
                    className={cn(
                      'rounded-full px-3.5 py-2 text-[0.96rem] font-semibold transition-all duration-300',
                      isActiveNav(location.pathname, item.to)
                        ? 'bg-white text-(--asi-primary) shadow-[0_10px_24px_rgba(0,47,110,0.1)] dark:bg-white/12'
                        : 'text-(--asi-text-muted) hover:bg-white/75 hover:text-(--asi-text) dark:hover:bg-white/8'
                    )}
                    to={item.to}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="hidden flex-1 items-center justify-end gap-3 lg:flex">
                <ThemeToggle compact className="shadow-none" />
                <Link
                  className="asi-button asi-button-ghost"
                  to={surfacePaths.institutional.home}
                >
                  ASI institucional
                </Link>
                {showGuestAction ? (
                  <button
                    className="asi-button asi-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={PLATFORM_REGISTRATION_LOCKED}
                    type="button"
                    onClick={() => void navigate(surfacePaths.auth.signUp)}
                  >
                    {PLATFORM_REGISTRATION_LOCKED ? 'Registro cerrado' : 'Crear cuenta'}
                  </button>
                ) : null}
                <Link
                  className="asi-button asi-button-primary"
                  to={primaryAction.href}
                >
                  {primaryAction.label}
                </Link>
              </div>

              <div className="flex items-center gap-2 xl:hidden">
                <ThemeToggle compact className="shadow-none" />
                <button
                  aria-controls="storefront-mobile-nav"
                  aria-expanded={mobileMenuOpen}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-(--asi-primary) shadow-[0_10px_24px_rgba(0,47,110,0.08)] dark:bg-white/10"
                  type="button"
                  onClick={() => setMobileMenuOpen((current) => !current)}
                >
                  <span className="sr-only">
                    {mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
                  </span>
                  {mobileMenuOpen ? (
                    <X className="size-5" />
                  ) : (
                    <Menu className="size-5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.header>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div
            className="fixed inset-0 z-40 bg-[#002f6e]/18 backdrop-blur-sm xl:hidden"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            transition={{ duration: 0.24 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="asi-container pt-30 pb-6 sm:pt-32 sm:pb-7">
              <motion.div
                className="rounded-card-lg bg-white p-6 shadow-(--asi-shadow-strong) sm:p-7 dark:bg-(--asi-surface-raised)"
                id="storefront-mobile-nav"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -14 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--asi-secondary)">
                  Navegación
                </p>
                <div className="mt-6 space-y-3">
                  {storefrontNavigation.map((item) => (
                    <Link
                      key={item.label}
                      className="flex items-center justify-between rounded-card bg-(--asi-surface-muted) px-4 py-3 text-sm font-semibold text-(--asi-text)"
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                      <MoveRight className="size-4 text-(--asi-secondary)" />
                    </Link>
                  ))}
                </div>
                <div
                  className={cn(
                    'mt-6 grid gap-3',
                    showGuestAction ? 'sm:grid-cols-2' : undefined
                  )}
                >
                  <Link
                    className="asi-button asi-button-ghost"
                    to={surfacePaths.institutional.home}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ASI institucional
                  </Link>
                  {showGuestAction ? (
                    <button
                      className="asi-button asi-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={PLATFORM_REGISTRATION_LOCKED}
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        void navigate(surfacePaths.auth.signUp);
                      }}
                    >
                      {PLATFORM_REGISTRATION_LOCKED ? 'Registro cerrado' : 'Crear cuenta'}
                    </button>
                  ) : null}
                  <Link
                    className="asi-button asi-button-primary"
                    to={primaryAction.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {primaryAction.label}
                  </Link>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      </div>

      <main
        className={
          isLanding
            ? 'min-w-0 pb-0'
            : 'mx-auto min-w-0 max-w-7xl px-4 pb-16 pt-[8.3rem] sm:px-6 sm:pt-32 lg:px-8 lg:pt-[8.6rem]'
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
