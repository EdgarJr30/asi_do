import {
  BookOpenText,
  BriefcaseBusiness,
  Church,
  FileText,
  Globe2,
  HeartHandshake,
  Landmark,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';

import { surfacePaths } from '@/app/router/surface-paths';

export const whoWeAreHeroContent = {
  eyebrow: 'Quiénes somos',
  titleLines: ['Compartiendo', 'el amor de Cristo', 'en el día a día'],
  heading:
    'ASI une empresas, profesionales y ministerios para vivir y extender una misión centrada en Cristo.',
  description:
    'Comprometidos con apoyar a la Iglesia Adventista del Séptimo Día, caminamos junto a personas de distintas vocaciones que desean servir con integridad, propósito y presencia misionera en cada espacio donde trabajan y viven.',
  primaryAction: {
    label: 'Conocer membership',
    to: surfacePaths.institutional.membership,
    variant: 'primary' as const,
  },
  secondaryAction: {
    label: 'Explorar proyectos',
    to: surfacePaths.institutional.projects,
    variant: 'secondary' as const,
  },
} as const;

export const whoWeAreHeroMedia = {
  image:
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80',
  imageAlt:
    'Profesionales y voluntarios compartiendo en una actividad comunitaria',
} as const;

export const whoWeAreHeroStats = [
  {
    value: '1904',
    label: 'Raíces históricas',
    description:
      'La historia que dio origen a ASI se remonta a Madison College, una institución adventista de sostén propio en Tennessee.',
  },
  {
    value: '1947',
    label: 'Nacimiento formal',
    description:
      'Las instituciones de sostén propio se unieron para formar la Association of Seventh-day Adventist Self-Supporting Institutions.',
  },
  {
    value: '1979',
    label: 'Nombre actual',
    description:
      'La organización adoptó Adventist-laymen’s Services & Industries para reflejar una membresía más amplia y diversa.',
  },
] as const;

export const whoWeAreAboutPoints = [
  {
    title: 'Vida centrada en Cristo',
    description:
      'La filosofía de ASI promueve una relación diaria con Dios que se expresa en decisiones, servicio y testimonio.',
    icon: Church,
  },
  {
    title: 'Apoyo a la misión global',
    description:
      'La red acompaña iniciativas de salud, educación, evangelismo, servicio comunitario, familia y proyectos especiales.',
    icon: HeartHandshake,
  },
  {
    title: 'Una comunidad diversa',
    description:
      'Empresarios, profesionales y ministerios de apoyo forman una sola familia adventista desde distintos campos de trabajo.',
    icon: UsersRound,
  },
] as const;

export const whoWeAreHistoryTimeline = [
  {
    year: '1904',
    title: 'Madison College',
    description:
      'E.A. Sutherland y Percy Magan establecieron cerca de Nashville una institución adventista de sostén propio que luego impulsó escuelas y entidades satélite en otros lugares.',
  },
  {
    year: '1947',
    title: 'Primer cuerpo asociativo',
    description:
      'Las instituciones de sostén propio se organizaron como la Association of Seventh-day Adventist Self-Supporting Institutions, con fuerte presencia educativa y de salud.',
  },
  {
    year: '1979',
    title: 'ASI se amplía',
    description:
      'La membresía comenzó a incluir negocios, emprendedores y profesionales adventistas, y el nombre evolucionó para reflejar esa realidad.',
  },
] as const;

export const whoWeAreMissionValues = [
  {
    title: 'Desafiar',
    description:
      'ASI existe para retar a los laicos adventistas a vivir una fe visible y activa en profesiones, industria, educación y servicios.',
    icon: Sparkles,
  },
  {
    title: 'Nutrir',
    description:
      'La comunidad crea espacios de acompañamiento, visión y crecimiento para sostener una vida profesional arraigada en Cristo.',
    icon: HeartHandshake,
  },
  {
    title: 'Compartir a Cristo en el mercado',
    description:
      'Nuestro lema resume una misión sencilla y exigente: testificar de Jesús en el trabajo cotidiano y en cada relación humana.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Respaldar la misión mundial',
    description:
      'Todo esto se conecta con el compromiso de apoyar la misión global de la Iglesia Adventista del Séptimo Día.',
    icon: Globe2,
  },
] as const;

export const whoWeAreResources = [
  {
    title: 'Folleto ASI',
    description:
      'Resumen institucional para comprender identidad, propósito y alcance de la organización.',
    icon: BookOpenText,
  },
  {
    title: 'Plan estratégico',
    description:
      'Dirección de prioridades y metas que orientan el crecimiento y el servicio de la red.',
    icon: Landmark,
  },
  {
    title: 'Estatutos',
    description:
      'Marco institucional que ordena gobierno, membresía y funcionamiento de ASI.',
    icon: FileText,
  },
] as const;

export const whoWeAreGlobalNetwork = [
  {
    title: 'ASI Europa',
    description:
      'Una red con capítulos y organizaciones en países como Austria, Bulgaria, República Checa, Alemania, Hungría, Italia, Polonia, Portugal, Rumanía, España, Suiza y Reino Unido.',
    tag: 'Europa',
  },
  {
    title: 'ASI Inter-América',
    description:
      'La visión también se articula en la División Interamericana, fortaleciendo conexiones regionales y proyectos alineados con la misión.',
    tag: 'Inter-América',
  },
  {
    title: 'ASI Sudáfrica',
    description:
      'Expresión local de la misma vocación: convenciones, comunidad y apoyo a iniciativas que nacen dentro y fuera del territorio.',
    tag: 'África',
  },
] as const;

export const whoWeAreTrustSignals = [
  {
    title: 'Base adventista clara',
    description:
      'ASI apoya a la Iglesia Adventista del Séptimo Día y a sus distintos frentes de alcance y servicio.',
    icon: ShieldCheck,
  },
  {
    title: 'Presencia global',
    description:
      'Miembros de Norteamérica participan en proyectos alrededor del mundo y otras divisiones cuentan con organizaciones ASI propias.',
    icon: Globe2,
  },
] as const;
