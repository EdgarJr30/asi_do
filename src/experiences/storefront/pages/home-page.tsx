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

const heroPoints = [
  {
    title: 'Un solo espacio',
    description: 'Vacantes, talento y feedback sin perseguir contexto.',
  },
  {
    title: 'Pipeline claro',
    description: 'Etapas y feedback visibles para todo el equipo.',
  },
  {
    title: 'Marca cuidada',
    description: 'Tus vacantes se presentan con más orden.',
  },
] as const;

const heroCollageImages = [
  {
    src: 'https://images.unsplash.com/photo-1485217988980-11786ced9454?auto=format&fit=crop&w=700&q=80',
    alt: 'Profesional evaluando candidatos desde una laptop',
    className: 'left-[182px] top-[92px] z-[3] h-[252px] w-[196px]',
    float: { y: [0, -8, 0, 6, 0], rotate: [0, -0.8, 0, 0.6, 0] },
    duration: 9.8,
  },
  {
    src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=700&q=80',
    alt: 'Equipo revisando etapas de selección frente a una pizarra',
    className: 'left-[22px] top-[176px] z-[1] h-[206px] w-[168px]',
    float: { y: [0, 7, 0, -7, 0], rotate: [0, 0.7, 0, -0.5, 0] },
    duration: 9.2,
  },
  {
    src: 'https://images.unsplash.com/photo-1670272504528-790c24957dda?auto=format&fit=crop&w=700&q=80',
    alt: 'Personas conversando durante una evaluación colaborativa',
    className: 'left-[372px] top-[18px] z-[1] h-[210px] w-[168px]',
    float: { y: [0, -7, 0, 8, 0], rotate: [0, -0.6, 0, 0.5, 0] },
    duration: 10.4,
  },
  {
    src: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=700&q=80',
    alt: 'Equipo colaborando en una oficina abierta',
    className: 'left-[196px] top-[354px] z-[2] h-[256px] w-[200px]',
    float: { y: [0, 8, 0, -6, 0], rotate: [0, 0.5, 0, -0.7, 0] },
    duration: 10,
  },
] as const;

const featureCards = [
  {
    name: 'Perfil que ahorra tiempo',
    description:
      'Cada persona guarda su información una sola vez y la usa para aplicar con más confianza y menos fricción.',
    icon: FileText,
  },
  {
    name: 'Vacantes que invitan a aplicar',
    description:
      'Publica roles con una presentación más clara para que el talento entienda rápido la oportunidad y quiera seguir.',
    icon: Building2,
  },
  {
    name: 'Trabajo en equipo sin caos',
    description:
      'El equipo comparte comentarios, contexto y próximos pasos sin depender de mensajes sueltos o hojas paralelas.',
    icon: Workflow,
  },
  {
    name: 'Una experiencia lista para crecer',
    description:
      'La plataforma está pensada para crecer con candidatos, empresas y equipos sin perder claridad en el camino.',
    icon: ShieldCheck,
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
  },
  {
    title: 'Frontend Engineer',
    meta: 'Santo Domingo · Feedback listo',
    state: 'Siguiente paso',
  },
] as const;

