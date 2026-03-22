import { useEffect, useState } from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Menu, MoveRight, Search, X } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { institutionalNavigation } from '@/features/institutional/content/site-content'
import { BrandLockup } from '@/components/ui/app-brand'
import { cn } from '@/lib/utils/cn'

const institutionalPrimaryNavigation = [
  { label: 'Eventos', to: surfacePaths.institutional.news },
  { label: 'Membresía', to: surfacePaths.institutional.membership },
  { label: 'Programas', to: surfacePaths.institutional.projects },
  { label: 'Quiénes somos', to: surfacePaths.institutional.whoWeAre }
] as const

function isActiveRoute(currentPathname: string, targetPath: string) {
  if (targetPath === surfacePaths.institutional.home) {
    return currentPathname === surfacePaths.institutional.home || currentPathname === surfacePaths.institutional.homeAlias
  }

  return currentPathname === targetPath || currentPathname.startsWith(`${targetPath}/`)
}

export function InstitutionalShell() {
  const location = useLocation()
  const shouldReduceMotion = useReducedMotion()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isCondensed, setIsCondensed] = useState(false)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    const handleScroll = () => {
      setIsCondensed(window.scrollY > 24)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMobileMenuOpen(false)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname])

  return (
    <div className="asi-site min-h-screen overflow-x-clip">
      <motion.header
        className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 lg:px-6"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -18 }}
        transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      >
        <div className="asi-container px-0">
          <motion.div
            className="rounded-[1.7rem] border border-white/55 bg-[rgba(248,249,250,0.92)] px-4 shadow-[var(--asi-shadow-soft)] backdrop-blur-[18px] sm:px-5"
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    paddingTop: isCondensed ? 10 : 12,
                    paddingBottom: isCondensed ? 10 : 12,
                    borderRadius: isCondensed ? 24 : 28
                  }
            }
          >
            <div className="flex items-center justify-between gap-3 lg:gap-5">
              <div className="flex min-w-0 items-center gap-3">
                <Link className="shrink-0" to={surfacePaths.institutional.home}>
                  <motion.span
                    className="flex items-center justify-center"
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    animate={
                      shouldReduceMotion
                        ? undefined
                        : {
                            width: isCondensed ? 62 : 88,
                            height: isCondensed ? 62 : 88
                          }
                    }
                  >
                    <motion.img
                      alt="ASI República Dominicana"
                      className="w-[4.85rem] sm:w-[5.2rem]"
                      loading="lazy"
                      src="/brand/asi-logo-light.png"
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      animate={shouldReduceMotion ? undefined : { scale: isCondensed ? 0.86 : 1 }}
                    />
                  </motion.span>
                </Link>
                <motion.span
                  className="min-w-0 select-text"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : {
                          opacity: 1,
                          scale: isCondensed ? 0.96 : 1
                        }
                  }
                >
                  <p className="max-w-[11rem] text-[0.6rem] font-semibold uppercase leading-[1.45] tracking-[0.18em] text-[var(--asi-primary)]/84 sm:max-w-[12.5rem] sm:text-[0.64rem]">
                    Servicios e Industrias de Laicos Adventistas
                  </p>
                </motion.span>
              </div>

              <nav aria-label="Institutional" className="hidden items-center gap-1 xl:flex">
                {institutionalPrimaryNavigation.map((item) => (
                  <Link
                    key={item.to}
                    className={cn(
                      'rounded-full px-3.5 py-2 text-[0.96rem] font-semibold transition-all duration-300',
                      isActiveRoute(location.pathname, item.to)
                        ? 'bg-white text-[var(--asi-primary)] shadow-[0_10px_24px_rgba(0,47,110,0.1)]'
                        : 'text-[var(--asi-text-muted)] hover:bg-white/75 hover:text-[var(--asi-text)]'
                    )}
                    to={item.to}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="hidden min-w-[15rem] flex-1 justify-end xl:flex">
                <label className="flex h-11 w-full max-w-[17.5rem] items-center gap-2 rounded-[1rem] bg-white/92 px-4 text-sm text-[var(--asi-text-muted)] shadow-[0_10px_24px_rgba(0,47,110,0.06)]">
                  <Search className="size-4 text-[var(--asi-secondary)]" />
                  <span>Buscar</span>
                </label>
              </div>

              <div className="hidden items-center gap-3 lg:flex">
                <Link className="asi-button asi-button-ghost" to={surfacePaths.public.home}>
                  Plataforma
                </Link>
                <Link className="asi-button asi-button-primary" to={surfacePaths.institutional.donate}>
                  Donaciones
                </Link>
              </div>

              <button
                aria-controls="institutional-mobile-nav"
                aria-expanded={mobileMenuOpen}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--asi-primary)] shadow-[0_10px_24px_rgba(0,47,110,0.08)] xl:hidden"
                type="button"
                onClick={() => setMobileMenuOpen((current) => !current)}
              >
                <span className="sr-only">{mobileMenuOpen ? 'Cerrar menú institucional' : 'Abrir menú institucional'}</span>
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </motion.div>
        </div>
      </motion.header>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div
            className="fixed inset-0 z-40 bg-[rgba(0,47,110,0.18)] backdrop-blur-sm xl:hidden"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            transition={{ duration: 0.24 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="asi-container pt-30 pb-6 sm:pt-32 sm:pb-7">
              <motion.div
                className="rounded-[1.9rem] bg-white p-6 shadow-[var(--asi-shadow-strong)] sm:p-7"
                id="institutional-mobile-nav"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -14 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--asi-secondary)]">Navegación</p>
                <div className="mt-6 space-y-3">
                  {institutionalNavigation.map((item) => (
                    <Link
                      key={item.to}
                      className="flex items-center justify-between rounded-[1.15rem] bg-[var(--asi-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--asi-text)]"
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                      <MoveRight className="size-4 text-[var(--asi-secondary)]" />
                    </Link>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link className="asi-button asi-button-secondary" to={surfacePaths.public.home} onClick={() => setMobileMenuOpen(false)}>
                    Plataforma
                  </Link>
                  <Link className="asi-button asi-button-primary" to={surfacePaths.institutional.donate} onClick={() => setMobileMenuOpen(false)}>
                    Donaciones
                  </Link>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="min-w-0 pt-[8.3rem] sm:pt-[8rem] lg:pt-[8.6rem]">
        <Outlet />
      </main>

      <footer className="bg-[var(--asi-primary)] text-white">
        <div className="asi-container py-10 sm:py-12">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-8">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-6">
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-[1rem] bg-white/10 px-3 backdrop-blur-sm sm:w-28">
                  <BrandLockup className="w-full" surface="dark" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/60">Portal institucional</p>
                  <p className="mt-1 text-lg font-semibold leading-tight sm:text-[1.35rem]">ASI República Dominicana</p>
                </div>
              </div>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/74 sm:mt-6">
                Un espacio institucional separado de la plataforma SaaS, diseñado para comunicar misión, membresía,
                proyectos, noticias y formas de participar con un lenguaje más elegante y editorial.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link className="asi-button asi-button-secondary w-full justify-center" to={surfacePaths.public.home}>
                  Plataforma ASI
                </Link>
                <Link className="asi-button asi-button-primary w-full justify-center" to={surfacePaths.institutional.donate}>
                  Donaciones
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/64">Explora</p>
                <div className="mt-4 space-y-2.5">
                  {institutionalNavigation.map((item) => (
                    <Link
                      key={item.to}
                      className="flex items-center justify-between rounded-[1rem] bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                      to={item.to}
                    >
                      {item.label}
                      <MoveRight className="size-4 text-white/44" />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/64">Puente</p>
                <div className="mt-4 space-y-2.5">
                  <Link
                    className="flex items-center justify-between rounded-[1rem] bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                    to={surfacePaths.public.home}
                  >
                    Plataforma ASI
                    <MoveRight className="size-4 text-white/44" />
                  </Link>
                  <Link
                    className="flex items-center justify-between rounded-[1rem] bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                    to={surfacePaths.auth.signIn}
                  >
                    Iniciar sesión
                    <MoveRight className="size-4 text-white/44" />
                  </Link>
                  <Link
                    className="flex items-center justify-between rounded-[1rem] bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                    to={surfacePaths.institutional.contactUs}
                  >
                    Contáctanos
                    <MoveRight className="size-4 text-white/44" />
                  </Link>
                  <Link
                    className="flex items-center justify-between rounded-[1rem] bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                    to={surfacePaths.institutional.donate}
                  >
                    Donaciones
                    <MoveRight className="size-4 text-white/44" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-white/12 pt-5 text-center text-sm leading-6 text-white/68 sm:text-left">
            Copyright © {currentYear} ASI República Dominicana. Compartiendo el mensaje de esperanza a través de la fe y el servicio.
          </div>
        </div>
      </footer>
    </div>
  )
}
