import type { LucideIcon } from 'lucide-react';
import {
  Church,
  CircleDollarSign,
  MonitorPlay,
  PhoneCall,
  UsersRound,
} from 'lucide-react';

import { surfacePaths } from '@/app/router/surface-paths';

export type InstitutionalAction = {
  label: string;
  to: string;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export type InstitutionalLeadContent = {
  eyebrow?: string;
  title: string;
  description: string;
};

export type InstitutionalTone = 'plain' | 'muted' | 'brand';

export type InstitutionalHeroCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  meta?: string;
};

export type InstitutionalFeatureItem = {
  title: string;
  description: string;
  icon?: LucideIcon;
  image?: string;
  imageAlt?: string;
  meta?: string;
};

export type InstitutionalMediaSlide = {
  title: string;
  description: string;
  image: string;
  mobileImage?: string;
  imageAlt: string;
  primaryAction: InstitutionalAction;
  secondaryAction: InstitutionalAction;
  contentMode?: 'default' | 'image-only';
};

export type InstitutionalStat = {
  label: string;
  value: string;
  description: string;
};

export type InstitutionalListItem = {
  title: string;
  description: string;
  meta?: string;
  tag?: string;
};

export type InstitutionalPerson = {
  name: string;
  role: string;
  description: string;
  image: string;
};

export type InstitutionalSection =
  | {
      type: 'feature-grid';
      tone?: InstitutionalTone;
      lead: InstitutionalLeadContent;
      items: InstitutionalFeatureItem[];
      columns?: 2 | 3 | 4;
    }
  | {
      type: 'stats';
      tone?: InstitutionalTone;
      lead: InstitutionalLeadContent;
      items: InstitutionalStat[];
    }
  | {
      type: 'split';
      tone?: InstitutionalTone;
      lead: InstitutionalLeadContent;
      image: string;
      imageAlt: string;
      bodyTitle: string;
      bodyCopy: string[];
      highlights: InstitutionalListItem[];
    }
  | {
      type: 'list';
      tone?: InstitutionalTone;
      lead: InstitutionalLeadContent;
      items: InstitutionalListItem[];
      columns?: 1 | 2;
    }
  | {
      type: 'people';
      tone?: InstitutionalTone;
      lead: InstitutionalLeadContent;
      items: InstitutionalPerson[];
    }
  | {
      type: 'stats-and-features';
      tone?: InstitutionalTone;
      statsLead: InstitutionalLeadContent;
      stats: InstitutionalStat[];
      featuresLead: InstitutionalLeadContent;
      features: InstitutionalFeatureItem[];
      featuresColumns?: 2 | 3 | 4;
    };

export type InstitutionalPageContent = {
  hero: InstitutionalLeadContent & {
    primaryAction: InstitutionalAction;
    secondaryAction: InstitutionalAction;
    aside: InstitutionalHeroCard[];
    image?: string;
    imageAlt?: string;
  };
  sections: InstitutionalSection[];
  cta?: {
    title: string;
    description: string;
    primaryAction: InstitutionalAction;
    secondaryAction: InstitutionalAction;
  };
};

export const institutionalNavigation = [
  { label: 'Inicio', to: surfacePaths.institutional.home },
  { label: 'Membresía', to: surfacePaths.institutional.membership },
  { label: 'Proyectos', to: surfacePaths.institutional.projects },
  { label: 'Contáctanos', to: surfacePaths.institutional.contactUs },
] as const;

export const homeHeroMetrics: InstitutionalStat[] = [
  {
    value: '25+',
    label: 'Años de servicio',
    description:
      'Construyendo una comunidad profesional orientada por la fe y la misión.',
  },
  {
    value: '300+',
    label: 'Aliados y miembros',
    description:
      'Profesionales, empresarios y voluntarios colaborando en una misma red.',
  },
] as const;

export const homeHeroSlides: InstitutionalMediaSlide[] = [
  {
    title: 'Convención ASI 2026',
    description: '',
    image: '/media/2026-asi-convention_desktop.webp',
    mobileImage: '/media/2026-asi-convention_movil.webp',
    imageAlt: 'Convención ASI 2026',
    primaryAction: {
      label: 'Únete ahora',
      to: surfacePaths.institutional.membership,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Nuestra misión',
      to: surfacePaths.institutional.whoWeAre,
      variant: 'secondary',
    },
    contentMode: 'image-only',
  },
] as const;

