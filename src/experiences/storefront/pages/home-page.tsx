import { type ReactNode, useState } from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  Building2,
  Check,
  CircleHelp,
  FileText,
  HandHeart,
  Layers3,
  Search,
  WalletCards,
  Workflow,
  X,
} from 'lucide-react';

import { useAppSession } from '@/app/providers/app-session-provider';
import {
  getAuthenticatedHomePath,
  surfacePaths,
} from '@/app/router/surface-paths';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InstitutionalFooter } from '@/experiences/institutional/components/institutional-footer';
import { cn } from '@/lib/utils/cn';
import { PLATFORM_REGISTRATION_LOCKED, PLATFORM_REGISTRATION_LOCKED_MESSAGE } from '@/shared/config/launch-access';

type BillingFrequency = 'monthly' | 'annually';

const landingSoftEase = [0.22, 1, 0.36, 1] as const;
const landingHoverSpring = {
  type: 'spring',
  stiffness: 320,
  damping: 26,
  mass: 0.72,
} as const;
const SHOW_PRICING_SECTION = false;

const pricingComparisonLayoutTransition = {
  type: 'spring',
  stiffness: 280,
  damping: 30,
  mass: 0.8,
} as const;

const pricingComparisonPanelVariants = {
  closed: {
    opacity: 0,
    y: -18,
    scale: 0.985,
    clipPath: 'inset(0 0 100% 0 round 32px)',
    transition: {
      duration: 0.28,
      ease: [0.32, 0, 0.67, 0],
    },
  },
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    clipPath: 'inset(0 0 0% 0 round 32px)',
    transition: {
      duration: 0.46,
      ease: [0.22, 1, 0.36, 1],
      when: 'beforeChildren',
      staggerChildren: 0.045,
      delayChildren: 0.04,
    },
  },
} as const;

const pricingComparisonContentVariants = {
  closed: {
    opacity: 0,
    y: 12,
  },
  open: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1],
    },
  },
} as const;

type LandingRevealProps = {
  amount?: number;
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
};

function LandingReveal({
  amount = 0.18,
  children,
  className,
  delay = 0,
  y = 22,
}: LandingRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={shouldReduceMotion ? false : { opacity: 0, y }}
      transition={{ duration: 0.62, ease: landingSoftEase, delay }}
      viewport={{ once: true, amount }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

type LandingInteractiveSurfaceProps = LandingRevealProps & {
  hoverScale?: number;
  hoverShadow?: string;
  hoverX?: number;
  hoverY?: number;
};

function LandingInteractiveSurface({
  amount,
  children,
  className,
  delay,
  hoverScale = 1.015,
  hoverShadow = '0 24px 54px rgba(18, 31, 68, 0.14)',
  hoverX = 0,
  hoverY = -6,
  y,
}: LandingInteractiveSurfaceProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <LandingReveal amount={amount} className={className} delay={delay} y={y}>
      <motion.div
        transition={landingHoverSpring}
        whileHover={
          shouldReduceMotion
            ? undefined
            : {
                x: hoverX,
                y: hoverY,
                scale: hoverScale,
                boxShadow: hoverShadow,
              }
        }
        whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
      >
        {children}
      </motion.div>
    </LandingReveal>
  );
}

const heroGalleryColumns = [
  {
    offsetClassName: 'pt-10 sm:pt-20 lg:pt-24',
    widthClassName: 'w-24 sm:w-40 lg:w-52',
    items: [
      {
        src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=700&q=80',
        alt: 'Equipo revisando ideas frente a una pizarra',
        className: 'aspect-[4/5]',
      },
    ],
  },
  {
    offsetClassName: 'pt-0',
    widthClassName: 'w-28 sm:w-44 lg:w-64',
    items: [
      {
        src: 'https://images.unsplash.com/photo-1485217988980-11786ced9454?auto=format&fit=crop&w=700&q=80',
        alt: 'Profesional trabajando desde una laptop',
        className: 'aspect-[4/5]',
      },
      {
        src: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=700&q=80',
        alt: 'Equipo colaborando en una oficina abierta',
        className:
          'aspect-[4/5] sm:aspect-[16/10] sm:w-[132%] sm:-ml-[16%] sm:max-w-none',
      },
    ],
  },
  {
    offsetClassName: 'pt-14 sm:pt-24 lg:pt-28',
    widthClassName: 'w-24 sm:w-40 lg:w-52',
    items: [
      {
        src: 'https://images.unsplash.com/photo-1670272504528-790c24957dda?auto=format&fit=crop&w=700&q=80',
        alt: 'Personas conversando en un espacio colaborativo',
        className: 'aspect-[4/5]',
      },
    ],
  },
] as const;

const featureCards = [
  {
    name: 'Perfil que ahorra tiempo',
    description:
      'Cada persona guarda su información una vez y la reutiliza para aplicar con menos fricción.',
    icon: FileText,
  },
  {
    name: 'Vacantes que invitan a aplicar',
    description:
      'Publica roles con una presentación clara para que el talento entienda rápido la oportunidad.',
    icon: Building2,
  },
  {
    name: 'Trabajo en equipo sin caos',
    description:
      'El equipo comparte comentarios, contexto y próximos pasos en un mismo lugar, sin depender de mensajes sueltos ni hojas paralelas.',
    icon: Workflow,
  },
] as const;

const mobileWorkspaceSteps = [
  'Descubrir',
  'Revisar',
  'Comentar',
  'Avanzar',
] as const;

const mobileWorkspaceItems = [
  {
    title: 'Product Designer Senior',
    meta: 'Remoto · Entrevista hoy',
    state: 'En revisión',
    tone: 'ok',
  },
  {
    title: 'Frontend Engineer',
    meta: 'Híbrido · 3 candidatos',
    state: 'Siguiente',
    tone: 'neutral',
  },
] as const;

const billingFrequencies = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'annually', label: 'Anual' },
] as const;

const pricingPlans = [
  {
    name: 'Starter',
    featured: false,
    description:
      'Para empezar a publicar vacantes y ordenar tus primeros procesos.',
    price: {
      monthly: '$0',
      annually: '$0',
    },
    cadence: {
      monthly: 'por mes',
      annually: 'por ano',
    },
    cta: PLATFORM_REGISTRATION_LOCKED ? 'Registro cerrado' : 'Crear cuenta',
    highlights: [
      '1 espacio de empresa',
      'Hasta 2 vacantes activas',
      'Perfil listo para aplicar',
      'Seguimiento esencial',
    ],
  },
  {
    name: 'Growth',
    featured: true,
    description:
      'Ideal para equipos que contratan con frecuencia y quieren una experiencia más colaborativa.',
    price: {
      monthly: '$49',
      annually: '$490',
    },
    cadence: {
      monthly: 'por mes',
      annually: 'por ano',
    },
    cta: 'Solicitar demo',
    highlights: [
      'Hasta 10 vacantes activas',
      'Talento visible por preferencia',
      'Accesos para el equipo',
      'Alertas y exportes',
    ],
  },
  {
    name: 'Scale',
    featured: false,
    description:
      'Pensado para empresas que quieren acompañamiento, visibilidad y más control del crecimiento.',
    price: {
      monthly: 'A medida',
      annually: 'A medida',
    },
    cadence: {
      monthly: 'plan a medida',
      annually: 'plan a medida',
    },
    cta: 'Hablar con ventas',
    highlights: [
      'Vacantes y equipo a medida',
      'Soporte prioritario',
      'Acompañamiento de lanzamiento',
      'Operación ampliada',
    ],
  },
] as const;

