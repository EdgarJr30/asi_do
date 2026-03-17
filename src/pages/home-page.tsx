import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
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
type Tone = 'info' | 'success' | 'warning' | 'default'

const heroSignals = [
  {
    title: 'Perfil reusable',
    description: 'Aplica y comparte tu información sin empezar de cero.',
    icon: FileText
  },
  {
    title: 'Pipeline compartido',
    description: 'Recruiting y líderes ven el mismo avance con contexto claro.',
    icon: Workflow
  },
  {
    title: 'Listo para móvil',
    description: 'La experiencia se entiende y se siente bien en cada pantalla.',
    icon: Smartphone
  }
] as const

const heroMetrics = [
  {
    label: 'Vacantes activas',
    value: '12',
    detail: 'publicadas y listas para compartir',
    icon: BriefcaseBusiness,
    tone: 'info'
  },
  {
    label: 'Tiempo de respuesta',
    value: '-32%',
    detail: 'menos fricción entre etapas y feedback',
    icon: Sparkles,
    tone: 'success'
  },
  {
    label: 'Equipo alineado',
    value: '3 roles',
    detail: 'recruiting, líderes y talento en el mismo flujo',
    icon: HandHeart,
    tone: 'warning'
  }
] as const

const heroPipelineStages = [
  { label: 'Aplicaciones nuevas', count: '18', tone: 'info' },
  { label: 'Entrevistas activas', count: '6', tone: 'success' },
  { label: 'Feedback pendiente', count: '4', tone: 'warning' },
  { label: 'Oferta en revisión', count: '2', tone: 'default' }
] as const

