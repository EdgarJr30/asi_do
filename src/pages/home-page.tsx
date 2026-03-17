import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronDown,
  Building2,
  Check,
  CircleHelp,
  FileText,
  HandHeart,
  HeartHandshake,
  Layers3,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WalletCards,
  Workflow,
  X
} from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type BillingFrequency = 'monthly' | 'annually'

const PRICING_COMPARISON_ANIMATION_MS = 640

const heroSignals = [
  {
    title: 'Vacantes que se entienden rápido',
    description: 'Presenta cada oportunidad con más claridad y mejor contexto.',
    icon: BriefcaseBusiness
  },
  {
    title: 'Pipeline compartido',
    description: 'Recruiting y líderes avanzan sobre la misma información.',
    icon: Workflow
  },
  {
    title: 'Marca empleadora más cuidada',
    description: 'Tu proceso transmite más orden, confianza y profesionalismo.',
    icon: Sparkles
  }
] as const

const heroProofs = [
  {
    title: 'Un solo espacio',
    description: 'vacantes, talento y feedback sin perseguir contexto'
  },
  {
    title: 'Más claridad',
    description: 'para evaluar mejor y mover cada proceso con orden'
  },
  {
    title: 'Mejor presencia',
    description: 'para atraer talento con una experiencia más cuidada'
  }
] as const

const heroGalleryColumns = [
  {
    offsetClassName: 'pt-14 sm:pt-24 lg:pt-20',
    widthClassName: 'w-[4.25rem] sm:w-32 lg:w-36',
    items: [
      {
        src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=700&q=80',
        alt: 'Equipo revisando ideas frente a una pizarra',
        className: 'aspect-[4/5]'
      }
    ]
  },
  {
    offsetClassName: 'pt-4 sm:pt-10 lg:pt-8',
    widthClassName: 'w-[4.75rem] sm:w-36 lg:w-40',
    items: [
      {
        src: 'https://images.unsplash.com/photo-1485217988980-11786ced9454?auto=format&fit=crop&w=700&q=80',
        alt: 'Profesional trabajando desde una laptop',
        className: 'aspect-[4/5]'
      },
      {
        src: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=700&q=80',
        alt: 'Equipo colaborando en una oficina abierta',
        className: 'aspect-[4/5]'
      }
    ]
  },
  {
    offsetClassName: 'pt-0 sm:pt-4 lg:pt-0',
    widthClassName: 'w-[4.25rem] sm:w-32 lg:w-36',
    items: [
      {
        src: 'https://images.unsplash.com/photo-1670272504528-790c24957dda?auto=format&fit=crop&w=700&q=80',
        alt: 'Personas conversando en un espacio colaborativo',
        className: 'aspect-[4/5]'
      }
    ]
  }
] as const

const featureCards = [
  {
    name: 'Perfil que ahorra tiempo',
    description:
      'Cada persona guarda su información una sola vez y la usa para aplicar con más confianza y menos fricción.',
    icon: FileText
  },
  {
    name: 'Vacantes que invitan a aplicar',
    description:
      'Publica roles con una presentación más clara para que el talento entienda rápido la oportunidad y quiera seguir.',
    icon: Building2
  },
  {
    name: 'Trabajo en equipo sin caos',
    description:
      'El equipo comparte comentarios, contexto y próximos pasos sin depender de mensajes sueltos o hojas paralelas.',
    icon: Workflow
  },
  {
    name: 'Una experiencia lista para crecer',
    description:
      'La plataforma está pensada para crecer con candidatos, empresas y equipos sin perder claridad en el camino.',
    icon: ShieldCheck
  }
] as const

const mobileWorkspaceSteps = ['Descubrir', 'Revisar', 'Comentar', 'Avanzar'] as const

const mobileWorkspaceItems = [
  {
    title: 'Product Designer Senior',
    meta: 'Remoto · Entrevista hoy',
    state: 'En revisión'
  },
  {
    title: 'Frontend Engineer',
    meta: 'Santo Domingo · Feedback listo',
    state: 'Siguiente paso'
  }
] as const

const valueBentoCards = [
  {
    title: 'Atracción que convierte',
    body: 'Muestra tus vacantes de forma clara y dale al talento un camino rápido para aplicar.',
    icon: BriefcaseBusiness,
    image:
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'Equipo revisando una estrategia de trabajo en una oficina'
  },
  {
    title: 'Equipo alineado',
    body: 'Recruiters y líderes encuentran la misma información sin perseguir contexto por varios canales.',
    icon: Layers3,
    image:
      'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'Equipo colaborando en una oficina abierta'
  },
  {
    title: 'Seguimiento con ritmo',
    body: 'Cada oportunidad avanza con claridad para que nadie se quede preguntando qué sigue.',
    icon: HeartHandshake,
    image:
      'https://images.unsplash.com/photo-1485217988980-11786ced9454?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'Profesional trabajando desde una laptop con contexto claro'
  }
] as const

const billingFrequencies = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'annually', label: 'Anual' }
] as const

const pricingPlans = [
  {
    name: 'Starter',
    featured: false,
    description: 'Para empezar a publicar vacantes y ordenar tus primeros procesos.',
    price: {
      monthly: '$0',
      annually: '$0'
    },
    cadence: {
      monthly: 'por mes',
      annually: 'por ano'
    },
    cta: 'Crear cuenta',
    highlights: ['1 espacio de empresa', 'Hasta 2 vacantes activas', 'Perfil listo para aplicar', 'Seguimiento esencial']
  },
  {
    name: 'Growth',
    featured: true,
    description: 'Ideal para equipos que contratan con frecuencia y quieren una experiencia más colaborativa.',
    price: {
      monthly: '$49',
      annually: '$490'
    },
    cadence: {
      monthly: 'por mes',
      annually: 'por ano'
    },
    cta: 'Solicitar demo',
    highlights: ['Hasta 10 vacantes activas', 'Talento visible por preferencia', 'Accesos para el equipo', 'Alertas y exportes']
  },
  {
    name: 'Scale',
    featured: false,
    description: 'Pensado para empresas que quieren acompañamiento, visibilidad y más control del crecimiento.',
    price: {
      monthly: 'A medida',
      annually: 'A medida'
    },
    cadence: {
      monthly: 'plan a medida',
      annually: 'plan a medida'
    },
    cta: 'Hablar con ventas',
    highlights: ['Vacantes y equipo a medida', 'Soporte prioritario', 'Acompañamiento de lanzamiento', 'Operación ampliada']
  }
] as const

type PricingPlanName = (typeof pricingPlans)[number]['name']