type PricingPlanName = (typeof pricingPlans)[number]['name'];

const pricingSections = [
  {
    name: 'Publicación',
    features: [
      {
        name: 'Vacantes activas incluidas',
        tiers: { Starter: '2', Growth: '10', Scale: 'Ilimitadas' },
      },
      {
        name: 'Perfiles listos para aplicar',
        tiers: { Starter: true, Growth: true, Scale: true },
      },
      {
        name: 'Página de empresa',
        tiers: { Starter: true, Growth: true, Scale: true },
      },
    ],
  },
  {
    name: 'Colaboración',
    features: [
      {
        name: 'Miembros del equipo',
        tiers: { Starter: '2', Growth: '10', Scale: 'Ilimitados' },
      },
      {
        name: 'Talento visible por preferencia',
        tiers: { Starter: false, Growth: true, Scale: true },
      },
      {
        name: 'Comentarios y seguimiento',
        tiers: { Starter: false, Growth: true, Scale: true },
      },
      {
        name: 'Alertas y exportes',
        tiers: { Starter: false, Growth: true, Scale: true },
      },
    ],
  },
  {
    name: 'Acompañamiento',
    features: [
      {
        name: 'Configuración del equipo',
        tiers: { Starter: true, Growth: true, Scale: true },
      },
      {
        name: 'Ayuda para lanzar la operación',
        tiers: { Starter: false, Growth: true, Scale: true },
      },
      {
        name: 'Implementación guiada',
        tiers: { Starter: false, Growth: false, Scale: true },
      },
      {
        name: 'Soporte prioritario',
        tiers: { Starter: false, Growth: false, Scale: true },
      },
    ],
  },
] as const;

const faqs = [
  {
    question: '¿Qué hace diferente a ASI?',
    answer:
      'Reúne candidatos, vacantes y trabajo en equipo en una experiencia más clara para aplicar, contratar y dar seguimiento sin tantas vueltas.',
  },
  {
    question: '¿Pueden participar candidatos y empresas en la misma plataforma?',
    answer:
      'Sí. El producto está pensado para que el talento y los equipos trabajen en el mismo ecosistema con recorridos claros para cada tipo de usuario.',
  },
  {
    question: '¿Qué pasa si más adelante quiero sumar a mi empresa?',
    answer:
      'Puedes empezar con tu cuenta personal y después pedir acceso para tu empresa cuando quieras abrir vacantes y trabajar con tu equipo.',
  },
  {
    question: '¿Puedo usarla cómodamente desde el teléfono?',
    answer:
      'Sí. La experiencia está pensada para que descubrir vacantes, revisar perfiles y mover procesos se sienta natural también en móvil.',
  },
  {
    question: '¿La sección de donación o sponsorship ya procesa pagos?',
    answer:
      'Todavía no. Esa superficie ya está visible para validar la experiencia comercial, pero el procesamiento de pagos sigue desactivado por ahora.',
  },
] as const;

function renderTierValue(value: boolean | string, highlighted: boolean) {
  if (typeof value === 'string') {
    return (
      <span
        className={cn(
          'text-sm font-semibold',
          highlighted
            ? 'text-primary-700 dark:text-primary-200'
            : 'text-(--app-text)'
        )}
      >
        {value}
      </span>
    );
  }

  return value ? (
    <>
      <Check className="mx-auto size-5 text-primary-600 dark:text-primary-300" />
      <span className="sr-only">Incluido</span>
    </>
  ) : (
    <>
      <X className="mx-auto size-5 text-(--app-text-subtle)" />
      <span className="sr-only">No incluido</span>
    </>
  );
}