const heroCandidates = [
  {
    initials: 'AP',
    name: 'Ana Pérez',
    role: 'Product Designer',
    stage: 'Entrevista final',
    tone: 'success'
  },
  {
    initials: 'JL',
    name: 'José López',
    role: 'Full-stack Engineer',
    stage: 'Screening',
    tone: 'info'
  },
  {
    initials: 'MR',
    name: 'María Rosario',
    role: 'HR Operations',
    stage: 'Feedback',
    tone: 'warning'
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

const workflowPanels = [
  {
    title: 'Atracción que convierte',
    body: 'Muestra tus vacantes de forma clara y dale al talento un camino rápido para aplicar.',
    icon: BriefcaseBusiness
  },
  {
    title: 'Equipo alineado',
    body: 'Recruiters y líderes encuentran la misma información sin perseguir contexto por varios canales.',
    icon: Layers3
  },
  {
    title: 'Seguimiento con ritmo',
    body: 'Cada oportunidad avanza con claridad para que nadie se quede preguntando qué sigue.',
    icon: HeartHandshake
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

function toneClasses(tone: Tone) {
  if (tone === 'info') {
    return 'bg-[var(--app-info-surface)]'
  }

  if (tone === 'success') {
    return 'bg-[var(--app-success-surface)]'
  }

  if (tone === 'warning') {
    return 'bg-[var(--app-warning-surface)]'
  }

  return 'bg-[var(--app-surface)]'
}

function renderTierValue(value: boolean | string, featured: boolean) {
  if (typeof value === 'string') {
    return (
      <span className={cn('text-sm font-semibold', featured ? 'text-primary-700 dark:text-primary-200' : 'text-[var(--app-text)]')}>
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

  return (
    <div className="overflow-hidden bg-[var(--app-canvas)]">
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-[60rem] opacity-90"
          style={{
            backgroundImage:
              'radial-gradient(circle at 10% 12%, rgba(57, 85, 184, 0.18), transparent 22%), radial-gradient(circle at 88% 8%, rgba(111, 142, 244, 0.14), transparent 20%), radial-gradient(circle at 78% 30%, rgba(143, 160, 185, 0.12), transparent 18%)'
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-20 h-[34rem]"
          style={{
            background:
              'linear-gradient(180deg, rgba(244,247,255,0.94) 0%, rgba(255,255,255,0.72) 60%, rgba(255,255,255,0) 100%)'
          }}
        />

        <div className="mx-auto max-w-7xl px-4 pb-16 pt-36 sm:px-6 sm:pb-20 sm:pt-40 lg:px-8 lg:pb-24 lg:pt-44">
          <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(248,250,255,0.82)_100%)] p-5 shadow-[var(--app-shadow-floating)] backdrop-blur-xl dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(16,29,63,0.9)_0%,rgba(9,17,39,0.88)_100%)] sm:rounded-[40px] sm:p-8 xl:p-10">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-40 opacity-80"
              style={{
                background:
                  'radial-gradient(circle at 0% 0%, rgba(57, 85, 184, 0.16), transparent 28%), radial-gradient(circle at 100% 0%, rgba(111, 142, 244, 0.12), transparent 24%)'
              }}
            />

            <div className="relative grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,34rem)] lg:items-center xl:gap-14">
              <div className="w-full">
                <Badge className="max-w-full bg-white/82 text-[var(--app-text)] shadow-[var(--app-shadow-card)] backdrop-blur-sm" variant="outline">
                  Hiring workspace para empresas que quieren verse mejor
                </Badge>
                <h1 className="mt-6 max-w-[11ch] text-4xl font-semibold tracking-tight text-[var(--app-text)] sm:text-5xl lg:text-[3.6rem] lg:leading-[1.04] xl:text-[4.1rem]">
                  Publica vacantes y mueve procesos con claridad.
                </h1>
                <p className="mt-5 max-w-[38rem] text-base leading-7 text-[var(--app-text-muted)] sm:text-lg">
                  Descubre talento, colabora con tu equipo y presenta tu empresa en una experiencia visual, ordenada y
                  fácil de entender desde el primer vistazo.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button className="sm:min-w-44" onClick={() => void navigate(primaryAction.href)}>
                    {primaryAction.label}
                  </Button>
                  <Button className="sm:min-w-44" variant="outline" onClick={() => void navigate('/jobs')}>
                    Explorar jobs
                  </Button>
                  <Button className="group justify-start px-0 text-[var(--app-text)] hover:bg-transparent" variant="ghost" onClick={() => scrollToSection('pricing')}>
                    Ver pricing
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {heroSignals.map((signal) => {
                    const Icon = signal.icon

                    return (
                      <div
                        key={signal.title}
                        className="rounded-[24px] border bg-white/74 p-4 shadow-[var(--app-shadow-card)] backdrop-blur-sm dark:bg-white/6"
                      >
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--app-info-surface)]">
                          <Icon className="size-4 text-primary-700 dark:text-primary-200" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-[var(--app-text)]">{signal.title}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">{signal.description}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-8 top-12 hidden h-28 w-28 rounded-full bg-primary-300/20 blur-3xl lg:block" />
                <div className="absolute -right-10 bottom-6 hidden h-32 w-32 rounded-full bg-peach-300/30 blur-3xl xl:block" />

                <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[color:var(--app-surface-elevated)]/92 p-4 shadow-[var(--app-shadow-floating)] backdrop-blur-xl dark:border-white/8 sm:p-5">
                  <div className="flex items-center justify-between gap-4 rounded-[24px] border bg-[var(--app-surface)]/84 px-4 py-3 shadow-[var(--app-shadow-card)]">
                    <div>
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]">
                        Vista del producto
                      </p>
                      <p className="mt-1 text-base font-semibold text-[var(--app-text)]">Hiring claro para equipos y talento</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary-300" />
                      <span className="size-2 rounded-full bg-secondary-300" />
                      <span className="size-2 rounded-full bg-peach-300" />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-[28px] border bg-[var(--app-surface)]/88 p-5 shadow-[var(--app-shadow-card)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">
                            Pipeline
                          </p>
                          <p className="mt-1 text-lg font-semibold text-[var(--app-text)]">Una vacante, todo el seguimiento</p>
                        </div>
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--app-info-surface)]">
                          <Workflow className="size-4 text-primary-700 dark:text-primary-200" />
                        </div>
                      </div>

                      <div className="mt-5 space-y-3">
                        {heroPipelineStages.map((stage) => (
                          <div key={stage.label} className="rounded-[20px] border bg-[var(--app-surface-muted)]/88 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-[var(--app-text)]">{stage.label}</p>
                              <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', toneClasses(stage.tone))}>
                                {stage.count}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {heroMetrics.map((metric) => {
                        const Icon = metric.icon

                        return (
                          <div
                            key={metric.label}
                            className={cn(
                              'rounded-[24px] border p-4 shadow-[var(--app-shadow-card)] backdrop-blur-sm',
                              toneClasses(metric.tone)
                            )}
                          >
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-white/88 shadow-[var(--app-shadow-card)] dark:bg-white/10">
                              <Icon className="size-4 text-[var(--app-text)]" />
                            </div>
                            <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">
                              {metric.label}
                            </p>
                            <p className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{metric.value}</p>
                            <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">{metric.detail}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[28px] border bg-[var(--app-surface)]/88 p-5 shadow-[var(--app-shadow-card)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">
                          Talento en vista
                        </p>
                        <p className="mt-1 text-lg font-semibold text-[var(--app-text)]">Perfiles y estado sin perder contexto</p>
                      </div>
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--app-success-surface)]">
                        <BadgeCheck className="size-4 text-primary-700 dark:text-primary-200" />
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {heroCandidates.map((candidate) => (
                        <div
                          key={candidate.name}
                          className="flex items-center justify-between gap-3 rounded-[20px] border bg-[var(--app-surface-muted)]/86 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-sm font-semibold text-white">
                              {candidate.initials}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--app-text)]">{candidate.name}</p>
                              <p className="truncate text-sm text-[var(--app-text-muted)]">{candidate.role}</p>
                            </div>
                          </div>
                          <span className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold', toneClasses(candidate.tone))}>
                            {candidate.stage}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="absolute -left-3 bottom-10 hidden rounded-[22px] border bg-white/84 px-4 py-3 shadow-[var(--app-shadow-card)] backdrop-blur-sm dark:bg-white/8 xl:block">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">Marca cuidada</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">Tu empresa se presenta mejor</p>
                </div>
                <div className="absolute -right-4 top-16 hidden rounded-[22px] border bg-white/84 px-4 py-3 shadow-[var(--app-shadow-card)] backdrop-blur-sm dark:bg-white/8 xl:block">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">Listo para crecer</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">Roles, vacantes y equipo en un solo lugar</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--app-canvas)] py-24 sm:py-28" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-14 sm:gap-y-18 lg:mx-0 lg:max-w-none lg:grid-cols-5">
            <div className="col-span-2">
              <Badge variant="soft">Plataforma</Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance text-[var(--app-text)] sm:text-4xl">
                Descubrir talento y mover procesos puede sentirse simple, ordenado y bonito
              </h2>
              <p className="mt-5 text-base leading-8 text-[var(--app-text-muted)] sm:text-lg">
                Cada persona ve una experiencia clara para su momento: descubrir, aplicar, publicar vacantes o
                coordinar contrataciones en equipo sin ruido innecesario.
              </p>
            </div>

            <dl className="col-span-3 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2">
              {featureCards.map((feature) => {
                const Icon = feature.icon

                return (
                  <div key={feature.name}>
                    <dt className="text-base font-semibold text-[var(--app-text)]">
                      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-[var(--app-info-surface)] shadow-[var(--app-shadow-card)]">
                        <Icon className="size-5 text-primary-700 dark:text-primary-200" />
                      </div>
                      {feature.name}
                    </dt>
                    <dd className="mt-1 text-base leading-7 text-[var(--app-text-muted)]">{feature.description}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </div>
      </section>

      <section className="overflow-hidden py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 lg:flex lg:px-8">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-12 gap-y-12 lg:mx-0 lg:max-w-none lg:min-w-full lg:flex-none lg:gap-y-8">
            <div className="lg:col-end-1 lg:w-full lg:max-w-lg lg:pb-8">
              <Badge variant="outline">Valor del producto</Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance text-[var(--app-text)] sm:text-4xl">
                Una sola base para candidatos, empresas y equipos que quieren avanzar con más confianza
              </h2>
              <p className="mt-6 text-lg leading-8 text-[var(--app-text-muted)]">
                Todo está organizado para que cada recorrido se entienda rápido y se sienta natural desde la primera interacción.
              </p>
              <p className="mt-6 text-base leading-7 text-[var(--app-text-muted)]">
                Esa claridad vuelve la plataforma más creíble para demos, onboarding comercial y uso diario sin volver
                al caos de hojas, chats y tabs dispersos.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Button onClick={() => void navigate(primaryAction.href)}>
                  {primaryAction.label}
                  <ArrowRight className="size-4" />
                </Button>
                <Button variant="outline" onClick={() => scrollToSection('faq')}>
                  Resolver dudas
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-end gap-4 sm:gap-6 lg:contents">
              <div className="w-0 flex-auto lg:ml-auto lg:w-auto lg:flex-none lg:self-end">
                <div className="w-full max-w-[30rem] rounded-[32px] border bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow-floating)]">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--app-success-surface)]">
                      <Sparkles className="size-5 text-primary-700 dark:text-primary-200" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--app-text)]">Una primera impresión que sí vende</p>
                      <p className="text-sm text-[var(--app-text-muted)]">Mensaje claro, visual fuerte y recorrido comercial coherente</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] bg-[var(--app-info-surface)] px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--app-text)]">Descubrimiento</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
                        Vacantes atractivas, detalle limpio y acceso rápido para aplicar.
                      </p>
                    </div>
                    <div className="rounded-[22px] bg-[var(--app-warning-surface)] px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--app-text)]">Equipo</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
                        Personas, comentarios y seguimiento sin perder el contexto.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="contents lg:col-span-2 lg:col-end-2 lg:ml-auto lg:flex lg:w-[34rem] lg:items-start lg:justify-end lg:gap-x-6">
                {workflowPanels.map((panel, panelIndex) => {
                  const Icon = panel.icon

                  return (
                    <div
                      key={panel.title}
                      className={cn(
                        'flex w-full max-w-[20rem] flex-none justify-end',
                        panelIndex === 0 && 'order-first self-end max-sm:w-full lg:w-auto',
                        panelIndex === 1 && 'max-sm:w-full',
                        panelIndex === 2 && 'hidden sm:flex lg:w-auto'
                      )}
                    >
                      <div className="w-full rounded-[30px] border bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow-card)]">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--app-surface-muted)]">
                          <Icon className="size-5 text-[var(--app-text)]" />
                        </div>
                        <p className="mt-5 text-lg font-semibold text-[var(--app-text)]">{panel.title}</p>
                        <p className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">{panel.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="group/tiers isolate overflow-hidden" id="pricing">
        <div className="flow-root border-b border-b-transparent bg-[var(--app-text)] pt-24 pb-16 sm:pt-28 lg:pb-0">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative z-10">
              <Badge className="border-white/20 bg-white/10 text-white" variant="outline">
                Pricing
              </Badge>
              <h2 className="mx-auto mt-6 max-w-4xl text-center text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
                Planes claros para empezar, crecer y acompañar tu proceso de contratación
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-center text-base font-medium leading-8 text-white/72 sm:text-lg">
                Precios visibles, comparación fácil de entender y una propuesta comercial lista para enseñar desde ya.
              </p>

              <div className="mt-14 flex justify-center">
                <fieldset aria-label="Frecuencia de pago">
                  <div className="grid grid-cols-2 gap-x-1 rounded-full bg-white/8 p-1 text-center text-xs font-semibold text-white">
                    {billingFrequencies.map((frequency) => (
                      <label
                        key={frequency.value}
                        className={cn(
                          'cursor-pointer rounded-full px-3 py-2 transition',
                          billingFrequency === frequency.value ? 'bg-primary-500 text-white' : 'text-white/72'
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

            <div className="relative mx-auto mt-10 grid max-w-md grid-cols-1 gap-y-8 lg:mx-0 lg:-mb-14 lg:max-w-none lg:grid-cols-3 lg:gap-x-6">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[-10rem] hidden h-72 rounded-full blur-3xl lg:block"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(57, 85, 184, 0.24), transparent 54%), radial-gradient(circle at 78% 42%, rgba(111, 142, 244, 0.2), transparent 48%)'
                }}
              />

              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={cn(
                    'relative rounded-[28px] border p-8 xl:p-10',
                    plan.featured
                      ? 'z-10 bg-white shadow-[var(--app-shadow-floating)]'
                      : 'bg-white/6 text-white shadow-[0_20px_48px_rgba(0,0,0,0.16)] backdrop-blur-sm'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge
                      className={cn(
                        plan.featured ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-white/18 bg-white/10 text-white'
                      )}
                      variant="outline"
                    >
                      {plan.featured ? 'Recomendado' : 'Plan'}
                    </Badge>
                    <p className={cn('text-sm', plan.featured ? 'text-[var(--app-text-subtle)]' : 'text-white/70')}>
                      {billingFrequency === 'monthly' ? 'Facturación mensual' : 'Facturación anual'}
                    </p>
                  </div>

                  <h3 className={cn('mt-5 text-xl font-semibold', plan.featured ? 'text-[var(--app-text)]' : 'text-white')}>
                    {plan.name}
                  </h3>
                  <p className={cn('mt-2 text-sm leading-6', plan.featured ? 'text-[var(--app-text-muted)]' : 'text-white/74')}>
                    {plan.description}
                  </p>

                  <div className="mt-6 flex items-end gap-3">
                    <p className={cn('text-4xl font-semibold tracking-tight', plan.featured ? 'text-[var(--app-text)]' : 'text-white')}>
                      {plan.price[billingFrequency]}
                    </p>
                    <p className={cn('pb-1 text-sm', plan.featured ? 'text-[var(--app-text-muted)]' : 'text-white/72')}>
                      {plan.cadence[billingFrequency]}
                    </p>
                  </div>

                  <ul
                    className={cn(
                      'mt-8 space-y-3 border-t pt-6 text-sm leading-6',
                      plan.featured ? 'border-[var(--app-border)] text-[var(--app-text-muted)]' : 'border-white/10 text-white/82'
                    )}
                    role="list"
                  >
                    {plan.highlights.map((highlight) => (
                      <li key={highlight} className="flex gap-3">
                        <Check className={cn('mt-0.5 size-5 shrink-0', plan.featured ? 'text-primary-600' : 'text-primary-300')} />
                        {highlight}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={cn('mt-8 w-full', !plan.featured && 'border-white/12 bg-white/10 text-white hover:bg-white/18')}
                    variant={plan.featured ? 'primary' : 'outline'}
                    onClick={() => void navigate(plan.name === 'Starter' ? '/auth/sign-up' : '/auth/sign-in')}
                  >
                    {plan.cta}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative bg-[var(--app-canvas-strong)] lg:pt-14">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
            <section aria-labelledby="mobile-pricing-comparison" className="lg:hidden">
              <h2 className="sr-only" id="mobile-pricing-comparison">
                Comparacion de planes
              </h2>

              <div className="mx-auto max-w-2xl space-y-14">
                {pricingPlans.map((plan) => (
                  <div key={plan.name} className="border-t border-[var(--app-border)] pt-10">
                    <div
                      className={cn(
                        '-mt-px w-72 border-t-2 pt-8 md:w-80',
                        plan.featured ? 'border-primary-500' : 'border-transparent'
                      )}
                    >
                      <h3 className={cn('text-sm font-semibold', plan.featured ? 'text-primary-700 dark:text-primary-200' : 'text-[var(--app-text)]')}>
                        {plan.name}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">{plan.description}</p>
                    </div>

                    <div className="mt-8 space-y-8">
                      {pricingSections.map((section) => (
                        <div key={section.name}>
                          <h4 className="text-sm font-semibold text-[var(--app-text)]">{section.name}</h4>
                          <div className="mt-5 rounded-[24px] border bg-[var(--app-surface)] shadow-[var(--app-shadow-card)]">
                            <dl className="divide-y text-sm leading-6">
                              {section.features.map((feature) => (
                                <div key={feature.name} className="flex items-center justify-between gap-4 px-4 py-3">
                                  <dt className="pr-4 text-[var(--app-text-muted)]">{feature.name}</dt>
                                  <dd className="flex min-w-20 items-center justify-end">
                                    {renderTierValue(feature.tiers[plan.name], plan.featured)}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="desktop-pricing-comparison" className="hidden lg:block">
              <h2 className="sr-only" id="desktop-pricing-comparison">
                Comparacion de planes
              </h2>

              <div className="grid grid-cols-4 gap-x-8 border-t border-[var(--app-border)] before:block">
                {pricingPlans.map((plan) => (
                  <div key={plan.name} aria-hidden="true" className="-mt-px">
                    <div className={cn('border-t-2 pt-10', plan.featured ? 'border-primary-500' : 'border-transparent')}>
                      <p className={cn('text-sm font-semibold', plan.featured ? 'text-primary-700 dark:text-primary-200' : 'text-[var(--app-text)]')}>
                        {plan.name}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">{plan.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="-mt-6 space-y-14">
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
                              {pricingPlans.map((plan) => (
                                <td key={plan.name} className="relative w-1/4 px-4 py-0 text-center">
                                  <span className="relative inline-flex size-full items-center justify-center py-3">
                                    {renderTierValue(feature.tiers[plan.name], plan.featured)}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-8 inset-y-0 grid grid-cols-4 gap-x-8 before:block"
                      >
                        {pricingPlans.map((plan) => (
                          <div
                            key={plan.name}
                            className={cn(
                              'rounded-[24px]',
                              plan.featured ? 'ring-2 ring-primary-500' : 'ring-1 ring-[var(--app-border)]'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-14 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
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
      </section>

      <section className="bg-[var(--app-canvas)]" id="faq">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
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
            <dl className="mt-12 divide-y">
              {faqs.map((faq) => (
                <details key={faq.question} className="group py-6 first:pt-0 last:pb-0">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left text-[var(--app-text)]">
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

      <section className="overflow-hidden py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
                <Button onClick={() => void navigate(primaryAction.href)}>{primaryAction.label}</Button>
                <Button variant="outline" onClick={() => void navigate('/jobs')}>
                  Explorar jobs
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-[var(--app-canvas)]">
        <div className="mx-auto max-w-7xl overflow-hidden px-4 py-14 sm:px-6 lg:px-8">
          <nav aria-label="Footer" className="-mb-6 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm leading-6">
            {footerNavigation.map((item) =>
              'section' in item ? (
                <button
                  key={item.label}
                  className="text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
                  type="button"
                  onClick={() => scrollToSection(item.section)}
                >
                  {item.label}
                </button>
              ) : (
                <button
                  key={item.label}
                  className="text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
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