const pricingSections = [
  {
    name: 'Publicación',
    features: [
      { name: 'Vacantes públicas', tiers: { Starter: true, Growth: true, Scale: true } },
      { name: 'Vacantes activas incluidas', tiers: { Starter: '2', Growth: '10', Scale: 'Ilimitadas' } },
      { name: 'Perfiles listos para aplicar', tiers: { Starter: true, Growth: true, Scale: true } },
      { name: 'Página de empresa', tiers: { Starter: true, Growth: true, Scale: true } }
    ]
  },
  {
    name: 'Colaboración',
    features: [
      { name: 'Miembros del equipo', tiers: { Starter: '2', Growth: '10', Scale: 'Ilimitados' } },
      { name: 'Talento visible por preferencia', tiers: { Starter: false, Growth: true, Scale: true } },
      { name: 'Comentarios y seguimiento', tiers: { Starter: false, Growth: true, Scale: true } },
      { name: 'Alertas y exportes', tiers: { Starter: false, Growth: true, Scale: true } }
    ]
  },
  {
    name: 'Acompañamiento',
    features: [
      { name: 'Configuración del equipo', tiers: { Starter: true, Growth: true, Scale: true } },
      { name: 'Ayuda para lanzar la operación', tiers: { Starter: false, Growth: true, Scale: true } },
      { name: 'Implementación guiada', tiers: { Starter: false, Growth: false, Scale: true } },
      { name: 'Soporte prioritario', tiers: { Starter: false, Growth: false, Scale: true } }
    ]
  }
] as const

const faqs = [
  {
    question: 'Qué hace diferente a ASI?',
    answer:
      'Reúne candidatos, vacantes y trabajo en equipo en una experiencia más clara para aplicar, contratar y dar seguimiento sin tantas vueltas.'
  },
  {
    question: 'Pueden participar candidatos y empresas en la misma plataforma?',
    answer:
      'Sí. El producto está pensado para que el talento y los equipos trabajen en el mismo ecosistema con recorridos claros para cada tipo de usuario.'
  },
  {
    question: 'Qué pasa si más adelante quiero sumar a mi empresa?',
    answer:
      'Puedes empezar con tu cuenta personal y después pedir acceso para tu empresa cuando quieras abrir vacantes y trabajar con tu equipo.'
  },
  {
    question: 'Puedo usarla cómodamente desde el teléfono?',
    answer:
      'Sí. La experiencia está pensada para que descubrir vacantes, revisar perfiles y mover procesos se sienta natural también en móvil.'
  },
  {
    question: 'La sección de donación o sponsorship ya procesa pagos?',
    answer:
      'Todavía no. Esa superficie ya está visible para validar la experiencia comercial, pero el procesamiento de pagos sigue desactivado por ahora.'
  }
] as const

const footerNavigation = [
  { label: 'Como funciona', section: 'features' },
  { label: 'Pricing', section: 'pricing' },
  { label: 'FAQ', section: 'faq' },
  { label: 'Jobs', route: '/jobs' },
  { label: 'Crear cuenta', route: '/auth/sign-up' }
] as const

const footerSignals = [
  { label: 'Lista para móvil', icon: Smartphone },
  { label: 'Vacantes públicas', icon: BriefcaseBusiness },
  { label: 'Perfiles reutilizables', icon: Layers3 },
  { label: 'Equipos coordinados', icon: ShieldCheck }
] as const