const valueBentoCards = [
  {
    title: 'Atracción que convierte',
    body: 'Muestra tus vacantes de forma clara y dale al talento un camino rápido para aplicar.',
    icon: BriefcaseBusiness,
    image:
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'Equipo revisando una estrategia de trabajo en una oficina',
  },
  {
    title: 'Equipo alineado',
    body: 'Coordinadores y líderes encuentran la misma información sin perseguir contexto por varios canales.',
    icon: Layers3,
    image:
      'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'Equipo colaborando en una oficina abierta',
  },
  {
    title: 'Seguimiento con ritmo',
    body: 'Cada oportunidad avanza con claridad para que nadie se quede preguntando qué sigue.',
    icon: HeartHandshake,
    image:
      'https://images.unsplash.com/photo-1485217988980-11786ced9454?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'Profesional trabajando desde una laptop con contexto claro',
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
    question: 'Qué hace diferente a ASI?',
    answer:
      'Reúne candidatos, vacantes y trabajo en equipo en una experiencia más clara para aplicar, contratar y dar seguimiento sin tantas vueltas.',
  },
  {
    question: 'Pueden participar candidatos y empresas en la misma plataforma?',
    answer:
      'Sí. El producto está pensado para que el talento y los equipos trabajen en el mismo ecosistema con recorridos claros para cada tipo de usuario.',
  },
  {
    question: 'Qué pasa si más adelante quiero sumar a mi empresa?',
    answer:
      'Puedes empezar con tu cuenta personal y después pedir acceso para tu empresa cuando quieras abrir vacantes y trabajar con tu equipo.',
  },
  {
    question: 'Puedo usarla cómodamente desde el teléfono?',
    answer:
      'Sí. La experiencia está pensada para que descubrir vacantes, revisar perfiles y mover procesos se sienta natural también en móvil.',
  },
  {
    question: 'La sección de donación o sponsorship ya procesa pagos?',
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
  const floatingCardMotion = shouldReduceMotion
    ? undefined
    : {
        y: [0, -8, 0, 7, 0],
        rotate: [0, -0.7, 0, 0.5, 0],
      };

  return (
    <div className="relative h-[410px] w-full max-w-[358px] min-[480px]:h-[500px] min-[480px]:max-w-[437px] min-[601px]:h-[640px] min-[601px]:max-w-[560px]">
      <motion.div
        className="relative h-[640px] w-[560px] origin-top-left scale-[0.64] min-[480px]:scale-[0.78] min-[601px]:scale-100"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.64, ease: landingSoftEase, delay: 0.08 }}
      >
        {heroCollageImages.map((item, index) => (
          <motion.div
            key={item.src}
            className={cn(
              'absolute overflow-hidden rounded-card bg-white shadow-[0_1px_2px_rgba(20,40,90,0.05),0_20px_45px_-18px_rgba(20,40,90,0.28)]',
              item.className
            )}
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    y: [...item.float.y],
                    rotate: [...item.float.rotate],
                  }
            }
            transition={{
              duration: item.duration,
              ease: 'easeInOut',
              repeat: Infinity,
              delay: index * 0.22,
            }}
            whileHover={
              shouldReduceMotion
                ? undefined
                : {
                    scale: 1.035,
                    y: -10,
                    boxShadow: '0 26px 54px rgba(20,40,90,0.2)',
                  }
            }
          >
            <img
              alt={item.alt}
              className="h-full w-full object-cover"
              loading={index === 0 ? 'eager' : 'lazy'}
              src={item.src}
            />
            <div className="pointer-events-none absolute inset-0 rounded-card ring-1 ring-black/5 ring-inset" />
          </motion.div>
        ))}

        <motion.div
          className="absolute left-[120px] top-[22px] z-[6] whitespace-nowrap rounded-card-lg bg-white px-[22px] py-[13px] text-[15px] font-medium text-[#16223c] shadow-[0_2px_6px_rgba(20,40,90,0.05),0_16px_40px_-12px_rgba(20,40,90,0.20)] ring-1 ring-[#e8ecf4]"
          animate={floatingCardMotion}
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
                  boxShadow: '0 22px 46px rgba(20,40,90,0.18)',
                }
          }
        >
          Publica, evalúa y decide sin perder contexto
        </motion.div>

        <motion.div
          className="absolute left-[-6px] top-[148px] z-[6] w-[236px] rounded-card bg-white px-5 py-4 shadow-[0_2px_6px_rgba(20,40,90,0.05),0_16px_40px_-12px_rgba(20,40,90,0.20)] ring-1 ring-[#e8ecf4]"
          animate={
            shouldReduceMotion
              ? undefined
              : { y: [0, 7, 0, -9, 0], rotate: [0, 0.5, 0, -0.7, 0] }
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
                  boxShadow: '0 24px 44px rgba(20,40,90,0.18)',
                }
          }
        >
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#98a2b8] uppercase">
            Pipeline claro
          </p>
          <p className="mt-1.5 text-[15.5px] leading-snug font-bold tracking-[-0.01em] text-[#16223c]">
            Feedback y etapas visibles
          </p>
        </motion.div>

        <motion.div
          className="absolute left-[292px] top-[236px] z-[6] w-[262px] rounded-card bg-white px-5 py-4 shadow-[0_2px_6px_rgba(20,40,90,0.05),0_16px_40px_-12px_rgba(20,40,90,0.20)] ring-1 ring-[#e8ecf4]"
          animate={
            shouldReduceMotion
              ? undefined
              : { y: [0, -8, 0, 8, 0], rotate: [0, -0.6, 0, 0.5, 0] }
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
                  boxShadow: '0 24px 44px rgba(20,40,90,0.18)',
                }
          }
        >
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#98a2b8] uppercase">
            Marca cuidada
          </p>
          <p className="mt-1.5 text-[15.5px] leading-snug font-bold tracking-[-0.01em] text-[#16223c]">
            Tus vacantes se presentan mejor
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StorefrontHero({
  onExploreJobs,
  onPricingClick,
  shouldReduceMotion,
}: {
  onExploreJobs: () => void;
  onPricingClick: () => void;
  shouldReduceMotion: boolean | null;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[#f6f8fc]">
      <LandingReveal
        className="mx-auto grid min-w-0 max-w-[1280px] gap-10 px-4 pb-18 pt-34 sm:px-6 sm:pt-38 min-[981px]:grid-cols-[minmax(0,1fr)_560px] min-[981px]:items-center min-[981px]:gap-[88px] min-[981px]:px-11 min-[981px]:pb-[104px] min-[981px]:pt-38"
        y={28}
      >
        <div className="min-w-0 max-w-[560px] min-[981px]:max-w-[520px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e8ecf4] bg-white py-1.5 pr-[13px] pl-2.5 text-[12px] font-semibold tracking-[0.01em] text-[#5a6987] shadow-[0_1px_2px_rgba(20,40,90,0.03)]">
            <span className="size-1.5 rounded-full bg-[#2d52a8]" />
            Workspace para equipos de selección
          </span>

          <h1 className="mt-7 text-[38px] leading-[1.06] font-bold tracking-[-0.028em] text-balance text-[#16223c] min-[981px]:text-[43px]">
            Vacantes, talento y selección{' '}
            <span className="block text-[#2d52a8]">en un solo lugar.</span>
          </h1>

          <p className="mt-[22px] max-w-[440px] text-[16.5px] leading-[1.62] text-[#5a6987]">
            Reúne vacantes, feedback y seguimiento en una sola experiencia, con
            más orden, más confianza y mejor colaboración al contratar.
          </p>

          <div className="mt-[30px] flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              className="h-12 rounded-control border-[#2d52a8] bg-[#2d52a8] px-5 text-[14.5px] shadow-[0_1px_2px_rgba(45,82,168,0.24),0_8px_20px_rgba(45,82,168,0.16)] hover:border-[#21438e] hover:bg-[#21438e]"
              onClick={onExploreJobs}
            >
              Explorar jobs
            </Button>
            <Button
              className="h-12 rounded-control border-transparent px-1 text-[14.5px] text-[#2d52a8] shadow-none hover:border-transparent hover:bg-transparent hover:text-[#21438e] hover:shadow-none [&_svg]:transition-transform hover:[&_svg]:translate-x-[3px]"
              variant="ghost"
              onClick={onPricingClick}
            >
              Ver pricing
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="mt-[18px] flex items-center gap-2 text-[13px] text-[#98a2b8]">
            <Check className="size-4 shrink-0 text-[#1f9d61]" />
            <span>
              Sin tarjeta de crédito ·{' '}
              <strong className="font-semibold text-[#5a6987]">
                Listo en minutos
              </strong>
            </span>
          </div>

          <div className="mt-[42px] grid gap-5 border-t border-[#e8ecf4] pt-7 sm:grid-cols-3 sm:gap-[30px]">
            {heroPoints.map((point) => (
              <div key={point.title} className="min-w-0">
                <p className="flex items-center gap-[7px] text-[13.5px] font-semibold text-[#16223c]">
                  <Check className="size-4 shrink-0 text-[#2d52a8]" />
                  {point.title}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-[1.45] text-[#98a2b8]">
                  {point.description}
                </p>
              </div>
            ))}
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
  const [profileFeature, jobsFeature, collaborationFeature, growthFeature] =
    featureCards;

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

  function scrollToSection(sectionId: string) {
    const section = document.getElementById(sectionId);
    section?.scrollIntoView({
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  function togglePricingComparison() {
    setPricingComparisonOpen((current) => !current);
  }

  return (
    <div className="overflow-hidden bg-(--app-canvas)">
      <StorefrontHero
        shouldReduceMotion={shouldReduceMotion}
        onExploreJobs={() => void navigate(surfacePaths.public.jobs)}
        onPricingClick={() => scrollToSection('pricing')}
      />

      <section className="tm-landing-section bg-(--app-canvas)" id="features">
        <LandingReveal
          className="mx-auto max-w-392 px-4 sm:px-6 lg:px-8"
          y={24}
        >
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-stretch">
            <div className="relative">
              <div className="absolute inset-0 rounded-card-lg bg-white/72 dark:bg-white/6" />
              <div className="relative flex h-full flex-col overflow-hidden rounded-card-lg border bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,249,255,0.92)_100%)] shadow-(--app-shadow-floating) backdrop-blur-sm dark:bg-[linear-gradient(180deg,rgba(18,29,58,0.92)_0%,rgba(12,21,42,0.88)_100%)]">
                <div className="px-6 pt-6 pb-2 sm:px-8 sm:pt-8">
                  <Badge variant="soft">Plataforma</Badge>
                  <h2 className="mt-5 max-w-[12ch] text-3xl font-semibold tracking-tight text-balance text-(--app-text) sm:text-4xl">
                    La plataforma también se siente bien en móvil
                  </h2>
                  <p className="mt-4 max-w-120 text-base leading-8 text-(--app-text-muted) sm:text-lg">
                    Revisa perfiles, comparte feedback y mueve decisiones desde
                    el teléfono con una vista clara y accionable.
                  </p>
                </div>

                <div className="relative mx-auto mt-4 w-full max-w-sm grow px-4 pb-0 sm:px-6">
                  <div className="absolute left-1/2 top-8 h-24 w-24 -translate-x-1/2 rounded-full bg-primary-300/18 blur-3xl" />
                  <div className="relative mx-auto max-w-73 rounded-card-lg bg-[linear-gradient(180deg,#eef3ff_0%,#d9e1f1_38%,#c6cfdf_100%)] p-[0.72rem] shadow-[0_32px_72px_rgba(20,35,72,0.18)] ring-1 ring-white/82 dark:bg-[linear-gradient(180deg,#858fa1_0%,#596376_20%,#222b38_58%,#111827_100%)] dark:ring-white/18">
                    <div className="rounded-card-lg bg-[linear-gradient(180deg,#101827_0%,#131f35_100%)] p-[0.48rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.28)]">
                      <div className="relative min-h-96 overflow-hidden rounded-card-lg bg-[linear-gradient(180deg,#111b31_0%,#172441_100%)] px-4 pb-4 pt-4 text-white ring-1 ring-white/7">
                        <div className="mx-auto h-5 w-24 rounded-full bg-black/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />
                        <div className="absolute left-[0.2rem] top-24 h-12 w-0.5 rounded-full bg-white/16" />
                        <div className="absolute right-[0.2rem] top-32 h-16 w-0.5 rounded-full bg-white/14" />
                        <div className="mt-4 flex items-center justify-between text-white/72">
                          <div
                            aria-hidden="true"
                            className="flex size-10 items-center justify-center rounded-card bg-white/8"
                          >
                            <Layers3 className="size-4" />
                          </div>
                          <div className="rounded-full bg-primary-400/16 px-3 py-1 text-xs font-semibold text-primary-100">
                            App de oportunidades
                          </div>
                          <div
                            aria-hidden="true"
                            className="flex size-10 items-center justify-center rounded-card bg-white/8"
                          >
                            <ArrowRight className="size-4" />
                          </div>
                        </div>

                        <div className="mt-4 rounded-card border border-white/8 bg-white/6 p-3 backdrop-blur">
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
                                index === 1
                                  ? 'bg-primary-500 text-white'
                                  : 'bg-white/8 text-white/72'
                              )}
                            >
                              {step}
                            </span>
                          ))}
                        </div>

                        <div className="mt-4 space-y-2.5">
                          {mobileWorkspaceItems.map((item, index) => (
                            <div
                              key={item.title}
                              className="rounded-card border border-white/8 bg-white/7 p-3.5 backdrop-blur"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {item.title}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-white/62">
                                    {item.meta}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    'rounded-full px-3 py-1 text-[0.68rem] font-semibold',
                                    index === 0 &&
                                      'bg-emerald-400/16 text-emerald-200',
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

                        <div className="absolute inset-x-4 bottom-4 rounded-card border border-white/8 bg-white/6 p-3 backdrop-blur">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                                Desde el teléfono
                              </p>
                              <p className="mt-1 text-sm font-semibold text-white">
                                Seguimiento claro y accionable
                              </p>
                            </div>
                            <div className="flex size-11 items-center justify-center rounded-card bg-primary-500">
                              <Smartphone className="size-5 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-card-lg shadow-(--app-shadow-card) outline outline-black/5 dark:outline-white/10" />
            </div>

            <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
              <LandingInteractiveSurface
                className="relative"
                delay={0.04}
                hoverShadow="0 24px 56px rgba(18, 31, 68, 0.12)"
              >
                <div className="absolute inset-0 rounded-card-lg bg-white/72 dark:bg-white/6" />
                <div className="relative flex h-full flex-col overflow-hidden rounded-card-lg border bg-(--app-surface)/92 p-5 shadow-(--app-shadow-card) backdrop-blur-sm sm:p-6">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-card bg-(--app-info-surface) shadow-(--app-shadow-card)">
                    <profileFeature.icon className="size-5 text-primary-700 dark:text-primary-200" />
                  </div>
                  <p className="text-xl font-semibold tracking-tight text-(--app-text)">
                    {profileFeature.name}
                  </p>
                  <p className="mt-3 text-base leading-7 text-(--app-text-muted)">
                    {profileFeature.description}
                  </p>
                  <div className="mt-5 rounded-card border bg-(--app-surface-muted)/88 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-card bg-primary-500 text-sm font-semibold text-white">
                        AP
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-(--app-text)">
                          Ana Pérez
                        </p>
                        <p className="text-xs text-(--app-text-muted)">
                          Perfil reutilizable listo para aplicar
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-card-lg shadow-(--app-shadow-card) outline-1 outline-black/5 dark:outline-white/10" />
              </LandingInteractiveSurface>

              <LandingInteractiveSurface
                className="relative"
                delay={0.08}
                hoverShadow="0 24px 56px rgba(18, 31, 68, 0.12)"
              >
                <div className="absolute inset-0 rounded-card-lg bg-white/72 dark:bg-white/6" />
                <div className="relative flex h-full flex-col overflow-hidden rounded-card-lg border bg-(--app-surface)/92 p-5 shadow-(--app-shadow-card) backdrop-blur-sm sm:p-6">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-card bg-(--app-info-surface) shadow-(--app-shadow-card)">
                    <jobsFeature.icon className="size-5 text-primary-700 dark:text-primary-200" />
                  </div>
                  <p className="text-xl font-semibold tracking-tight text-(--app-text)">
                    {jobsFeature.name}
                  </p>
                  <p className="mt-3 text-base leading-7 text-(--app-text-muted)">
                    {jobsFeature.description}
                  </p>
                  <div className="mt-5 rounded-card border bg-(--app-info-surface)/84 p-4">
                    <div className="rounded-card bg-(--app-surface) px-4 py-4 shadow-(--app-shadow-card)">
                      <p className="text-sm font-semibold text-(--app-text)">
                        Frontend Engineer
                      </p>
                      <div className="mt-3 rounded-full bg-primary-500 px-4 py-2 text-center text-sm font-semibold text-white">
                        Aplicar ahora
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-card-lg shadow-(--app-shadow-card) outline-1 outline-black/5 dark:outline-white/10" />
              </LandingInteractiveSurface>

              <LandingInteractiveSurface
                className="relative lg:col-span-2"
                delay={0.12}
                hoverShadow="0 26px 60px rgba(18, 31, 68, 0.14)"
              >
                <div className="absolute inset-0 rounded-card-lg bg-white/72 dark:bg-white/6" />
                <div className="relative flex h-full flex-col overflow-hidden rounded-card-lg border bg-(--app-surface)/92 p-5 shadow-(--app-shadow-card) backdrop-blur-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-4 flex size-12 items-center justify-center rounded-card bg-(--app-info-surface) shadow-(--app-shadow-card)">
                        <collaborationFeature.icon className="size-5 text-primary-700 dark:text-primary-200" />
                      </div>
                      <p className="text-xl font-semibold tracking-tight text-(--app-text)">
                        {collaborationFeature.name}
                      </p>
                      <p className="mt-3 max-w-152 text-base leading-7 text-(--app-text-muted)">
                        {collaborationFeature.description}
                      </p>
                    </div>

                    <div className="rounded-card border bg-(--app-success-surface)/78 px-4 py-3">
                      <p className="text-sm font-semibold text-(--app-text)">
                        {growthFeature.name}
                      </p>
                      <p className="mt-1 max-w-[24ch] text-sm leading-6 text-(--app-text-muted)">
                        {growthFeature.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      ['Coordinador', 'Perfil fuerte para entrevista'],
                      ['Revisor', 'Buen fit para el equipo'],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-card border bg-(--app-surface-muted)/88 p-4 shadow-(--app-shadow-card)"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--app-text-subtle)">
                          {label}
                        </p>
                        <p className="mt-2 text-base font-medium text-(--app-text)">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-card-lg shadow-(--app-shadow-card) outline-1 outline-black/5 dark:outline-white/10" />
              </LandingInteractiveSurface>
            </div>
          </div>
        </LandingReveal>
      </section>

      <section className="tm-landing-section-tight overflow-hidden">
        <div className="mx-auto max-w-392 px-4 sm:px-6 lg:px-8">
          <LandingReveal className="max-w-2xl text-left lg:max-w-2xl" y={24}>
            <Badge className="w-fit" variant="outline">
              Valor del producto
            </Badge>
            <h2 className="mt-5 max-w-[17ch] text-3xl font-semibold tracking-tight text-balance text-(--app-text) sm:text-4xl lg:max-w-[16ch]">
              Así se entiende mejor el producto
            </h2>
            <p className="mt-4 max-w-152 text-base leading-8 text-(--app-text-muted) sm:text-lg">
              Menos explicación abstracta y más escenas claras de cómo se ve
              publicar, colaborar y mover procesos en la plataforma.
            </p>
          </LandingReveal>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:gap-5 lg:grid-cols-6">
            <LandingInteractiveSurface
              className="relative lg:col-span-3"
              delay={0.02}
              hoverShadow="0 30px 68px rgba(18, 31, 68, 0.16)"
            >
              <div className="absolute inset-0 rounded-card-lg bg-white/70 dark:bg-white/6" />
              <div className="relative overflow-hidden rounded-card-lg border bg-(--app-surface)/94 shadow-(--app-shadow-floating) backdrop-blur-sm">
                <div className="relative h-72 overflow-hidden sm:h-80">
                  <img
                    alt="Equipo revisando una estrategia de contratación"
                    className="block h-full w-full object-cover"
                    src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1600&h=980&q=80"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[rgba(9,17,39,0.64)] via-[rgba(9,17,39,0.18)] to-transparent" />
                  <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-white/14 px-3 py-1 text-xs font-semibold text-white backdrop-blur sm:left-5 sm:top-5">
                    Publicación más clara
                  </div>
                  <div className="absolute inset-x-4 bottom-4 rounded-card-lg border border-white/18 bg-[rgba(12,21,42,0.72)] p-4 text-white shadow-(--app-shadow-floating) backdrop-blur sm:inset-x-5 sm:bottom-5">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/70">
                      Vacantes que convierten
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">
                      Más contexto desde el primer vistazo
                    </p>
                    <p className="mt-2 max-w-[34ch] text-sm leading-6 text-white/78">
                      Roles bien presentados, mensaje consistente y acceso
                      visible para aplicar sin fricción.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {['Remoto', 'Brief claro', 'Aplicación visible'].map(
                        (tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-white/14 bg-white/10 px-3 py-1 text-xs font-medium text-white/88"
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-card-lg shadow-(--app-shadow-card) outline-1 outline-black/5 dark:outline-white/10" />
            </LandingInteractiveSurface>

            <LandingInteractiveSurface
              className="relative lg:col-span-3"
              delay={0.06}
              hoverShadow="0 30px 68px rgba(18, 31, 68, 0.16)"
            >
              <div className="absolute inset-0 rounded-card-lg bg-white/70 dark:bg-white/6" />
              <div className="relative overflow-hidden rounded-card-lg border bg-(--app-surface)/94 shadow-(--app-shadow-floating) backdrop-blur-sm">
                <div className="relative h-72 overflow-hidden sm:h-80">
                  <img
                    alt="Equipo colaborando en una oficina moderna"
                    className="block h-full w-full object-cover"
                    src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1600&h=980&q=80"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[rgba(9,17,39,0.68)] via-[rgba(9,17,39,0.18)] to-transparent" />
                  <div className="absolute inset-x-4 top-4 rounded-card-lg border border-white/18 bg-[rgba(12,21,42,0.72)] p-4 text-white backdrop-blur sm:inset-x-5 sm:top-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/70">
                          Equipo alineado
                        </p>
                        <p className="mt-1 text-lg font-semibold tracking-tight">
                          Comentarios donde toca
                        </p>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        <span className="size-2 rounded-full bg-primary-300" />
                        <span className="size-2 rounded-full bg-secondary-300" />
                        <span className="size-2 rounded-full bg-peach-300" />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {[
                        'Feedback compartido',
                        'Decisión visible',
                        'Siguiente paso claro',
                      ].map((item) => (
                        <div
                          key={item}
                          className="rounded-card border border-white/12 bg-white/10 px-3 py-2 text-sm font-medium text-white/88"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4 rounded-card-lg border border-white/18 bg-[rgba(12,21,42,0.72)] p-4 text-white shadow-(--app-shadow-card) backdrop-blur sm:bottom-5 sm:right-5">
                    <p className="text-sm font-semibold">
                      Una sola conversación
                    </p>
                    <p className="mt-1 max-w-[20ch] text-sm leading-6 text-white/76">
                      Coordinadores y líderes avanzan sobre la misma información.
                    </p>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-card-lg shadow-(--app-shadow-card) outline-1 outline-black/5 dark:outline-white/10" />
            </LandingInteractiveSurface>

            {valueBentoCards.map((panel, panelIndex) => {
              const Icon = panel.icon;

              return (
                <LandingInteractiveSurface
                  key={panel.title}
                  className="relative lg:col-span-2"
                  delay={panelIndex * 0.05}
                  hoverShadow="0 24px 56px rgba(18, 31, 68, 0.14)"
                >
                  <div className="absolute inset-0 rounded-card-lg bg-white/70 dark:bg-white/6" />
                  <div className="relative flex h-full flex-col overflow-hidden rounded-card-lg border bg-(--app-surface)/94 shadow-(--app-shadow-card) backdrop-blur-sm">
                    <div className="relative h-52 overflow-hidden">
                      <img
                        alt={panel.alt}
                        className="block h-full w-full object-cover"
                        src={panel.image}
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-[rgba(9,17,39,0.58)] via-[rgba(9,17,39,0.1)] to-transparent" />
                      <div className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-card bg-white/84 shadow-(--app-shadow-card)">
                        <Icon className="size-5 text-primary-700 dark:text-primary-200" />
                      </div>
                    </div>
                    <div className="p-5 sm:p-6">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-(--app-text-subtle)">
                        {panelIndex === 0
                          ? 'Atracción'
                          : panelIndex === 1
                          ? 'Colaboración'
                          : 'Seguimiento'}
                      </p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight text-(--app-text)">
                        {panel.title}
                      </p>
                      <p className="mt-3 text-base leading-7 text-(--app-text-muted)">
                        {panel.body}
                      </p>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-card-lg shadow-(--app-shadow-card) outline-1 outline-black/5 dark:outline-white/10" />
                </LandingInteractiveSurface>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              className="hover:shadow-[0_24px_44px_rgba(43,69,143,0.34)]"
              disabled={primaryAction.disabled}
              title={primaryAction.disabled ? PLATFORM_REGISTRATION_LOCKED_MESSAGE : undefined}
              onClick={() => void navigate(primaryAction.href)}
            >
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

      <section className="tm-landing-section overflow-hidden">
        <LandingReveal className="tm-landing-container" y={24}>
          <div className="relative rounded-card-lg border bg-(--app-surface) px-6 py-8 shadow-(--app-shadow-floating) sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <div
              aria-hidden="true"
              className="absolute right-0 bottom-0 h-48 w-48 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle at center, rgba(57, 85, 184, 0.2), transparent 64%)',
              }}
            />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="max-w-2xl">
                <Badge variant="soft">Siguiente paso</Badge>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance text-(--app-text) sm:text-4xl">
                  Comparte la landing, empieza demos y abre procesos desde una
                  base que ya se siente premium
                </h2>
                <p className="mt-5 text-base leading-7 text-(--app-text-muted)">
                  Desde aquí puedes llevar usuarios a jobs, signup o al espacio
                  de trabajo sin sacrificar claridad ni mezclar herramientas
                  internas con la experiencia del cliente.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button
                  className="hover:shadow-[0_24px_44px_rgba(43,69,143,0.34)]"
                  disabled={primaryAction.disabled}
                  title={primaryAction.disabled ? PLATFORM_REGISTRATION_LOCKED_MESSAGE : undefined}
                  onClick={() => void navigate(primaryAction.href)}
                >
                  {primaryAction.label}
                </Button>
                <Button
                  className="hover:border-primary-400 hover:bg-white hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]"
                  variant="outline"
                  onClick={() => void navigate(surfacePaths.public.jobs)}
                >
                  Explorar jobs
                </Button>
              </div>
            </div>
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
