import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  BriefcaseBusiness,
  Compass,
  FileQuestion,
  House,
  IdCard,
  LifeBuoy,
  Search
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { surfacePaths } from '@/app/router/surface-paths'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'

const SUPPORT_EMAIL = 'soporte@asi.org.do'

export type AppSurface = 'institutional' | 'storefront' | 'auth' | 'candidate' | 'workspace' | 'admin'
export type SurfaceStatusKind = 'not-found' | 'forbidden'

function getSurfaceStatusContent(surface: AppSurface, kind: SurfaceStatusKind) {
  if (kind === 'forbidden') {
    switch (surface) {
      case 'candidate':
        return {
          eyebrow: 'Acceso restringido',
          title: 'No puedes abrir esta vista de talento',
          description: 'Tu sesión sigue activa, pero esta sección no está disponible para tu acceso actual.',
          actionLabel: 'Ir a mi perfil',
          actionHref: surfacePaths.candidate.profile
        }
      case 'workspace':
        return {
          eyebrow: 'Acceso restringido',
          title: 'No puedes abrir esta vista del workspace',
          description: 'Tu sesión pertenece al workspace, pero este módulo requiere un permiso adicional.',
          actionLabel: 'Volver al workspace',
          actionHref: surfacePaths.workspace.root
        }
      case 'admin':
        return {
          eyebrow: 'Acceso restringido',
          title: 'No puedes abrir esta vista administrativa',
          description: 'La consola de plataforma reconoce tu sesión, pero no tienes el permiso necesario para esta sección.',
          actionLabel: 'Volver al admin',
          actionHref: surfacePaths.admin.root
        }
      case 'auth':
        return {
          eyebrow: 'Acceso restringido',
          title: 'Este flujo no está disponible ahora mismo',
          description: 'Vuelve al acceso principal para continuar desde una ruta válida.',
          actionLabel: 'Ir a sign in',
          actionHref: surfacePaths.auth.signIn
        }
      case 'institutional':
        return {
          eyebrow: 'Acceso restringido',
          title: 'No puedes abrir esta página institucional',
          description: 'Vuelve al portal principal de ASI para continuar desde una ruta válida.',
          actionLabel: 'Volver al portal',
          actionHref: surfacePaths.institutional.home
        }
      default:
        return {
          eyebrow: 'Acceso restringido',
          title: 'No puedes abrir esta sección',
          description: 'Esta vista no está disponible para tu sesión actual.',
          actionLabel: 'Volver a la plataforma',
          actionHref: surfacePaths.storefront.home
        }
    }
  }

  switch (surface) {
    case 'institutional':
      return {
        eyebrow: 'Ruta no encontrada',
        title: 'No encontramos esa página institucional',
        description: 'El portal institucional sigue disponible, pero esta ruta no forma parte de la navegación principal.',
        actionLabel: 'Ir al home institucional',
        actionHref: surfacePaths.institutional.home
      }
    case 'candidate':
      return {
        eyebrow: 'Ruta no encontrada',
        title: 'No encontramos esa pantalla de talento',
        description: 'La app de candidato sigue disponible, pero esta ruta ya no existe o no forma parte del flujo actual.',
        actionLabel: 'Ir a mi perfil',
        actionHref: surfacePaths.candidate.profile
      }
    case 'workspace':
      return {
        eyebrow: 'Ruta no encontrada',
        title: 'No encontramos esa pantalla del workspace',
        description: 'El workspace sigue activo, pero esta ruta no pertenece a la experiencia canónica de empresa.',
        actionLabel: 'Volver al workspace',
        actionHref: surfacePaths.workspace.root
      }
    case 'admin':
      return {
        eyebrow: 'Ruta no encontrada',
        title: 'No encontramos esa pantalla administrativa',
        description: 'La consola admin sigue disponible, pero esta ruta no pertenece a la navegación operativa actual.',
        actionLabel: 'Volver al admin',
        actionHref: surfacePaths.admin.root
      }
    case 'auth':
      return {
        eyebrow: 'Ruta no encontrada',
        title: 'No encontramos esa pantalla de acceso',
        description: 'Vuelve al flujo principal de autenticación para continuar desde una ruta válida.',
        actionLabel: 'Ir a sign in',
        actionHref: surfacePaths.auth.signIn
      }
    default:
      return {
        eyebrow: 'Ruta no encontrada',
        title: 'No encontramos esta página de plataforma',
        description: 'La landing comercial y las oportunidades para miembros siguen disponibles dentro de la plataforma, pero esta ruta no forma parte de esa experiencia.',
        actionLabel: 'Volver a la plataforma',
        actionHref: surfacePaths.storefront.home
      }
  }
}

interface QuickLink {
  icon: LucideIcon
  title: string
  description: string
  to: string
}

const QUICK_LINKS: QuickLink[] = [
  {
    icon: House,
    title: 'Ir al inicio',
    description: 'Regresa a la página principal y continúa explorando.',
    to: surfacePaths.institutional.home
  },
  {
    icon: BriefcaseBusiness,
    title: 'Explorar vacantes',
    description: 'Descubre oportunidades abiertas para miembros.',
    to: surfacePaths.storefront.jobs
  },
  {
    icon: IdCard,
    title: 'Ver membresía',
    description: 'Conoce los beneficios y cómo unirte a ASI.',
    to: surfacePaths.institutional.membership
  },
  {
    icon: LifeBuoy,
    title: 'Contactar soporte',
    description: 'Escríbenos y te ayudamos a resolverlo.',
    to: surfacePaths.institutional.contactUs
  }
]