function HeroCollage({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null;
}) {
  return (
    <div className="relative mt-5 overflow-hidden rounded-card-lg px-1 pb-2 pt-2">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 hidden h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(159,182,255,0.44)_0%,rgba(159,182,255,0.16)_42%,transparent_72%)] blur-3xl md:block"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scale: [0.94, 1.05, 0.98, 0.94],
                opacity: [0.46, 0.68, 0.52, 0.46],
              }
        }
        transition={{
          duration: 8.5,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      />

      <motion.div className="absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 sm:block">
        <motion.div
          className="rounded-full border bg-white/92 px-4 py-2 text-xs font-semibold text-(--app-text) shadow-(--app-shadow-card) backdrop-blur dark:bg-(--app-surface)/92"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  y: [0, -8, 0, 6, 0],
                  rotate: [0, -1.1, 0, 0.8, 0],
                }
          }
          transition={{
            duration: 8.2,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
          whileHover={
            shouldReduceMotion
              ? undefined
              : {
                  scale: 1.03,
                  y: -10,
                  boxShadow: '0 20px 42px rgba(25, 42, 86, 0.16)',
                }
          }
        >
          Publica, evalúa y decide sin perder contexto
        </motion.div>
      </motion.div>

      <div className="flex justify-center gap-2 sm:gap-4 lg:gap-6">
        {heroGalleryColumns.map((column, columnIndex) => (
          <motion.div
            key={`hero-gallery-column-${columnIndex + 1}`}
            className={cn(
              'flex-none space-y-3 sm:space-y-4',
              column.widthClassName,
              column.offsetClassName
            )}
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    y:
                      columnIndex === 0
                        ? [0, -9, 0, 7, 0]
                        : columnIndex === 1
                        ? [0, 10, 0, -8, 0]
                        : [0, -7, 0, 8, 0],
                  }
            }
            transition={{
              duration: columnIndex === 1 ? 9.8 : 8.8 + columnIndex,
              ease: 'easeInOut',
              repeat: Infinity,
              delay: columnIndex * 0.35,
            }}
          >
            {column.items.map((item) => (
              <motion.div
                key={item.src}
                className={cn(
                  'relative overflow-hidden rounded-card-lg',
                  item.className
                )}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: 1.035,
                        y: -8,
                        rotate: columnIndex === 1 ? -0.75 : 0.75,
                      }
                }
                transition={{
                  type: 'spring',
                  stiffness: 220,
                  damping: 18,
                }}
              >
                <img
                  alt={item.alt}
                  className="h-full w-full object-cover"
                  src={item.src}
                />
                <div className="pointer-events-none absolute inset-0 rounded-card-lg ring-1 ring-black/6 ring-inset dark:ring-white/10" />
              </motion.div>
            ))}
          </motion.div>
        ))}
      </div>

      <motion.div className="absolute left-0 top-24 hidden md:block">
        <motion.div
          className="rounded-card border bg-white/90 px-4 py-3 shadow-(--app-shadow-card) backdrop-blur dark:bg-(--app-surface)/90"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  y: [0, 7, 0, -9, 0],
                  rotate: [0, 0.5, 0, -1, 0],
                }
          }
          transition={{
            duration: 9.3,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: 0.4,
          }}
          whileHover={
            shouldReduceMotion
              ? undefined
              : {
                  scale: 1.035,
                  x: 4,
                  y: -12,
                  boxShadow: '0 24px 44px rgba(25, 42, 86, 0.18)',
                }
          }
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-(--app-text-subtle)">
            Pipeline claro
          </p>
          <p className="mt-1 text-sm font-semibold text-(--app-text)">
            Feedback y etapas visibles
          </p>
        </motion.div>
      </motion.div>

      <motion.div className="absolute right-0 top-28 hidden md:block">
        <motion.div
          className="rounded-card border bg-white/90 px-4 py-3 shadow-(--app-shadow-card) backdrop-blur dark:bg-(--app-surface)/90"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  y: [0, -8, 0, 8, 0],
                  rotate: [0, -0.8, 0, 0.6, 0],
                }
          }
          transition={{
            duration: 9.9,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: 0.9,
          }}
          whileHover={
            shouldReduceMotion
              ? undefined
              : {
                  scale: 1.035,
                  x: -4,
                  y: -12,
                  boxShadow: '0 24px 44px rgba(25, 42, 86, 0.18)',
                }
          }
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-(--app-text-subtle)">
            Marca cuidada
          </p>
          <p className="mt-1 text-sm font-semibold text-(--app-text)">
            Tus vacantes se presentan mejor
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StorefrontHero({
  onPricingClick,
  shouldReduceMotion,
}: {
  onPricingClick: () => void;
  shouldReduceMotion: boolean | null;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-(--app-canvas)">
      <LandingReveal
        className="mx-auto grid min-w-0 max-w-[1600px] gap-10 px-4 pb-18 pt-40 sm:px-6 sm:pt-44 min-[981px]:grid-cols-[minmax(0,1fr)_760px] min-[981px]:items-center min-[981px]:gap-[80px] min-[981px]:px-10 min-[981px]:pb-[104px] min-[981px]:pt-48"
        y={28}
      >
        <div className="min-w-0 max-w-[560px] min-[981px]:max-w-[600px]">
          <h1 className="text-[44px] leading-[1.02] font-bold tracking-[-0.03em] text-balance text-(--app-text) min-[981px]:text-[60px]">
            Vacantes, talento y selección{' '}
            <span className="text-[#2d52a8] dark:text-[#7c9cf0]">en un solo lugar.</span>
          </h1>

          <p className="mt-6 max-w-[500px] text-[17px] leading-[1.6] text-(--app-text-muted) min-[981px]:text-[18px]">
            Reúne vacantes, feedback y seguimiento en una sola experiencia, con
            más orden, más confianza y mejor colaboración al contratar.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              className="h-12 rounded-control border-transparent px-2 text-[15px] text-[#2d52a8] shadow-none hover:border-transparent hover:bg-transparent hover:text-[#21438e] hover:shadow-none dark:text-[#7c9cf0] dark:hover:text-[#9fb6f5] [&_svg]:transition-transform hover:[&_svg]:translate-x-[3px]"
              variant="ghost"
              onClick={onPricingClick}
            >
              Ver pricing
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="justify-self-center min-[981px]:justify-self-end">
          <HeroCollage shouldReduceMotion={shouldReduceMotion} />
        </div>
      </LandingReveal>
    </section>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const session = useAppSession();
  const shouldReduceMotion = useReducedMotion();
  const [billingFrequency, setBillingFrequency] =
    useState<BillingFrequency>('monthly');
  const [selectedPlanName, setSelectedPlanName] =
    useState<PricingPlanName>('Growth');
  const [isPricingComparisonOpen, setPricingComparisonOpen] = useState(false);
  const [openFaqQuestion, setOpenFaqQuestion] = useState<string | null>(
    faqs[0]?.question ?? null
  );
  const [profileFeature, jobsFeature, collaborationFeature] = featureCards;

  const primaryAction = session.isAuthenticated
    ? {
        label: session.permissions.includes('workspace:read')
          ? 'Abrir mi workspace'
          : 'Completar mi perfil',
        href: getAuthenticatedHomePath(
          session.permissions.includes('workspace:read')
        ),
        disabled: false,
      }
    : {
        label: PLATFORM_REGISTRATION_LOCKED ? 'Registro cerrado' : 'Crear cuenta',
        href: surfacePaths.auth.signUp,
        disabled: PLATFORM_REGISTRATION_LOCKED,
      };

  function togglePricingComparison() {
    setPricingComparisonOpen((current) => !current);
  }

  return (
    <div className="overflow-hidden bg-(--app-canvas)">
      <StorefrontHero
        shouldReduceMotion={shouldReduceMotion}
        onPricingClick={() => void navigate(surfacePaths.institutional.membershipCategories)}
      />

      <section
        className="tm-landing-section bg-(--app-canvas)"
        id="features"
      >
        <div className="mx-auto max-w-392 px-4 sm:px-6 lg:px-8">
          <LandingReveal
            className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end sm:gap-10"
            y={24}
          >
            <div className="max-w-160">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2d52a8] dark:text-primary-300">
                En cualquier lugar
              </span>
              <h2 className="mt-3 text-[26px] font-bold leading-[1.12] tracking-[-0.03em] text-balance text-(--app-text) sm:text-3xl">
                Lleva tu proceso de talento en el bolsillo
              </h2>
              <p className="mt-3 max-w-[52ch] text-base leading-[1.55] text-(--app-text-muted)">
                Revisa perfiles, comparte feedback y mueve decisiones desde el
                teléfono, con la misma claridad del escritorio.
              </p>
            </div>

            <Button
              className="h-12 shrink-0 rounded-control border-[#2d52a8] bg-[#2d52a8] px-[22px] text-[15px] shadow-[0_1px_2px_rgba(45,82,168,0.24),0_10px_24px_rgba(45,82,168,0.18)] hover:border-[#21438e] hover:bg-[#21438e] [&_svg]:transition-transform hover:[&_svg]:translate-x-[3px]"
              disabled={primaryAction.disabled}
              title={
                primaryAction.disabled
                  ? PLATFORM_REGISTRATION_LOCKED_MESSAGE
                  : undefined
              }
              onClick={() => void navigate(primaryAction.href)}
            >
              Entrar a la aplicación
              <ArrowRight className="size-4" />
            </Button>
          </LandingReveal>

          <div className="mt-8 grid grid-cols-1 gap-4 min-[681px]:grid-cols-2 min-[961px]:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)]">
            {/* Showcase del teléfono */}
            <LandingReveal
              className="flex justify-center overflow-hidden rounded-card border bg-(--app-surface-muted) px-5 pt-8 min-[681px]:col-span-2 min-[961px]:col-span-1 min-[961px]:row-span-2 min-[961px]:items-end"
              y={24}
            >
              <div className="w-[232px] rounded-t-[2rem] bg-[#0c1730] px-2 pt-2">
                <div className="rounded-t-[1.5625rem] bg-[#0f1c33] px-[13px] pt-[15px] text-white">
                  <div className="mx-auto mb-4 h-1 w-[68px] rounded-full bg-white/16" />

                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-control bg-white/8 text-[#cbd6ee]">
                      <Layers3 className="size-[15px]" />
                    </div>
                    <p className="text-[11.5px] font-semibold leading-[1.15] text-[#eaf0fb]">
                      App de
                      <br />
                      oportunidades
                    </p>
                    <ArrowRight className="ml-auto size-[15px] text-[#7f8db0]" />
                  </div>

                  <div className="mb-3 flex items-center gap-[7px] rounded-[9px] bg-white/6 px-[10px] py-2 text-[11px] text-[#8290b2]">
                    <Search className="size-[13px]" />
                    Buscar talento o vacantes
                  </div>

                  <div className="mb-[13px] flex flex-wrap gap-[5px]">
                    {mobileWorkspaceSteps.map((step, index) => (
                      <span
                        key={step}
                        className={cn(
                          'rounded-[7px] px-[10px] py-[5px] text-[11px] font-semibold',
                          index === 1
                            ? 'bg-[#2d52a8] text-white'
                            : 'bg-white/[0.055] text-[#a9b5d2]'
                        )}
                      >
                        {step}
                      </span>
                    ))}
                  </div>

                  <div className="pb-4">
                    {mobileWorkspaceItems.map((item) => (
                      <div
                        key={item.title}
                        className="mb-[9px] rounded-[11px] bg-white/[0.045] px-3 py-[11px] last:mb-0"
                      >
                        <div className="flex items-start gap-[9px]">
                          <p className="text-[12.5px] font-bold leading-[1.2] text-[#f0f4fc]">
                            {item.title}
                          </p>
                          <span
                            className={cn(
                              'ml-auto whitespace-nowrap rounded-[6px] px-2 py-[3px] text-[9.5px] font-semibold',
                              item.tone === 'ok'
                                ? 'bg-[rgba(31,157,97,0.2)] text-[#7fe3ac]'
                                : 'bg-white/8 text-[#b9c4de]'
                            )}
                          >
                            {item.state}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[10px] text-[#7f8db0]">
                          {item.meta}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </LandingReveal>

            {/* Perfil que ahorra tiempo */}
            <LandingInteractiveSurface
              className="flex flex-col rounded-card border bg-(--app-surface) p-4"
              delay={0.04}
              hoverShadow="0 24px 56px rgba(18, 31, 68, 0.12)"
            >
              <div className="flex flex-1 flex-col justify-center rounded-[11px] border bg-(--app-surface-muted) p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-[#2d52a8] text-xs font-bold text-white">
                    MR
                  </div>
                  <div>
                    <p className="text-[12.5px] font-bold leading-[1.2] text-(--app-text)">
                      María Rendón
                    </p>
                    <p className="mt-0.5 text-[11px] text-(--app-text-subtle)">
                      Product Designer
                    </p>
                  </div>
                </div>

                {['Experiencia', 'Portafolio'].map((field) => (
                  <div
                    key={field}
                    className="mt-2 flex items-center gap-[9px] rounded-control border bg-(--app-surface) px-[11px] py-2 text-[11.5px] font-semibold text-(--app-text-muted) first-of-type:mt-3"
                  >
                    <Check className="size-3.5 shrink-0 text-[#1f9d61]" />
                    {field}
                    <span className="ml-auto text-[10px] font-bold text-[#1f9d61]">
                      Guardado
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-2 pb-1.5 pt-3.5">
                <h3 className="text-[17px] font-bold tracking-[-0.01em] text-(--app-text)">
                  {profileFeature.name}
                </h3>
                <p className="mt-2 text-sm leading-[1.55] text-(--app-text-muted)">
                  {profileFeature.description}
                </p>
              </div>
            </LandingInteractiveSurface>

            {/* Vacantes que invitan a aplicar */}
            <LandingInteractiveSurface
              className="flex flex-col rounded-card border bg-(--app-surface) p-4"
              delay={0.08}
              hoverShadow="0 24px 56px rgba(18, 31, 68, 0.12)"
            >
              <div className="flex flex-1 flex-col justify-center rounded-[11px] border bg-(--app-surface-muted) p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-[9px] bg-[#2d52a8] text-xs font-bold text-white">
                    A
                  </div>
                  <div className="flex-1">
                    <p className="text-[12.5px] font-bold leading-[1.2] text-(--app-text)">
                      Frontend Engineer
                    </p>
                    <p className="mt-0.5 text-[11px] text-(--app-text-subtle)">
                      Acme · Remoto
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-[6px] bg-[rgba(31,157,97,0.12)] px-[9px] py-[3px] text-[10px] font-bold text-[#1f9d61]">
                    Abierta
                  </span>
                </div>
                <p className="mt-[11px] text-[11px] leading-[1.5] text-(--app-text-muted)">
                  React, TypeScript y buen ojo para el detalle. Equipo de
                  producto en crecimiento.
                </p>
                <div className="mt-3 rounded-control bg-[#2d52a8] py-2 text-center text-[11px] font-bold text-white">
                  Aplicar ahora
                </div>
              </div>

              <div className="px-2 pb-1.5 pt-3.5">
                <h3 className="text-[17px] font-bold tracking-[-0.01em] text-(--app-text)">
                  {jobsFeature.name}
                </h3>
                <p className="mt-2 text-sm leading-[1.55] text-(--app-text-muted)">
                  {jobsFeature.description}
                </p>
              </div>
            </LandingInteractiveSurface>

            {/* Trabajo en equipo sin caos (ancha) */}
            <LandingInteractiveSurface
              className="grid grid-cols-1 items-center gap-6 rounded-card border bg-(--app-surface) p-[22px] min-[681px]:col-span-2 min-[961px]:grid-cols-[minmax(0,1fr)_320px]"
              delay={0.12}
              hoverShadow="0 26px 60px rgba(18, 31, 68, 0.14)"
            >
              <div>
                <h3 className="text-[17px] font-bold text-(--app-text)">
                  {collaborationFeature.name}
                </h3>
                <p className="mt-2 max-w-[48ch] text-sm leading-[1.55] text-(--app-text-muted)">
                  {collaborationFeature.description}
                </p>
              </div>

              <div className="rounded-[11px] border bg-(--app-surface-muted) p-3.5">
                {[
                  {
                    initials: 'JL',
                    name: 'Jorge L.',
                    message: 'Buen fit para el equipo, avancemos a entrevista.',
                    avatar: 'bg-[#2d52a8]',
                    tag: null,
                  },
                  {
                    initials: 'SP',
                    name: 'Sofía P.',
                    message: 'De acuerdo, coordino agenda.',
                    avatar: 'bg-[#1f9d61]',
                    tag: 'Siguiente paso',
                  },
                ].map((comment) => (
                  <div
                    key={comment.initials}
                    className="flex items-start gap-2.5 [&:not(:first-child)]:mt-[9px]"
                  >
                    <div
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
                        comment.avatar
                      )}
                    >
                      {comment.initials}
                    </div>
                    <div className="flex-1 rounded-[9px] border bg-(--app-surface) px-[11px] py-[9px]">
                      <p className="text-[10.5px] font-bold text-(--app-text)">
                        {comment.name}
                      </p>
                      <p className="mt-[3px] text-[11px] leading-[1.4] text-(--app-text-muted)">
                        {comment.message}
                      </p>
                      {comment.tag ? (
                        <span className="mt-[7px] inline-block whitespace-nowrap rounded-[6px] bg-[rgba(45,82,168,0.1)] px-[9px] py-[3px] text-[10px] font-bold text-[#2d52a8] dark:text-primary-300">
                          {comment.tag}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </LandingInteractiveSurface>
          </div>
        </div>
      </section>

      {SHOW_PRICING_SECTION ? (
        <section
          className="group/tiers relative isolate overflow-hidden"
          id="pricing"
        >
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
            `,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-90"
          style={{
            background: `
              linear-gradient(180deg, rgba(159, 182, 255, 0.16) 0%, rgba(159, 182, 255, 0.05) 16%, rgba(159, 182, 255, 0) 32%),
              linear-gradient(125deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 28%, rgba(43, 65, 143, 0.1) 62%, rgba(43, 65, 143, 0.22) 100%)
            `,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-64"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, rgba(159, 182, 255, 0.22), transparent 34%), linear-gradient(180deg, rgba(17, 30, 71, 0) 0%, rgba(17, 30, 71, 0.34) 100%)',
          }}
        />

        <div className="flow-root border-b border-b-transparent bg-transparent pt-14 pb-12 sm:pt-16 sm:pb-14 lg:pt-18 lg:pb-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <LandingReveal className="relative z-10" y={26}>
              <h2 className="mx-auto max-w-4xl text-center text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
                Planes claros para empezar, crecer y acompañar tu proceso de
                contratación
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-center text-base font-medium leading-8 text-white/72 sm:text-lg">
                Precios visibles, comparación fácil de entender y una propuesta
                comercial lista para enseñar desde ya.
              </p>

              <div className="mt-8 flex justify-center">
                <fieldset aria-label="Frecuencia de pago">
                  <div className="relative grid grid-cols-2 gap-x-1 rounded-full bg-white/8 p-1 text-center text-xs font-semibold text-white">
                    {billingFrequencies.map((frequency) => (
                      <label
                        key={frequency.value}
                        className={cn(
                          'relative cursor-pointer rounded-full px-3 py-2',
                          billingFrequency === frequency.value
                            ? 'text-white'
                            : 'text-white/72 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        {billingFrequency === frequency.value ? (
                          <motion.span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full bg-primary-500"
                            layoutId="billing-frequency-pill"
                            transition={landingHoverSpring}
                          />
                        ) : null}
                        <input
                          checked={billingFrequency === frequency.value}
                          className="sr-only"
                          name="billing-frequency"
                          type="radio"
                          value={frequency.value}
                          onChange={() => setBillingFrequency(frequency.value)}
                        />
                        <span className="relative z-10">{frequency.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </LandingReveal>

            <div className="relative z-10 mx-auto mt-8 grid max-w-md grid-cols-1 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-6">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-40 hidden h-72 rounded-full blur-3xl lg:block"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(57, 85, 184, 0.24), transparent 54%), radial-gradient(circle at 78% 42%, rgba(111, 142, 244, 0.2), transparent 48%)',
                }}
              />

              {pricingPlans.map((plan) => {
                const isSelected = selectedPlanName === plan.name;

                return (
                  <LandingReveal
                    key={plan.name}
                    amount={0.12}
                    delay={0.04}
                    y={26}
                  >
                    <motion.div
                      key={plan.name}
                      className={cn(
                        'relative cursor-pointer rounded-card-lg border p-8 xl:p-10',
                        isSelected
                          ? 'z-20 border-primary-200/80 bg-white ring-1 ring-primary-300 dark:border-primary-300/40 dark:bg-[linear-gradient(180deg,rgba(245,248,255,0.98)_0%,rgba(232,240,255,0.96)_100%)]'
                          : 'border-white/10 bg-white/7 text-white backdrop-blur-md hover:border-white/18 hover:bg-white/10 dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10'
                      )}
                      animate={
                        shouldReduceMotion
                          ? undefined
                          : {
                              y: isSelected ? -18 : 0,
                              scale: isSelected ? 1.02 : 1,
                              boxShadow: isSelected
                                ? '0 38px 110px rgba(18, 31, 68, 0.28)'
                                : '0 20px 48px rgba(0, 0, 0, 0.22)',
                            }
                      }
                      transition={landingHoverSpring}
                      whileHover={
                        shouldReduceMotion
                          ? undefined
                          : isSelected
                          ? {
                              y: -20,
                              boxShadow: '0 42px 118px rgba(18, 31, 68, 0.32)',
                            }
                          : {
                              y: -8,
                              boxShadow: '0 28px 68px rgba(0, 0, 0, 0.28)',
                            }
                      }
                      onClick={() => setSelectedPlanName(plan.name)}
                    >
                      <motion.div
                        aria-hidden="true"
                        className={cn(
                          'pointer-events-none absolute inset-x-8 -bottom-5 h-8 rounded-full blur-2xl',
                          isSelected
                            ? 'bg-primary-500/30 opacity-100'
                            : 'opacity-0'
                        )}
                        animate={
                          shouldReduceMotion
                            ? undefined
                            : {
                                opacity: isSelected ? 1 : 0,
                                scale: isSelected ? 1 : 0.8,
                              }
                        }
                        transition={landingHoverSpring}
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
                        <p
                          className={cn(
                            'text-sm',
                            isSelected ? 'text-slate-500' : 'text-white/70'
                          )}
                        >
                          {billingFrequency === 'monthly'
                            ? 'Facturación mensual'
                            : 'Facturación anual'}
                        </p>
                      </div>

                      <h3
                        className={cn(
                          'mt-5 text-xl font-semibold',
                          isSelected ? 'text-slate-900' : 'text-white'
                        )}
                      >
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
                        <p
                          className={cn(
                            'pb-1 text-sm',
                            isSelected ? 'text-slate-500' : 'text-white/72'
                          )}
                        >
                          {plan.cadence[billingFrequency]}
                        </p>
                      </div>

                      <ul
                        className={cn(
                          'mt-8 space-y-3 border-t pt-6 text-sm leading-6',
                          isSelected
                            ? 'border-slate-200 text-slate-600'
                            : 'border-white/10 text-white/82'
                        )}
                        role="list"
                      >
                        {plan.highlights.map((highlight) => (
                          <li key={highlight} className="flex gap-3">
                            <Check
                              className={cn(
                                'mt-0.5 size-5 shrink-0',
                                isSelected
                                  ? 'text-primary-600'
                                  : 'text-primary-300'
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
                        disabled={plan.name === 'Starter'}
                        title={plan.name === 'Starter' ? PLATFORM_REGISTRATION_LOCKED_MESSAGE : undefined}
                        onClick={() =>
                          void navigate(
                            plan.name === 'Starter'
                              ? '/auth/sign-up'
                              : '/auth/sign-in'
                          )
                        }
                      >
                        {plan.cta}
                      </Button>
                    </motion.div>
                  </LandingReveal>
                );
              })}
            </div>

            <div className="relative z-10 mt-8">
              <LayoutGroup id="pricing-comparison-disclosure">
                <motion.div
                  layout
                  className="tm-landing-container overflow-visible"
                  transition={pricingComparisonLayoutTransition}
                >
                  <div className="flex justify-center">
                    <motion.div
                      layout
                      className={cn(
                        'relative flex w-full justify-center',
                        isPricingComparisonOpen
                          ? 'z-20 mb-[-0.9rem] sm:-mb-4'
                          : ''
                      )}
                      transition={pricingComparisonLayoutTransition}
                    >
                      <AnimatePresence>
                        {isPricingComparisonOpen ? (
                          <motion.div
                            aria-hidden="true"
                            className="pointer-events-none absolute left-1/2 top-full h-14 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.14)_42%,transparent_74%)] blur-2xl"
                            exit={
                              shouldReduceMotion
                                ? { opacity: 0 }
                                : { opacity: 0, scaleX: 0.72, y: -10 }
                            }
                            initial={
                              shouldReduceMotion
                                ? false
                                : { opacity: 0, scaleX: 0.72, y: -10 }
                            }
                            transition={{
                              duration: 0.32,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            animate={
                              shouldReduceMotion
                                ? { opacity: 0.6 }
                                : { opacity: 0.6, scaleX: 1, y: 0 }
                            }
                          />
                        ) : null}
                      </AnimatePresence>

                      <motion.button
                        layout
                        aria-controls="pricing-comparison-panel"
                        aria-expanded={isPricingComparisonOpen}
                        className={cn(
                          'relative inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 border px-5 pt-3 pb-2.5 text-sm font-semibold backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 sm:w-auto sm:min-w-[20rem]',
                          isPricingComparisonOpen
                            ? 'border-(--app-border) bg-(--app-surface) text-(--app-text) hover:border-(--app-border-strong) hover:text-primary-700 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--app-surface) dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(16,29,63,0.98)_0%,rgba(13,24,52,0.98)_100%)] dark:hover:text-primary-200'
                            : 'border-(--app-border) bg-white/94 text-[#15203b] hover:border-primary-200 hover:text-primary-700 focus-visible:ring-white/50 dark:border-white/10 dark:hover:text-primary-200'
                        )}
                        style={{
                          borderRadius: 'var(--radius-card-lg)',
                        }}
                        transition={pricingComparisonLayoutTransition}
                        type="button"
                        whileHover={
                          shouldReduceMotion
                            ? undefined
                            : isPricingComparisonOpen
                            ? {
                                y: 1,
                                boxShadow: '0 20px 42px rgba(25, 42, 86, 0.12)',
                              }
                            : {
                                y: -2,
                                boxShadow: '0 28px 68px rgba(12, 20, 44, 0.38)',
                              }
                        }
                        whileTap={
                          shouldReduceMotion ? undefined : { scale: 0.99 }
                        }
                        animate={
                          shouldReduceMotion
                            ? undefined
                            : {
                                boxShadow: isPricingComparisonOpen
                                  ? '0 16px 34px rgba(25, 42, 86, 0.1)'
                                  : '0 22px 60px rgba(12, 20, 44, 0.28)',
                                paddingLeft: isPricingComparisonOpen ? 24 : 20,
                                paddingRight: isPricingComparisonOpen ? 24 : 20,
                              }
                        }
                        onClick={togglePricingComparison}
                      >
                        <motion.span layout="position">
                          {isPricingComparisonOpen
                            ? 'Ocultar comparación'
                            : 'Comparar planes'}
                        </motion.span>
                        <motion.span
                          layout="position"
                          className="rounded-full bg-primary-50 px-2.5 py-1 text-[0.72rem] font-semibold text-primary-700"
                        >
                          {pricingSections.length} bloques
                        </motion.span>
                        <motion.span
                          layout="position"
                          animate={
                            shouldReduceMotion
                              ? undefined
                              : { rotate: isPricingComparisonOpen ? 180 : 0 }
                          }
                          className="flex size-8 items-center justify-center rounded-full bg-[#15203b] text-white shadow-[0_10px_22px_rgba(12,20,44,0.18)]"
                          transition={{
                            type: 'spring',
                            stiffness: 320,
                            damping: 26,
                            mass: 0.7,
                          }}
                        >
                          <ChevronDown className="size-4" />
                        </motion.span>
                      </motion.button>
                    </motion.div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isPricingComparisonOpen ? (
                      <motion.div
                        layout
                        className="overflow-visible pb-10 pt-2 sm:pb-12 sm:pt-3 lg:pb-14"
                        exit={
                          shouldReduceMotion
                            ? { opacity: 0, height: 0 }
                            : { opacity: 0, height: 0 }
                        }
                        initial={
                          shouldReduceMotion ? false : { opacity: 0, height: 0 }
                        }
                        key="pricing-comparison-panel"
                        transition={{
                          height: { duration: 0.48, ease: [0.22, 1, 0.36, 1] },
                          opacity: { duration: 0.22, ease: 'easeOut' },
                          layout: pricingComparisonLayoutTransition,
                        }}
                        animate={
                          shouldReduceMotion
                            ? { opacity: 1, height: 'auto' }
                            : { opacity: 1, height: 'auto' }
                        }
                      >
                        <motion.div
                          layout
                          variants={pricingComparisonPanelVariants}
                          animate="open"
                          className="origin-top overflow-hidden border border-(--app-border) bg-(--app-surface) backdrop-blur-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(16,29,63,0.98)_0%,rgba(13,24,52,0.99)_100%)]"
                          exit="closed"
                          id="pricing-comparison-panel"
                          initial={shouldReduceMotion ? false : 'closed'}
                          style={{
                            borderRadius: 'var(--radius-card-lg)',
                            boxShadow: '0 32px 84px rgba(18, 31, 68, 0.14)',
                          }}
                          transition={pricingComparisonLayoutTransition}
                        >
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(239,243,255,0.96)_0%,rgba(255,255,255,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(28,44,88,0.64)_0%,rgba(16,29,63,0)_100%)]"
                          />

                          <motion.div
                            className="relative"
                            variants={{
                              open: {
                                transition: {
                                  staggerChildren: 0.05,
                                  delayChildren: 0.06,
                                },
                              },
                              closed: {},
                            }}
                          >
                            <motion.div
                              className="border-b border-(--app-border) px-5 pt-7 pb-5 sm:px-8 sm:pt-8 sm:pb-6"
                              variants={pricingComparisonContentVariants}
                            >
                              <div className="text-left">
                                <p className="text-base font-semibold text-(--app-text)">
                                  Comparación completa de planes
                                </p>
                                <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
                                  Revisa publicación, colaboración y
                                  acompañamiento en una sola vista cuando
                                  necesites más detalle.
                                </p>
                              </div>
                            </motion.div>

                            <motion.div
                              className="tm-landing-container py-8 sm:py-10 lg:py-12"
                              variants={pricingComparisonContentVariants}
                            >
                              <section
                                aria-labelledby="mobile-pricing-comparison"
                                className="lg:hidden"
                              >
                                <h2
                                  className="sr-only"
                                  id="mobile-pricing-comparison"
                                >
                                  Comparacion de planes
                                </h2>

                                <div className="mx-auto max-w-2xl space-y-10 sm:space-y-12">
                                  {pricingPlans.map((plan) => {
                                    const isSelected =
                                      selectedPlanName === plan.name;

                                    return (
                                      <div
                                        key={plan.name}
                                        className="border-t border-(--app-border) pt-10"
                                      >
                                        <div
                                          className={cn(
                                            '-mt-px w-72 border-t-2 pt-8 md:w-80',
                                            isSelected
                                              ? 'border-primary-500'
                                              : 'border-transparent'
                                          )}
                                        >
                                          <h3
                                            className={cn(
                                              'text-sm font-semibold',
                                              isSelected
                                                ? 'text-primary-700 dark:text-primary-200'
                                                : 'text-(--app-text)'
                                            )}
                                          >
                                            {plan.name}
                                          </h3>
                                          <p className="mt-1 text-sm leading-6 text-(--app-text-muted)">
                                            {plan.description}
                                          </p>
                                        </div>

                                        <div className="mt-6 space-y-6">
                                          {pricingSections.map((section) => (
                                            <div key={section.name}>
                                              <h4 className="text-sm font-semibold text-(--app-text)">
                                                {section.name}
                                              </h4>
                                              <div className="mt-5 rounded-card-lg border bg-(--app-surface) shadow-(--app-shadow-card)">
                                                <dl className="divide-y text-sm leading-6">
                                                  {section.features.map(
                                                    (feature) => (
                                                      <div
                                                        key={feature.name}
                                                        className="flex items-center justify-between gap-4 px-4 py-3"
                                                      >
                                                        <dt className="pr-4 text-(--app-text-muted)">
                                                          {feature.name}
                                                        </dt>
                                                        <dd className="flex min-w-20 items-center justify-end">
                                                          {renderTierValue(
                                                            feature.tiers[
                                                              plan.name
                                                            ],
                                                            isSelected
                                                          )}
                                                        </dd>
                                                      </div>
                                                    )
                                                  )}
                                                </dl>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>

                              <section
                                aria-labelledby="desktop-pricing-comparison"
                                className="hidden lg:block"
                              >
                                <h2
                                  className="sr-only"
                                  id="desktop-pricing-comparison"
                                >
                                  Comparacion de planes
                                </h2>

                                <div className="grid grid-cols-4 gap-x-8 border-t border-(--app-border) before:block">
                                  {pricingPlans.map((plan) => {
                                    const isSelected =
                                      selectedPlanName === plan.name;

                                    return (
                                      <div
                                        key={plan.name}
                                        aria-hidden="true"
                                        className="-mt-px"
                                      >
                                        <div
                                          className={cn(
                                            'border-t-2 pt-10',
                                            isSelected
                                              ? 'border-primary-500'
                                              : 'border-transparent'
                                          )}
                                        >
                                          <p
                                            className={cn(
                                              'text-sm font-semibold',
                                              isSelected
                                                ? 'text-primary-700 dark:text-primary-200'
                                                : 'text-(--app-text)'
                                            )}
                                          >
                                            {plan.name}
                                          </p>
                                          <p className="mt-1 text-sm leading-6 text-(--app-text-muted)">
                                            {plan.description}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="-mt-4 space-y-10 sm:space-y-12">
                                  {pricingSections.map((section) => (
                                    <div key={section.name}>
                                      <h3 className="text-sm font-semibold text-(--app-text)">
                                        {section.name}
                                      </h3>
                                      <div className="relative -mx-8 mt-8">
                                        <div
                                          aria-hidden="true"
                                          className="absolute inset-x-8 inset-y-0 grid grid-cols-4 gap-x-8 before:block"
                                        >
                                          <div className="rounded-card-lg bg-(--app-surface) shadow-(--app-shadow-card)" />
                                          <div className="rounded-card-lg bg-(--app-surface) shadow-(--app-shadow-card)" />
                                          <div className="rounded-card-lg bg-(--app-surface) shadow-(--app-shadow-card)" />
                                        </div>

                                        <table className="relative w-full border-separate border-spacing-x-8">
                                          <thead>
                                            <tr className="text-left">
                                              <th scope="col">
                                                <span className="sr-only">
                                                  Feature
                                                </span>
                                              </th>
                                              {pricingPlans.map((plan) => (
                                                <th key={plan.name} scope="col">
                                                  <span className="sr-only">
                                                    {plan.name}
                                                  </span>
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {section.features.map(
                                              (feature, featureIndex) => (
                                                <tr key={feature.name}>
                                                  <th
                                                    className="w-1/4 py-3 pr-4 text-left text-sm font-normal text-(--app-text)"
                                                    scope="row"
                                                  >
                                                    {feature.name}
                                                    {featureIndex !==
                                                    section.features.length -
                                                      1 ? (
                                                      <div className="absolute inset-x-8 mt-3 h-px bg-(--app-border)" />
                                                    ) : null}
                                                  </th>
                                                  {pricingPlans.map((plan) => {
                                                    const isSelected =
                                                      selectedPlanName ===
                                                      plan.name;

                                                    return (
                                                      <td
                                                        key={plan.name}
                                                        className="relative w-1/4 px-4 py-0 text-center"
                                                      >
                                                        <span className="relative inline-flex size-full items-center justify-center py-3">
                                                          {renderTierValue(
                                                            feature.tiers[
                                                              plan.name
                                                            ],
                                                            isSelected
                                                          )}
                                                        </span>
                                                      </td>
                                                    );
                                                  })}
                                                </tr>
                                              )
                                            )}
                                          </tbody>
                                        </table>

                                        <div
                                          aria-hidden="true"
                                          className="pointer-events-none absolute inset-x-8 inset-y-0 grid grid-cols-4 gap-x-8 before:block"
                                        >
                                          {pricingPlans.map((plan) => {
                                            const isSelected =
                                              selectedPlanName === plan.name;

                                            return (
                                              <motion.div
                                                key={plan.name}
                                                className={cn(
                                                  'rounded-card-lg',
                                                  isSelected
                                                    ? 'ring-2 ring-primary-500 shadow-[0_22px_48px_rgba(79,110,216,0.14)]'
                                                    : 'ring-1 ring-(--app-border)'
                                                )}
                                                animate={
                                                  shouldReduceMotion
                                                    ? undefined
                                                    : {
                                                        scale: isSelected
                                                          ? 1.01
                                                          : 1,
                                                        boxShadow: isSelected
                                                          ? '0 22px 48px rgba(79, 110, 216, 0.14)'
                                                          : '0 0 0 rgba(79, 110, 216, 0)',
                                                      }
                                                }
                                                transition={landingHoverSpring}
                                              />
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </section>

                              <div className="mt-10 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                                <div className="rounded-card-lg border bg-(--app-surface) p-6 shadow-(--app-shadow-card) sm:p-8">
                                  <div className="flex items-center gap-3">
                                    <div className="flex size-12 items-center justify-center rounded-card bg-(--app-info-surface)">
                                      <WalletCards className="size-5 text-primary-700 dark:text-primary-200" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-(--app-text)">
                                        Una propuesta fácil de explicar
                                      </p>
                                      <p className="text-sm text-(--app-text-muted)">
                                        El pricing ya acompaña demos,
                                        conversaciones de ventas y evaluaciones
                                        internas.
                                      </p>
                                    </div>
                                  </div>
                                  <p className="mt-5 text-sm leading-7 text-(--app-text-muted)">
                                    Los planes muestran de forma realista cómo
                                    crece la experiencia sin fingir que los
                                    cobros ya están activos. La superficie
                                    comercial existe; el procesamiento de pagos
                                    todavía no.
                                  </p>
                                </div>

                                <div className="rounded-card-lg border bg-(--app-warning-surface) p-6 shadow-(--app-shadow-card) sm:p-8">
                                  <div className="flex items-center gap-3">
                                    <div className="flex size-12 items-center justify-center rounded-card bg-white/80 shadow-(--app-shadow-card)">
                                      <HandHeart className="size-5 text-(--app-text)" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-(--app-text)">
                                        Donaciones y sponsorships
                                      </p>
                                      <p className="text-sm text-(--app-text-muted)">
                                        Superficie visible del roadmap comercial
                                      </p>
                                    </div>
                                  </div>
                                  <p className="mt-5 text-sm leading-7 text-(--app-text-muted)">
                                    Este espacio ya existe para validar la
                                    narrativa de apoyo al producto, pero el
                                    procesamiento de pagos permanece desactivado
                                    hasta conectar billing real.
                                  </p>
                                  <Button
                                    className="mt-6 w-full"
                                    disabled
                                    variant="outline"
                                  >
                                    Donaciones proximamente
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          </motion.div>
                        </motion.div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              </LayoutGroup>
            </div>
          </div>
        </div>
        </section>
      ) : null}

      <section className="tm-landing-section bg-(--app-canvas)" id="faq">
        <LandingReveal className="tm-landing-container" y={22}>
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-card bg-(--app-info-surface)">
                <CircleHelp className="size-5 text-primary-700 dark:text-primary-200" />
              </div>
              <Badge variant="outline">FAQ</Badge>
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-(--app-text) sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <dl className="mt-12 divide-y">
              {faqs.map((faq) => (
                <LandingReveal key={faq.question} amount={0.08} y={18}>
                  <div className="py-7 first:pt-0 last:pb-0 sm:py-8">
                    <motion.button
                      className="flex w-full cursor-pointer items-start justify-between gap-8 rounded-card-lg px-1 py-2 text-left text-(--app-text) hover:text-primary-700 dark:hover:text-primary-200 sm:py-3"
                      transition={landingHoverSpring}
                      type="button"
                      whileHover={shouldReduceMotion ? undefined : { x: 2 }}
                      onClick={() =>
                        setOpenFaqQuestion((currentQuestion) =>
                          currentQuestion === faq.question ? null : faq.question
                        )
                      }
                    >
                      <span className="text-base font-semibold leading-7">
                        {faq.question}
                      </span>
                      <motion.span
                        className="flex h-7 items-center"
                        animate={
                          shouldReduceMotion
                            ? undefined
                            : {
                                rotate:
                                  openFaqQuestion === faq.question ? 45 : 0,
                              }
                        }
                      >
                        <span className="flex size-7 items-center justify-center rounded-full border bg-(--app-surface) text-(--app-text-muted)">
                          +
                        </span>
                      </motion.span>
                    </motion.button>
                    <AnimatePresence initial={false}>
                      {openFaqQuestion === faq.question ? (
                        <motion.p
                          key={`${faq.question}-answer`}
                          className="max-w-3xl pr-8 pt-4 text-base leading-7 text-(--app-text-muted)"
                          exit={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, height: 0, y: -8 }
                          }
                          initial={
                            shouldReduceMotion
                              ? false
                              : { opacity: 0, height: 0, y: -8 }
                          }
                          transition={{ duration: 0.3, ease: landingSoftEase }}
                          animate={
                            shouldReduceMotion
                              ? { opacity: 1, height: 'auto' }
                              : { opacity: 1, height: 'auto', y: 0 }
                          }
                        >
                          {faq.answer}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </LandingReveal>
              ))}
            </dl>
          </div>
        </LandingReveal>
      </section>

      <InstitutionalFooter
        platformButton={{
          label: 'Página institucional',
          to: surfacePaths.institutional.home,
        }}
      />
    </div>
  );
}