function renderTierValue(value: boolean | string, highlighted: boolean) {
  if (typeof value === 'string') {
    return (
      <span className={cn('text-sm font-semibold', highlighted ? 'text-primary-700 dark:text-primary-200' : 'text-[var(--app-text)]')}>
        {value}
      </span>
    )
  }

  return value ? (
    <>
      <Check className="mx-auto size-5 text-primary-600 dark:text-primary-300" />
      <span className="sr-only">Incluido</span>
    </>
  ) : (
    <>
      <X className="mx-auto size-5 text-[var(--app-text-subtle)]" />
      <span className="sr-only">No incluido</span>
    </>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('monthly')
  const [selectedPlanName, setSelectedPlanName] = useState<PricingPlanName>('Growth')
  const [isPricingComparisonOpen, setPricingComparisonOpen] = useState(false)
  const [isPricingComparisonMounted, setPricingComparisonMounted] = useState(false)
  const pricingComparisonHideTimeoutRef = useRef<number | null>(null)
  const pricingComparisonOpenFrameRef = useRef<number | null>(null)
  const [profileFeature, jobsFeature, collaborationFeature, growthFeature] = featureCards

  useEffect(() => {
    return () => {
      if (pricingComparisonHideTimeoutRef.current !== null) {
        window.clearTimeout(pricingComparisonHideTimeoutRef.current)
      }

      if (pricingComparisonOpenFrameRef.current !== null) {
        window.cancelAnimationFrame(pricingComparisonOpenFrameRef.current)
      }
    }
  }, [])

  const primaryAction = session.isAuthenticated
    ? session.permissions.includes('workspace:read')
      ? { label: 'Abrir mi espacio', href: '/workspace' }
      : { label: 'Completar mi perfil', href: '/candidate/profile' }
    : { label: 'Crear cuenta', href: '/auth/sign-up' }

  const footerYear = new Date().getFullYear()

  function scrollToSection(sectionId: string) {
    const section = document.getElementById(sectionId)
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function togglePricingComparison() {
    if (pricingComparisonHideTimeoutRef.current !== null) {
      window.clearTimeout(pricingComparisonHideTimeoutRef.current)
      pricingComparisonHideTimeoutRef.current = null
    }

    if (pricingComparisonOpenFrameRef.current !== null) {
      window.cancelAnimationFrame(pricingComparisonOpenFrameRef.current)
      pricingComparisonOpenFrameRef.current = null
    }

    if (isPricingComparisonOpen) {
      setPricingComparisonOpen(false)
      pricingComparisonHideTimeoutRef.current = window.setTimeout(() => {
        setPricingComparisonMounted(false)
        pricingComparisonHideTimeoutRef.current = null
      }, PRICING_COMPARISON_ANIMATION_MS)
      return
    }

    setPricingComparisonMounted(true)
    pricingComparisonOpenFrameRef.current = window.requestAnimationFrame(() => {
      setPricingComparisonOpen(true)
      pricingComparisonOpenFrameRef.current = null
    })
  }

  return (
    <div className="overflow-hidden bg-[var(--app-canvas)]">
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-[60rem] opacity-90 bg-[radial-gradient(circle_at_10%_12%,rgba(57,85,184,0.18),transparent_22%),radial-gradient(circle_at_88%_8%,rgba(111,142,244,0.14),transparent_20%),radial-gradient(circle_at_78%_30%,rgba(143,160,185,0.12),transparent_18%)] dark:bg-[radial-gradient(circle_at_14%_10%,rgba(88,116,214,0.14),transparent_26%),radial-gradient(circle_at_84%_10%,rgba(68,97,194,0.12),transparent_24%),radial-gradient(circle_at_50%_32%,rgba(27,45,92,0.18),transparent_34%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-20 h-[34rem] bg-[linear-gradient(180deg,rgba(244,247,255,0.94)_0%,rgba(255,255,255,0.72)_60%,rgba(255,255,255,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(11,18,40,0.96)_0%,rgba(10,17,38,0.76)_42%,rgba(9,17,39,0.18)_74%,rgba(9,17,39,0)_100%)]"
        />

        <div className="mx-auto max-w-[98rem] px-4 pb-14 pt-36 sm:px-6 sm:pb-18 sm:pt-40 lg:px-8 lg:pb-18 lg:pt-40">
          <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(248,250,255,0.82)_100%)] p-5 shadow-[var(--app-shadow-floating)] backdrop-blur-xl dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(16,29,63,0.9)_0%,rgba(9,17,39,0.88)_100%)] sm:rounded-[40px] sm:p-8 xl:p-9">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-36 opacity-80"
              style={{
                background:
                  'radial-gradient(circle at 0% 0%, rgba(57, 85, 184, 0.16), transparent 28%), radial-gradient(circle at 100% 0%, rgba(111, 142, 244, 0.12), transparent 24%)'
              }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-y-0 right-0 hidden w-[46%] opacity-45 sm:block"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(138,156,205,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(138,156,205,0.12) 1px, transparent 1px)',
                backgroundSize: '128px 128px'
              }}
            />

            <div className="relative grid gap-9 sm:gap-10 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-center xl:gap-14">
              <div className="min-w-0 w-full lg:max-w-xl xl:max-w-2xl">
                <Badge
                  className="max-w-full whitespace-nowrap text-left bg-white/82 text-[var(--app-text)] shadow-[var(--app-shadow-card)] backdrop-blur-sm dark:border-white/12 dark:bg-white/10 dark:text-white"
                  variant="outline"
                >
                  Hiring workspace para equipos de selección
                </Badge>
                <h1 className="mt-5 max-w-[11ch] text-[2.9rem] font-semibold tracking-tight text-[var(--app-text)] sm:text-[3.4rem] lg:text-[3.9rem] lg:leading-[1.02]">
                  Vacantes, talento y hiring en un solo lugar.
                </h1>
                <p className="mt-5 max-w-[37rem] text-base leading-7 text-[var(--app-text-muted)] sm:text-lg">
                  Convierte vacantes, feedback y seguimiento dispersos en una experiencia que proyecta más orden, más
                  confianza y mejor colaboración al contratar.
                </p>

                <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button className="w-full sm:min-w-44 sm:w-auto hover:shadow-[0_24px_44px_rgba(43,69,143,0.34)]" onClick={() => void navigate(primaryAction.href)}>
                    {primaryAction.label}
                  </Button>
                  <Button
                    className="w-full sm:min-w-44 sm:w-auto hover:border-primary-400 hover:bg-white hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]"
                    variant="outline"
                    onClick={() => void navigate('/jobs')}
                  >
                    Explorar jobs
                  </Button>
                  <Button
                    className="group w-fit justify-start self-start rounded-full px-3 text-[var(--app-text)] hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]"
                    variant="ghost"
                    onClick={() => scrollToSection('pricing')}
                  >
                    Ver pricing
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                  {heroSignals.map((signal) => {
                    const Icon = signal.icon

                    return (
                      <div
                        key={signal.title}
                        className="rounded-[24px] border bg-white/78 p-4 shadow-[var(--app-shadow-card)] backdrop-blur-sm dark:bg-white/6"
                      >
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--app-info-surface)]">
                          <Icon className="size-4 text-primary-700 dark:text-primary-200" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-[var(--app-text)]">{signal.title}</p>
                        <p className="mt-1 max-w-[24ch] text-sm leading-6 text-[var(--app-text-muted)]">{signal.description}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="relative min-w-0">
                <div className="absolute -left-6 top-14 hidden h-28 w-28 rounded-full bg-primary-300/18 blur-3xl xl:block" />
                <div className="absolute -right-8 bottom-12 hidden h-36 w-36 rounded-full bg-peach-300/28 blur-3xl xl:block" />

                <div className="min-w-0 rounded-[30px] border bg-[color:var(--app-surface-elevated)]/88 p-4 shadow-[var(--app-shadow-floating)] backdrop-blur-sm sm:p-5">
                  <div className="flex items-center justify-between gap-4 rounded-[22px] border bg-[var(--app-surface)]/84 px-4 py-3 shadow-[var(--app-shadow-card)]">
                    <div>
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]">
                        Vista del producto
                      </p>
                      <p className="mt-1 text-base font-semibold text-[var(--app-text)]">Más visual, más clara, más fácil de seguir</p>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <span className="size-2 rounded-full bg-primary-300" />
                      <span className="size-2 rounded-full bg-secondary-300" />
                      <span className="size-2 rounded-full bg-peach-300" />
                    </div>
                  </div>

                  <div className="relative mt-5">
                    <div className="absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 rounded-full border bg-white/92 px-4 py-2 text-xs font-semibold text-[var(--app-text)] shadow-[var(--app-shadow-card)] backdrop-blur sm:block dark:bg-[var(--app-surface)]/92">
                      Publica, evalúa y decide sin perder contexto
                    </div>

                    <div className="flex justify-center gap-2 sm:gap-4 lg:gap-5">
                      {heroGalleryColumns.map((column, columnIndex) => (
                        <div
                          key={`hero-gallery-column-${columnIndex + 1}`}
                          className={cn('flex-none space-y-3 sm:space-y-4', column.widthClassName, column.offsetClassName)}
                        >
                          {column.items.map((item) => (
                            <div key={item.src} className={cn('relative overflow-hidden rounded-[24px] shadow-[var(--app-shadow-floating)]', item.className)}>
                              <img
                                alt={item.alt}
                                className="h-full w-full object-cover"
                                src={item.src}
                              />
                              <div className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-black/6 ring-inset dark:ring-white/10" />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div className="absolute left-0 top-24 hidden rounded-[20px] border bg-white/90 px-4 py-3 shadow-[var(--app-shadow-card)] backdrop-blur md:block dark:bg-[var(--app-surface)]/90">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">Pipeline claro</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">Feedback y etapas visibles</p>
                    </div>

                    <div className="absolute right-0 top-44 hidden rounded-[20px] border bg-white/90 px-4 py-3 shadow-[var(--app-shadow-card)] backdrop-blur md:block dark:bg-[var(--app-surface)]/90">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">Marca cuidada</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">Tus vacantes se presentan mejor</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 rounded-[26px] border bg-[var(--app-surface)]/88 p-3 shadow-[var(--app-shadow-card)] sm:grid-cols-3 sm:gap-4 sm:p-4">
                    {heroProofs.map((proof) => (
                      <div
                        key={proof.title}
                        className="rounded-[20px] bg-[var(--app-surface-muted)]/86 px-4 py-4 text-center sm:min-h-[8.5rem] sm:px-5 sm:py-5 sm:text-left"
                      >
                        <p className="text-base font-semibold text-[var(--app-text)]">{proof.title}</p>
                        <p className="mt-2 max-w-[26ch] text-sm leading-6 text-[var(--app-text-muted)] sm:max-w-none">
                          {proof.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tm-landing-section bg-[var(--app-canvas)]" id="features">
        <div className="mx-auto max-w-[98rem] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-stretch">
            <div className="relative">
              <div className="absolute inset-0 rounded-[32px] bg-white/72 dark:bg-white/6" />
              <div className="relative flex h-full flex-col overflow-hidden rounded-[31px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,249,255,0.92)_100%)] shadow-[var(--app-shadow-floating)] backdrop-blur-sm dark:bg-[linear-gradient(180deg,rgba(18,29,58,0.92)_0%,rgba(12,21,42,0.88)_100%)]">
                <div className="px-6 pt-6 pb-2 sm:px-8 sm:pt-8">
                  <Badge variant="soft">Plataforma</Badge>
                  <h2 className="mt-5 max-w-[12ch] text-3xl font-semibold tracking-tight text-balance text-[var(--app-text)] sm:text-4xl">
                    La plataforma también se siente bien en móvil
                  </h2>
                  <p className="mt-4 max-w-[30rem] text-base leading-8 text-[var(--app-text-muted)] sm:text-lg">
                    Revisa perfiles, comparte feedback y mueve decisiones desde el teléfono con una vista clara y accionable.
                  </p>
                </div>

                <div className="relative mx-auto mt-4 w-full max-w-sm grow px-4 pb-0 sm:px-6">
                  <div className="absolute left-1/2 top-8 h-24 w-24 -translate-x-1/2 rounded-full bg-primary-300/18 blur-3xl" />
                  <div className="relative mx-auto max-w-[18.25rem] rounded-[2.9rem] bg-[linear-gradient(180deg,#eef3ff_0%,#d9e1f1_38%,#c6cfdf_100%)] p-[0.72rem] shadow-[0_32px_72px_rgba(20,35,72,0.18)] ring-1 ring-white/82 dark:bg-[linear-gradient(180deg,#858fa1_0%,#596376_20%,#222b38_58%,#111827_100%)] dark:ring-white/18">
                    <div className="rounded-[2.35rem] bg-[linear-gradient(180deg,#101827_0%,#131f35_100%)] p-[0.48rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.28)]">
                      <div className="relative min-h-[24rem] overflow-hidden rounded-[1.95rem] bg-[linear-gradient(180deg,#111b31_0%,#172441_100%)] px-4 pb-4 pt-4 text-white ring-1 ring-white/7">
                        <div className="mx-auto h-5 w-24 rounded-full bg-black/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />
                        <div className="absolute left-[0.2rem] top-24 h-12 w-[2px] rounded-full bg-white/16" />
                        <div className="absolute right-[0.2rem] top-32 h-16 w-[2px] rounded-full bg-white/14" />
                        <div className="mt-4 flex items-center justify-between text-white/72">
                          <div aria-hidden="true" className="flex size-10 items-center justify-center rounded-2xl bg-white/8">
                            <Layers3 className="size-4" />
                          </div>
                          <div className="rounded-full bg-primary-400/16 px-3 py-1 text-xs font-semibold text-primary-100">
                            Hiring app
                          </div>
                          <div aria-hidden="true" className="flex size-10 items-center justify-center rounded-2xl bg-white/8">
                            <ArrowRight className="size-4" />
                          </div>
                        </div>

                        <div className="mt-4 rounded-[1.35rem] border border-white/8 bg-white/6 p-3 backdrop-blur">
                          <div className="flex items-center gap-3 text-sm text-white/66">
                            <FileText className="size-4" />
                            Buscar talento o vacantes
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {mobileWorkspaceSteps.map((step, index) => (
                            <span
                              key={step}
                              className={cn(
                                'rounded-full px-3 py-1 text-xs font-semibold',
                                index === 1 ? 'bg-primary-500 text-white' : 'bg-white/8 text-white/72'
                              )}
                            >
                              {step}
                            </span>
                          ))}
                        </div>

                        <div className="mt-4 space-y-2.5">
                          {mobileWorkspaceItems.map((item, index) => (
                            <div key={item.title} className="rounded-[1.35rem] border border-white/8 bg-white/7 p-3.5 backdrop-blur">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{item.title}</p>
                                  <p className="mt-1 text-xs leading-5 text-white/62">{item.meta}</p>
                                </div>
                                <span
                                  className={cn(
                                    'rounded-full px-3 py-1 text-[0.68rem] font-semibold',
                                    index === 0 && 'bg-emerald-400/16 text-emerald-200',
                                    index === 1 && 'bg-sky-400/16 text-sky-200',
                                    index === 2 && 'bg-white/10 text-white/72'
                                  )}
                                >
                                  {item.state}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="absolute inset-x-4 bottom-4 rounded-[1.3rem] border border-white/8 bg-white/6 p-3 backdrop-blur">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Desde el teléfono</p>
                              <p className="mt-1 text-sm font-semibold text-white">Seguimiento claro y accionable</p>
                            </div>
                            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-500">
                              <Smartphone className="size-5 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-[32px] shadow-[var(--app-shadow-card)] outline outline-1 outline-black/5 dark:outline-white/10" />
            </div>

            <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-[30px] bg-white/72 dark:bg-white/6" />
                <div className="relative flex h-full flex-col overflow-hidden rounded-[29px] border bg-[var(--app-surface)]/92 p-5 shadow-[var(--app-shadow-card)] backdrop-blur-sm sm:p-6">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--app-info-surface)] shadow-[var(--app-shadow-card)]">
                    <profileFeature.icon className="size-5 text-primary-700 dark:text-primary-200" />
                  </div>
                  <p className="text-xl font-semibold tracking-tight text-[var(--app-text)]">{profileFeature.name}</p>
                  <p className="mt-3 text-base leading-7 text-[var(--app-text-muted)]">{profileFeature.description}</p>
                  <div className="mt-5 rounded-[20px] border bg-[var(--app-surface-muted)]/88 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-primary-500 text-sm font-semibold text-white">AP</div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--app-text)]">Ana Pérez</p>
                        <p className="text-xs text-[var(--app-text-muted)]">Perfil reutilizable listo para aplicar</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-[30px] shadow-[var(--app-shadow-card)] outline outline-1 outline-black/5 dark:outline-white/10" />
              </div>

              <div className="relative">
                <div className="absolute inset-0 rounded-[30px] bg-white/72 dark:bg-white/6" />
                <div className="relative flex h-full flex-col overflow-hidden rounded-[29px] border bg-[var(--app-surface)]/92 p-5 shadow-[var(--app-shadow-card)] backdrop-blur-sm sm:p-6">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--app-info-surface)] shadow-[var(--app-shadow-card)]">
                    <jobsFeature.icon className="size-5 text-primary-700 dark:text-primary-200" />
                  </div>
                  <p className="text-xl font-semibold tracking-tight text-[var(--app-text)]">{jobsFeature.name}</p>
                  <p className="mt-3 text-base leading-7 text-[var(--app-text-muted)]">{jobsFeature.description}</p>
                  <div className="mt-5 rounded-[20px] border bg-[var(--app-info-surface)]/84 p-4">
                    <div className="rounded-[16px] bg-[var(--app-surface)] px-4 py-4 shadow-[var(--app-shadow-card)]">
                      <p className="text-sm font-semibold text-[var(--app-text)]">Frontend Engineer</p>
                      <div className="mt-3 rounded-full bg-primary-500 px-4 py-2 text-center text-sm font-semibold text-white">
                        Aplicar ahora
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-[30px] shadow-[var(--app-shadow-card)] outline outline-1 outline-black/5 dark:outline-white/10" />
              </div>

              <div className="relative lg:col-span-2">
                <div className="absolute inset-0 rounded-[30px] bg-white/72 dark:bg-white/6" />
                <div className="relative flex h-full flex-col overflow-hidden rounded-[29px] border bg-[var(--app-surface)]/92 p-5 shadow-[var(--app-shadow-card)] backdrop-blur-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--app-info-surface)] shadow-[var(--app-shadow-card)]">
                        <collaborationFeature.icon className="size-5 text-primary-700 dark:text-primary-200" />
                      </div>
                      <p className="text-xl font-semibold tracking-tight text-[var(--app-text)]">{collaborationFeature.name}</p>
                      <p className="mt-3 max-w-[38rem] text-base leading-7 text-[var(--app-text-muted)]">
                        {collaborationFeature.description}
                      </p>
                    </div>

                    <div className="rounded-[18px] border bg-[var(--app-success-surface)]/78 px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--app-text)]">{growthFeature.name}</p>
                      <p className="mt-1 max-w-[24ch] text-sm leading-6 text-[var(--app-text-muted)]">{growthFeature.description}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      ['Recruiting', 'Perfil fuerte para entrevista'],
                      ['Hiring manager', 'Buen fit para el equipo']
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[20px] border bg-[var(--app-surface-muted)]/88 p-4 shadow-[var(--app-shadow-card)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-text-subtle)]">{label}</p>
                        <p className="mt-2 text-base font-medium text-[var(--app-text)]">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-[30px] shadow-[var(--app-shadow-card)] outline outline-1 outline-black/5 dark:outline-white/10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tm-landing-section-tight overflow-hidden">
        <div className="mx-auto max-w-[98rem] px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl text-left lg:max-w-[42rem]">
            <Badge className="w-fit" variant="outline">
              Valor del producto
            </Badge>
            <h2 className="mt-5 max-w-[17ch] text-3xl font-semibold tracking-tight text-balance text-[var(--app-text)] sm:text-4xl lg:max-w-[16ch]">
              Así se entiende mejor el producto
            </h2>
            <p className="mt-4 max-w-[38rem] text-base leading-8 text-[var(--app-text-muted)] sm:text-lg">
              Menos explicación abstracta y más escenas claras de cómo se ve publicar, colaborar y mover procesos en la plataforma.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:gap-5 lg:grid-cols-6">
            <div className="relative lg:col-span-3">
              <div className="absolute inset-0 rounded-[32px] bg-white/70 dark:bg-white/6" />
              <div className="relative overflow-hidden rounded-[31px] border bg-[var(--app-surface)]/94 shadow-[var(--app-shadow-floating)] backdrop-blur-sm">
                <div className="relative h-72 overflow-hidden sm:h-80">
                  <img
                    alt="Equipo revisando una estrategia de contratación"
                    className="block h-full w-full object-cover"
                    src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1600&h=980&q=80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(9,17,39,0.64)] via-[rgba(9,17,39,0.18)] to-transparent" />
                  <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-white/14 px-3 py-1 text-xs font-semibold text-white backdrop-blur sm:left-5 sm:top-5">
                    Publicación más clara
                  </div>
                  <div className="absolute inset-x-4 bottom-4 rounded-[24px] border border-white/18 bg-[rgba(12,21,42,0.72)] p-4 text-white shadow-[var(--app-shadow-floating)] backdrop-blur sm:inset-x-5 sm:bottom-5">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/70">Vacantes que convierten</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">Más contexto desde el primer vistazo</p>
                    <p className="mt-2 max-w-[34ch] text-sm leading-6 text-white/78">
                      Roles bien presentados, mensaje consistente y acceso visible para aplicar sin fricción.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {['Remoto', 'Brief claro', 'Aplicación visible'].map((tag) => (
                        <span key={tag} className="rounded-full border border-white/14 bg-white/10 px-3 py-1 text-xs font-medium text-white/88">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-[32px] shadow-[var(--app-shadow-card)] outline outline-1 outline-black/5 dark:outline-white/10" />
            </div>

            <div className="relative lg:col-span-3">
              <div className="absolute inset-0 rounded-[32px] bg-white/70 dark:bg-white/6" />
              <div className="relative overflow-hidden rounded-[31px] border bg-[var(--app-surface)]/94 shadow-[var(--app-shadow-floating)] backdrop-blur-sm">
                <div className="relative h-72 overflow-hidden sm:h-80">
                  <img
                    alt="Equipo colaborando en una oficina moderna"
                    className="block h-full w-full object-cover"
                    src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1600&h=980&q=80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(9,17,39,0.68)] via-[rgba(9,17,39,0.18)] to-transparent" />
                  <div className="absolute inset-x-4 top-4 rounded-[22px] border border-white/18 bg-[rgba(12,21,42,0.72)] p-4 text-white backdrop-blur sm:inset-x-5 sm:top-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/70">Equipo alineado</p>
                        <p className="mt-1 text-lg font-semibold tracking-tight">Comentarios donde toca</p>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        <span className="size-2 rounded-full bg-primary-300" />
                        <span className="size-2 rounded-full bg-secondary-300" />
                        <span className="size-2 rounded-full bg-peach-300" />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {['Feedback compartido', 'Decisión visible', 'Siguiente paso claro'].map((item) => (
                        <div key={item} className="rounded-[16px] border border-white/12 bg-white/10 px-3 py-2 text-sm font-medium text-white/88">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4 rounded-[22px] border border-white/18 bg-[rgba(12,21,42,0.72)] p-4 text-white shadow-[var(--app-shadow-card)] backdrop-blur sm:bottom-5 sm:right-5">
                    <p className="text-sm font-semibold">Una sola conversación</p>
                    <p className="mt-1 max-w-[20ch] text-sm leading-6 text-white/76">
                      Recruiters y líderes avanzan sobre la misma información.
                    </p>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-[32px] shadow-[var(--app-shadow-card)] outline outline-1 outline-black/5 dark:outline-white/10" />
            </div>

            {valueBentoCards.map((panel, panelIndex) => {
              const Icon = panel.icon

              return (
                <div key={panel.title} className="relative lg:col-span-2">
                  <div className="absolute inset-0 rounded-[30px] bg-white/70 dark:bg-white/6" />
                  <div className="relative flex h-full flex-col overflow-hidden rounded-[29px] border bg-[var(--app-surface)]/94 shadow-[var(--app-shadow-card)] backdrop-blur-sm">
                    <div className="relative h-52 overflow-hidden">
                      <img alt={panel.alt} className="block h-full w-full object-cover" src={panel.image} />
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(9,17,39,0.58)] via-[rgba(9,17,39,0.1)] to-transparent" />
                      <div className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-2xl bg-white/84 shadow-[var(--app-shadow-card)]">
                        <Icon className="size-5 text-primary-700 dark:text-primary-200" />
                      </div>
                    </div>
                    <div className="p-5 sm:p-6">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]">
                        {panelIndex === 0 ? 'Atracción' : panelIndex === 1 ? 'Colaboración' : 'Seguimiento'}
                      </p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--app-text)]">{panel.title}</p>
                      <p className="mt-3 text-base leading-7 text-[var(--app-text-muted)]">{panel.body}</p>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-[30px] shadow-[var(--app-shadow-card)] outline outline-1 outline-black/5 dark:outline-white/10" />
                </div>
              )
            })}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="hover:shadow-[0_24px_44px_rgba(43,69,143,0.34)]" onClick={() => void navigate(primaryAction.href)}>
              {primaryAction.label}
              <ArrowRight className="size-4" />
            </Button>
            <Button
              className="hover:border-primary-400 hover:bg-white hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]"
              variant="outline"
              onClick={() => scrollToSection('faq')}
            >
              Resolver dudas
            </Button>
          </div>
        </div>
      </section>

      <section className="group/tiers relative isolate overflow-hidden" id="pricing">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background: `
              radial-gradient(circle at 12% 16%, rgba(159, 182, 255, 0.36), transparent 22%),
              radial-gradient(circle at 88% 12%, rgba(111, 142, 244, 0.3), transparent 24%),
              radial-gradient(circle at 50% 40%, rgba(159, 182, 255, 0.16), transparent 18%),
              radial-gradient(circle at 50% 62%, rgba(79, 110, 216, 0.3), transparent 34%),
              linear-gradient(135deg, #2b418f 0%, #3955b8 18%, #4f6ed8 38%, #6f8ef4 50%, #4f6ed8 62%, #3955b8 80%, #2b418f 100%)
            `
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-90"
          style={{
            background: `
              linear-gradient(180deg, rgba(159, 182, 255, 0.16) 0%, rgba(159, 182, 255, 0.05) 16%, rgba(159, 182, 255, 0) 32%),
              linear-gradient(125deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 28%, rgba(43, 65, 143, 0.1) 62%, rgba(43, 65, 143, 0.22) 100%)
            `
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-64"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, rgba(159, 182, 255, 0.22), transparent 34%), linear-gradient(180deg, rgba(17, 30, 71, 0) 0%, rgba(17, 30, 71, 0.34) 100%)'
          }}
        />

        <div className="flow-root border-b border-b-transparent bg-transparent pt-14 pb-12 sm:pt-16 sm:pb-14 lg:pt-18 lg:pb-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative z-10">
              <h2 className="mx-auto max-w-4xl text-center text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
                Planes claros para empezar, crecer y acompañar tu proceso de contratación
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-center text-base font-medium leading-8 text-white/72 sm:text-lg">
                Precios visibles, comparación fácil de entender y una propuesta comercial lista para enseñar desde ya.
              </p>

              <div className="mt-8 flex justify-center">
                <fieldset aria-label="Frecuencia de pago">
                  <div className="grid grid-cols-2 gap-x-1 rounded-full bg-white/8 p-1 text-center text-xs font-semibold text-white">
                    {billingFrequencies.map((frequency) => (
                      <label
                        key={frequency.value}
                        className={cn(
                          'cursor-pointer rounded-full px-3 py-2 transition',
                          billingFrequency === frequency.value
                            ? 'bg-primary-500 text-white'
                            : 'text-white/72 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        <input
                          checked={billingFrequency === frequency.value}
                          className="sr-only"
                          name="billing-frequency"
                          type="radio"
                          value={frequency.value}
                          onChange={() => setBillingFrequency(frequency.value)}
                        />
                        {frequency.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>

            <div className="relative z-10 mx-auto mt-8 grid max-w-md grid-cols-1 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-6">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[-10rem] hidden h-72 rounded-full blur-3xl lg:block"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(57, 85, 184, 0.24), transparent 54%), radial-gradient(circle at 78% 42%, rgba(111, 142, 244, 0.2), transparent 48%)'
                }}
              />

              {pricingPlans.map((plan) => {
                const isSelected = selectedPlanName === plan.name

                return (
                  <div
                    key={plan.name}
                    className={cn(
                      'relative cursor-pointer rounded-[28px] border p-8 transition duration-300 ease-out xl:p-10',
                      isSelected
                        ? 'z-20 -translate-y-3 scale-[1.02] border-primary-200/80 bg-white shadow-[0_38px_110px_rgba(18,31,68,0.28)] ring-1 ring-primary-300 hover:shadow-[0_42px_118px_rgba(18,31,68,0.32)] lg:-translate-y-6 dark:border-primary-300/40 dark:bg-[linear-gradient(180deg,rgba(245,248,255,0.98)_0%,rgba(232,240,255,0.96)_100%)]'
                        : 'border-white/10 bg-white/7 text-white shadow-[0_20px_48px_rgba(0,0,0,0.22)] backdrop-blur-md hover:-translate-y-2 hover:border-white/18 hover:bg-white/10 hover:shadow-[0_28px_68px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10'
                    )}
                    onClick={() => setSelectedPlanName(plan.name)}
                  >
                    <div
                      aria-hidden="true"
                      className={cn(
                        'pointer-events-none absolute inset-x-8 -bottom-5 h-8 rounded-full blur-2xl transition duration-300',
                        isSelected ? 'bg-primary-500/30 opacity-100' : 'opacity-0'
                      )}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <Badge
                        className={cn(
                          plan.featured || isSelected
                            ? 'border-primary-200 bg-primary-50 text-primary-700'
                            : 'border-white/18 bg-white/10 text-white'
                        )}
                        variant="outline"
                      >
                        {plan.featured ? 'Recomendado' : 'Plan'}
                      </Badge>
                      <p className={cn('text-sm', isSelected ? 'text-slate-500' : 'text-white/70')}>
                        {billingFrequency === 'monthly' ? 'Facturación mensual' : 'Facturación anual'}
                      </p>
                    </div>

                    <h3 className={cn('mt-5 text-xl font-semibold', isSelected ? 'text-slate-900' : 'text-white')}>
                      {plan.name}
                    </h3>
                    <p
                      className={cn(
                        'mt-2 text-sm leading-6',
                        isSelected ? 'text-slate-600' : 'text-white/74'
                      )}
                    >
                      {plan.description}
                    </p>

                    <div className="mt-6 flex items-end gap-3">
                      <p
                        className={cn(
                          'text-4xl font-semibold tracking-tight',
                          isSelected ? 'text-slate-900' : 'text-white'
                        )}
                      >
                        {plan.price[billingFrequency]}
                      </p>
                      <p className={cn('pb-1 text-sm', isSelected ? 'text-slate-500' : 'text-white/72')}>
                        {plan.cadence[billingFrequency]}
                      </p>
                    </div>

                    <ul
                      className={cn(
                        'mt-8 space-y-3 border-t pt-6 text-sm leading-6',
                        isSelected ? 'border-slate-200 text-slate-600' : 'border-white/10 text-white/82'
                      )}
                      role="list"
                    >
                      {plan.highlights.map((highlight) => (
                        <li key={highlight} className="flex gap-3">
                          <Check
                            className={cn(
                              'mt-0.5 size-5 shrink-0',
                              isSelected ? 'text-primary-600' : 'text-primary-300'
                            )}
                          />
                          {highlight}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={cn(
                        'mt-8 w-full',
                        isSelected
                          ? 'hover:shadow-[0_24px_42px_rgba(43,69,143,0.34)]'
                          : 'border-white/12 bg-white/10 text-white hover:border-white/36 hover:bg-white/22 hover:text-white hover:shadow-[0_22px_42px_rgba(8,15,34,0.24)]'
                      )}
                      variant={isSelected ? 'primary' : 'outline'}
                      onClick={() => void navigate(plan.name === 'Starter' ? '/auth/sign-up' : '/auth/sign-in')}
                    >
                      {plan.cta}
                    </Button>
                  </div>
                )
              })}
            </div>

            <div className="relative z-10 mt-8">
              <div
                className={cn(
                  'tm-landing-container flex justify-center transition-[margin,transform] duration-[640ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                  isPricingComparisonOpen ? 'relative z-20 mb-[-1px]' : ''
                )}
              >
                <button
                  aria-controls="pricing-comparison-panel"
                  aria-expanded={isPricingComparisonOpen}
                  className={cn(
                    'tm-pricing-comparison-trigger relative inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-[28px] rounded-b-none border border-[var(--app-border)] px-5 pt-3 pb-2.5 text-sm font-semibold backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 sm:min-w-[18rem] sm:w-auto dark:border-white/10',
                    isPricingComparisonOpen
                      ? 'border-b-0 bg-[var(--app-surface)] text-[var(--app-text)] shadow-[0_14px_28px_rgba(25,42,86,0.08)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-muted)] hover:shadow-[0_18px_34px_rgba(25,42,86,0.12)] focus-visible:ring-[var(--app-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)] dark:bg-[linear-gradient(180deg,rgba(16,29,63,0.96)_0%,rgba(13,24,52,0.98)_100%)] dark:hover:bg-[linear-gradient(180deg,rgba(19,34,74,0.98)_0%,rgba(15,28,61,0.98)_100%)]'
                      : 'bg-white/94 text-[#15203b] shadow-[0_20px_54px_rgba(12,20,44,0.28)] hover:-translate-y-[2px] hover:border-primary-200 hover:bg-white hover:text-primary-700 hover:shadow-[0_26px_64px_rgba(12,20,44,0.4)] focus-visible:ring-white/50'
                  )}
                  data-state={isPricingComparisonOpen ? 'open' : 'closed'}
                  type="button"
                  onClick={togglePricingComparison}
                >
                  <span>{isPricingComparisonOpen ? 'Ocultar comparación' : 'Comparar planes'}</span>
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[0.72rem] font-semibold text-primary-700">
                    {pricingSections.length} bloques
                  </span>
                  <span className="flex size-8 items-center justify-center rounded-full bg-[#15203b] text-white transition duration-300">
                    <ChevronDown className={cn('size-4 transition duration-500', isPricingComparisonOpen && 'rotate-180')} />
                  </span>
                </button>
              </div>

              {isPricingComparisonMounted ? (
                <div
                  className={cn(
                    'tm-landing-container overflow-visible transition-[padding] duration-[640ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                    isPricingComparisonOpen ? 'pb-10 sm:pb-12 lg:pb-14' : 'pointer-events-none pb-0'
                  )}
                >
                  <div className="tm-pricing-comparison-panel-shell relative" data-state={isPricingComparisonOpen ? 'open' : 'closed'}>
                    <div className="min-h-0">
                      <div
                        className="tm-pricing-comparison-panel-surface overflow-hidden rounded-[32px] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-card)] backdrop-blur-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(16,29,63,0.96)_0%,rgba(13,24,52,0.98)_100%)]"
                        id="pricing-comparison-panel"
                      >
                        <div className="tm-pricing-comparison-panel-content">
                          <div className="border-b border-[var(--app-border)] px-5 pt-7 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
                            <div className="text-left">
                              <p className="text-base font-semibold text-[var(--app-text)]">Comparación completa de planes</p>
                              <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
                                Revisa publicación, colaboración y acompañamiento en una sola vista cuando necesites más detalle.
                              </p>
                            </div>
                          </div>

                          <div className="tm-landing-container py-10 sm:py-12 lg:py-14">
                            <section aria-labelledby="mobile-pricing-comparison" className="lg:hidden">
                              <h2 className="sr-only" id="mobile-pricing-comparison">
                                Comparacion de planes
                              </h2>

                              <div className="mx-auto max-w-2xl space-y-10 sm:space-y-12">
                                {pricingPlans.map((plan) => {
                                  const isSelected = selectedPlanName === plan.name

                                  return (
                                    <div key={plan.name} className="border-t border-[var(--app-border)] pt-10">
                                      <div
                                        className={cn(
                                          '-mt-px w-72 border-t-2 pt-8 md:w-80',
                                          isSelected ? 'border-primary-500' : 'border-transparent'
                                        )}
                                      >
                                        <h3
                                          className={cn(
                                            'text-sm font-semibold',
                                            isSelected ? 'text-primary-700 dark:text-primary-200' : 'text-[var(--app-text)]'
                                          )}
                                        >
                                          {plan.name}
                                        </h3>
                                        <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">{plan.description}</p>
                                      </div>

                                      <div className="mt-6 space-y-6">
                                        {pricingSections.map((section) => (
                                          <div key={section.name}>
                                            <h4 className="text-sm font-semibold text-[var(--app-text)]">{section.name}</h4>
                                            <div className="mt-5 rounded-[24px] border bg-[var(--app-surface)] shadow-[var(--app-shadow-card)]">
                                              <dl className="divide-y text-sm leading-6">
                                                {section.features.map((feature) => (
                                                  <div key={feature.name} className="flex items-center justify-between gap-4 px-4 py-3">
                                                    <dt className="pr-4 text-[var(--app-text-muted)]">{feature.name}</dt>
                                                    <dd className="flex min-w-20 items-center justify-end">
                                                      {renderTierValue(feature.tiers[plan.name], isSelected)}
                                                    </dd>
                                                  </div>
                                                ))}
                                              </dl>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </section>

                            <section aria-labelledby="desktop-pricing-comparison" className="hidden lg:block">
                              <h2 className="sr-only" id="desktop-pricing-comparison">
                                Comparacion de planes
                              </h2>

                              <div className="grid grid-cols-4 gap-x-8 border-t border-[var(--app-border)] before:block">
                                {pricingPlans.map((plan) => {
                                  const isSelected = selectedPlanName === plan.name

                                  return (
                                    <div key={plan.name} aria-hidden="true" className="-mt-px">
                                      <div className={cn('border-t-2 pt-10', isSelected ? 'border-primary-500' : 'border-transparent')}>
                                        <p
                                          className={cn(
                                            'text-sm font-semibold',
                                            isSelected ? 'text-primary-700 dark:text-primary-200' : 'text-[var(--app-text)]'
                                          )}
                                        >
                                          {plan.name}
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">{plan.description}</p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              <div className="-mt-4 space-y-10 sm:space-y-12">
                                {pricingSections.map((section) => (
                                  <div key={section.name}>
                                    <h3 className="text-sm font-semibold text-[var(--app-text)]">{section.name}</h3>
                                    <div className="relative -mx-8 mt-8">
                                      <div
                                        aria-hidden="true"
                                        className="absolute inset-x-8 inset-y-0 grid grid-cols-4 gap-x-8 before:block"
                                      >
                                        <div className="rounded-[24px] bg-[var(--app-surface)] shadow-[var(--app-shadow-card)]" />
                                        <div className="rounded-[24px] bg-[var(--app-surface)] shadow-[var(--app-shadow-card)]" />
                                        <div className="rounded-[24px] bg-[var(--app-surface)] shadow-[var(--app-shadow-card)]" />
                                      </div>

                                      <table className="relative w-full border-separate border-spacing-x-8">
                                        <thead>
                                          <tr className="text-left">
                                            <th scope="col">
                                              <span className="sr-only">Feature</span>
                                            </th>
                                            {pricingPlans.map((plan) => (
                                              <th key={plan.name} scope="col">
                                                <span className="sr-only">{plan.name}</span>
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {section.features.map((feature, featureIndex) => (
                                            <tr key={feature.name}>
                                              <th
                                                className="w-1/4 py-3 pr-4 text-left text-sm font-normal text-[var(--app-text)]"
                                                scope="row"
                                              >
                                                {feature.name}
                                                {featureIndex !== section.features.length - 1 ? (
                                                  <div className="absolute inset-x-8 mt-3 h-px bg-[var(--app-border)]" />
                                                ) : null}
                                              </th>
                                              {pricingPlans.map((plan) => {
                                                const isSelected = selectedPlanName === plan.name

                                                return (
                                                  <td key={plan.name} className="relative w-1/4 px-4 py-0 text-center">
                                                    <span className="relative inline-flex size-full items-center justify-center py-3">
                                                      {renderTierValue(feature.tiers[plan.name], isSelected)}
                                                    </span>
                                                  </td>
                                                )
                                              })}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>

                                      <div
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-x-8 inset-y-0 grid grid-cols-4 gap-x-8 before:block"
                                      >
                                        {pricingPlans.map((plan) => {
                                          const isSelected = selectedPlanName === plan.name

                                          return (
                                            <div
                                              key={plan.name}
                                              className={cn(
                                                'rounded-[24px] transition duration-300',
                                                isSelected ? 'ring-2 ring-primary-500 shadow-[0_22px_48px_rgba(79,110,216,0.14)]' : 'ring-1 ring-[var(--app-border)]'
                                              )}
                                            />
                                          )
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>

                            <div className="mt-10 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                              <div className="rounded-[30px] border bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow-card)] sm:p-8">
                                <div className="flex items-center gap-3">
                                  <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--app-info-surface)]">
                                    <WalletCards className="size-5 text-primary-700 dark:text-primary-200" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--app-text)]">Una propuesta fácil de explicar</p>
                                    <p className="text-sm text-[var(--app-text-muted)]">
                                      El pricing ya acompaña demos, conversaciones de ventas y evaluaciones internas.
                                    </p>
                                  </div>
                                </div>
                                <p className="mt-5 text-sm leading-7 text-[var(--app-text-muted)]">
                                  Los planes muestran de forma realista cómo crece la experiencia sin fingir que los cobros ya están
                                  activos. La superficie comercial existe; el procesamiento de pagos todavía no.
                                </p>
                              </div>

                              <div className="rounded-[30px] border bg-[var(--app-warning-surface)] p-6 shadow-[var(--app-shadow-card)] sm:p-8">
                                <div className="flex items-center gap-3">
                                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/80 shadow-[var(--app-shadow-card)]">
                                    <HandHeart className="size-5 text-[var(--app-text)]" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--app-text)]">Donaciones y sponsorships</p>
                                    <p className="text-sm text-[var(--app-text-muted)]">Superficie visible del roadmap comercial</p>
                                  </div>
                                </div>
                                <p className="mt-5 text-sm leading-7 text-[var(--app-text-muted)]">
                                  Este espacio ya existe para validar la narrativa de apoyo al producto, pero el procesamiento de
                                  pagos permanece desactivado hasta conectar billing real.
                                </p>
                                <Button className="mt-6 w-full" disabled variant="outline">
                                  Donaciones proximamente
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="tm-landing-section bg-[var(--app-canvas)]" id="faq">
        <div className="tm-landing-container">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--app-info-surface)]">
                <CircleHelp className="size-5 text-primary-700 dark:text-primary-200" />
              </div>
              <Badge variant="outline">FAQ</Badge>
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--app-text)] sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <dl className="mt-10 divide-y">
              {faqs.map((faq) => (
                <details key={faq.question} className="group py-6 first:pt-0 last:pb-0">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left text-[var(--app-text)] transition hover:text-primary-700 dark:hover:text-primary-200">
                    <span className="text-base font-semibold leading-7">{faq.question}</span>
                    <span className="flex h-7 items-center">
                      <span className="flex size-7 items-center justify-center rounded-full border bg-[var(--app-surface)] text-[var(--app-text-muted)] transition group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-3xl pr-8 text-base leading-7 text-[var(--app-text-muted)]">{faq.answer}</p>
                </details>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="tm-landing-section overflow-hidden">
        <div className="tm-landing-container">
          <div className="relative rounded-[36px] border bg-[var(--app-surface)] px-6 py-8 shadow-[var(--app-shadow-floating)] sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <div
              aria-hidden="true"
              className="absolute right-0 bottom-0 h-48 w-48 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle at center, rgba(57, 85, 184, 0.2), transparent 64%)' }}
            />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="max-w-2xl">
                <Badge variant="soft">Siguiente paso</Badge>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance text-[var(--app-text)] sm:text-4xl">
                  Comparte la landing, empieza demos y abre procesos desde una base que ya se siente premium
                </h2>
                <p className="mt-5 text-base leading-7 text-[var(--app-text-muted)]">
                  Desde aquí puedes llevar usuarios a jobs, signup o al espacio de trabajo sin sacrificar claridad ni
                  mezclar herramientas internas con la experiencia del cliente.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button className="hover:shadow-[0_24px_44px_rgba(43,69,143,0.34)]" onClick={() => void navigate(primaryAction.href)}>
                  {primaryAction.label}
                </Button>
                <Button
                  className="hover:border-primary-400 hover:bg-white hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]"
                  variant="outline"
                  onClick={() => void navigate('/jobs')}
                >
                  Explorar jobs
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-[var(--app-canvas)]">
        <div className="mx-auto max-w-7xl overflow-hidden px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
          <nav aria-label="Footer" className="-mb-6 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm leading-6">
            {footerNavigation.map((item) =>
              'section' in item ? (
                <button
                  key={item.label}
                  className="cursor-pointer rounded-full px-3 py-1.5 text-[var(--app-text-muted)] transition-[transform,background-color,color,box-shadow] duration-200 ease-out hover:-translate-y-px hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] hover:shadow-[var(--app-shadow-card)]"
                  type="button"
                  onClick={() => scrollToSection(item.section)}
                >
                  {item.label}
                </button>
              ) : (
                <button
                  key={item.label}
                  className="cursor-pointer rounded-full px-3 py-1.5 text-[var(--app-text-muted)] transition-[transform,background-color,color,box-shadow] duration-200 ease-out hover:-translate-y-px hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] hover:shadow-[var(--app-shadow-card)]"
                  type="button"
                  onClick={() => void navigate(item.route)}
                >
                  {item.label}
                </button>
              )
            )}
          </nav>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            {footerSignals.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-full border bg-[var(--app-surface)] px-4 py-2 text-sm text-[var(--app-text-muted)] shadow-[var(--app-shadow-card)]"
                >
                  <Icon className="size-4 text-primary-600 dark:text-primary-300" />
                  {item.label}
                </div>
              )
            })}
          </div>

          <p className="mt-10 text-center text-sm leading-6 text-[var(--app-text-muted)]">
            &copy; {footerYear} ASI Rep. Dominicana. Vacantes públicas, perfiles reutilizables y trabajo en equipo en
            una experiencia de hiring mucho más clara.
          </p>
        </div>
      </footer>
    </div>
  )
}