export function SurfaceStatusPage({
  surface,
  kind
}: {
  surface: AppSurface
  kind: SurfaceStatusKind
}) {
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const content = getSurfaceStatusContent(surface, kind)
  const isNotFound = kind === 'not-found'
  const [searchTerm, setSearchTerm] = useState('')

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    const trimmed = searchTerm.trim()
    void navigate(trimmed ? `${surfacePaths.storefront.jobs}?q=${encodeURIComponent(trimmed)}` : surfacePaths.storefront.jobs)
  }

  return (
    <motion.div
      className="mx-auto w-full max-w-6xl space-y-8 py-2"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div variants={cardReveal} className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:border-primary-500/25 dark:bg-primary-500/12 dark:text-primary-200">
            <FileQuestion className="size-3.5" />
            {isNotFound ? 'Error 404' : content.eyebrow}
          </span>
          <div className="space-y-3">
            <h1 className="text-[2rem] font-bold leading-tight tracking-[-0.03em] text-(--app-text) sm:text-[2.6rem]">
              {isNotFound ? 'Ups, esta página no está disponible' : content.title}
            </h1>
            <p className="max-w-xl text-sm leading-6 text-(--app-text-muted) sm:text-base">
              {isNotFound
                ? 'La página que buscas puede haber sido movida, eliminada o la dirección no es la correcta. Pero no te preocupes, hay muchas formas de seguir conectado y avanzar.'
                : content.description}
            </p>
          </div>

          {isNotFound ? (
            <form onSubmit={handleSearch} className="space-y-2">
              <label className="text-[0.82rem] font-medium text-(--app-text-muted)">¿Qué estás buscando?</label>
              <div className="flex items-center gap-2.5 rounded-2xl border border-(--app-border) bg-(--app-surface) px-3.5 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-(--app-ring)">
                <Search aria-hidden="true" className="size-4 text-(--app-text-subtle)" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar personas, proyectos, vacantes..."
                  className="h-11 w-full bg-transparent text-sm text-(--app-text) outline-none placeholder:text-(--app-text-subtle)"
                />
              </div>
            </form>
          ) : null}

          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => void navigate(content.actionHref)}>
              {isNotFound ? 'Volver al inicio' : content.actionLabel}
            </Button>
            <Button variant="outline" onClick={() => void navigate(surfacePaths.storefront.jobs)}>
              Explorar oportunidades
            </Button>
          </div>
        </motion.div>

        <motion.div variants={cardReveal} className="relative">
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[30px] border border-(--app-border) bg-[linear-gradient(135deg,rgba(45,82,168,0.10),rgba(138,162,216,0.16))] dark:bg-[linear-gradient(135deg,rgba(45,82,168,0.18),rgba(20,28,52,0.4))]">
            <div className="text-center">
              <p className="text-[5rem] font-black leading-none tracking-[-0.04em] text-primary-600 sm:text-[7rem] dark:text-primary-300">404</p>
              <p className="mt-1 text-sm font-semibold text-(--app-text-muted)">Página no encontrada</p>
            </div>
            <span className="absolute left-6 top-7 flex size-11 items-center justify-center rounded-2xl border border-(--app-border) bg-(--app-surface) text-primary-600 shadow-[0_10px_26px_rgba(15,23,42,0.1)] dark:text-primary-300">
              <Compass className="size-5" />
            </span>
            <span className="absolute bottom-8 left-10 flex size-10 items-center justify-center rounded-2xl border border-(--app-border) bg-(--app-surface) text-(--app-text-subtle) shadow-[0_10px_26px_rgba(15,23,42,0.1)]">
              <Search className="size-4" />
            </span>
            <span className="absolute right-7 top-12 flex size-12 items-center justify-center rounded-2xl border border-(--app-border) bg-(--app-surface) text-(--app-text-subtle) shadow-[0_10px_26px_rgba(15,23,42,0.1)]">
              <FileQuestion className="size-5" />
            </span>
          </div>
        </motion.div>
      </section>

      <motion.div variants={gridStagger} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <motion.div key={link.title} variants={cardReveal} className="h-full">
              <Link
                to={link.to}
                className="group flex h-full flex-col gap-2 rounded-2xl border border-(--app-border) bg-(--app-surface) p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] dark:hover:border-primary-500/40"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
                  <Icon className="size-5" />
                </span>
                <p className="mt-1 text-sm font-semibold text-(--app-text)">{link.title}</p>
                <p className="flex-1 text-xs leading-5 text-(--app-text-muted)">{link.description}</p>
                <span className="inline-flex items-center gap-1 text-[0.78rem] font-semibold text-primary-600 dark:text-primary-300">
                  Continuar
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          )
        })}
      </motion.div>

      <motion.p variants={cardReveal} className="text-center text-sm text-(--app-text-muted)">
        ¿Necesitas ayuda? Escríbenos a{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-300">
          {SUPPORT_EMAIL}
        </a>{' '}
        o visita nuestra{' '}
        <Link to={surfacePaths.institutional.contactUs} className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-300">
          sección de preguntas frecuentes
        </Link>
        .
      </motion.p>
    </motion.div>
  )
}