export const homeCarouselCards: InstitutionalFeatureItem[] = [
  {
    title: 'Testimonio de comunidad',
    description:
      '“Encontré una red de apoyo real para servir desde mi profesión con mayor claridad y compromiso.”',
    meta: 'Marlen Tejeda',
    image:
      'https://images.unsplash.com/photo-1760367120345-2b96c53de838?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=1200',
    imageAlt: 'Congregación cristiana reunida en oración',
  },
  {
    title: 'Servicio en acción',
    description:
      'Jornadas locales donde fe y acción práctica se encuentran para responder a necesidades concretas.',
    image:
      'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Equipo de voluntariado en acción',
  },
  {
    title: 'Mentoría y colaboración',
    description:
      'Conversaciones que conectan experiencia, propósito y misión para avanzar acompañados.',
    image:
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Personas conversando en una mesa de trabajo',
  },
  {
    title: 'Liderazgo con integridad',
    description:
      'Historias breves que muestran cómo la membresía se traduce en servicio, formación y alcance.',
    meta: 'Historias de fe y servicio',
    image:
      'https://images.unsplash.com/photo-1697218173427-6bd39e9599cc?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=1200',
    imageAlt: 'Grupo cristiano compartiendo un momento de oración',
  },
  {
    title: 'Adoración que une',
    description:
      'Celebraciones congregacionales que convierten cada encuentro en una experiencia de fe compartida y esperanza activa.',
    meta: 'Culto y comunidad',
    image:
      'https://images.unsplash.com/photo-1674566114911-cd9b71354d39?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=1200',
    imageAlt: 'Comunidad cristiana levantando las manos en adoración',
  },
] as const;

export const homeEcosystemCards: InstitutionalFeatureItem[] = [
  {
    title: 'Eventos & convenciones',
    description:
      'Espacios donde la adoración, la enseñanza bíblica y la visión misional se comparten con orden, claridad y participación de toda la red.',
    image:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Evento con luces cálidas y público',
  },
  {
    title: 'Programas',
    description:
      'Procesos de formación que integran fe, liderazgo y servicio para acompañar decisiones concretas en la vida profesional y familiar.',
    image:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Grupo de personas conversando y aprendiendo',
  },
  {
    title: 'Membresía',
    description:
      'Una comunidad de creyentes que se fortalece en oración, acompañamiento y compromiso con una presencia cristiana coherente en la sociedad.',
    image:
      'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80',
    imageAlt:
      'Profesionales compartiendo en un encuentro de comunidad cristiana',
    icon: Church,
  },
  {
    title: 'Comunidad',
    description:
      'Relaciones de apoyo mutuo, testimonios y recursos que ayudan a vivir el evangelio con cercanía, unidad y servicio visible.',
    image:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Comunidad reunida',
  },
] as const;

export const homeProgramShowcase: InstitutionalFeatureItem[] = [
  {
    title: 'Líderes de iniciativa',
    description:
      'Programas que acompañan visión, carácter y crecimiento organizacional.',
    image:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Líder conversando con otra persona',
  },
  {
    title: 'Liderazgo de fe',
    description:
      'Conversaciones, cohortes y experiencias para una influencia con integridad.',
    image:
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Reunión de liderazgo',
  },
  {
    title: 'Programas comunitarios',
    description:
      'Formación y servicio conectados con necesidades reales de la comunidad.',
    image:
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Voluntariado comunitario',
  },
] as const;

export const homeTestimonials: InstitutionalListItem[] = [
  {
    title:
      '“La comunidad me ayudó a ver mi profesión como una extensión de la misión.”',
    description:
      'Un testimonio de acompañamiento, mentoría y propósito vivido en comunidad.',
    meta: 'Honor Ortega',
  },
  {
    title:
      '“Encontramos un espacio para servir con orden, visión y gente que camina contigo.”',
    description:
      'Una historia sobre membresía, relaciones y proyectos con sentido.',
    meta: 'Aura Faña',
  },
  {
    title:
      '“Cada proyecto deja de sentirse aislado cuando entra en una red que lo sostiene.”',
    description: 'ASI como plataforma relacional, no solo informativa.',
    meta: 'Cesia Matos',
  },
] as const;

export const contactPoints: InstitutionalFeatureItem[] = [
  {
    title: 'Secretaría general',
    description:
      'Canal principal para orientación institucional, agenda y solicitudes generales.',
    icon: PhoneCall,
    meta: 'secretaria@asirdo.org · +1 809 555 0140',
  },
  {
    title: 'Membresía',
    description:
      'Acompañamiento para ingreso, activación y comunidad de miembros.',
    icon: UsersRound,
    meta: 'membership@asirdo.org',
  },
  {
    title: 'Proyectos y financiamiento',
    description:
      'Conversaciones sobre proyectos, alianzas y oportunidades de patrocinio.',
    icon: CircleDollarSign,
    meta: 'projects@asirdo.org',
  },
  {
    title: 'Multimedia y comunicaciones',
    description:
      'Solicitudes editoriales, cobertura, materiales y uso de marca.',
    icon: MonitorPlay,
    meta: 'media@asirdo.org',
  },
] as const;
