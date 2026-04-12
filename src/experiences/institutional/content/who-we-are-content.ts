import {
  BookOpenText,
  BriefcaseBusiness,
  Church,
  FileText,
  FolderOpen,
  Globe2,
  HeartHandshake,
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
  supportTitle: 'Una misma misión, vivida en comunidad',
  supportCopy:
    'Historia, servicio y colaboración se encuentran en una red que acompaña a la Iglesia y lleva el evangelio al trabajo cotidiano.',
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

export const whoWeAreHeroHighlights = [
  'Fe visible en la vida profesional',
  'Apoyo real a la misión global',
  'Comunidad adventista diversa y conectada',
] as const;

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
    icon: FolderOpen,
    fileLabel: 'ASI Brochure',
    url: 'https://asiministries.org/wp-content/uploads/ASI-Brochure.pdf',
  },
  {
    title: 'Plan estratégico',
    description:
      'Dirección de prioridades y metas que orientan el crecimiento y el servicio de la red.',
    icon: BookOpenText,
    fileLabel: 'ASI Strategic Plan',
    url: 'https://asiministries.org/wp-content/uploads/ASI-Strategic-Plan.pdf',
  },
  {
    title: 'Estatutos',
    description:
      'Marco institucional que ordena gobierno, membresía y funcionamiento de ASI.',
    icon: FileText,
    fileLabel: 'ASI Constitution and Bylaws',
    url: 'https://asiministries.org/wp-content/uploads/ASI-Constitution-and-Bylaws-2023_2023-08-02.pdf',
  },
] as const;

export const whoWeAreGlobalRegions = [
  {
    title: 'ASI Europa',
    summary:
      'Capítulos y páginas regionales para Europa y organizaciones nacionales asociadas.',
    links: [
      { label: 'ASI Europe', url: 'https://asi-europe.org' },
      { label: 'ASI Austria', url: 'https://www.asi-austria.at' },
      { label: 'ASI Bulgaria', url: 'https://www.asi-bg.org' },
      { label: 'ASI Czech Republic', url: 'https://www.asi-cs.cz' },
      { label: 'ASI Germany', url: 'https://www.asideutschland.de' },
      { label: 'ASI Hungary', url: 'http://www.asi-hungary.org' },
      { label: 'ASI Italy', url: 'https://asi-italia.it' },
      { label: 'ASI Poland', url: 'http://asi.org.pl' },
      { label: 'ASI Portugal', url: 'http://www.asiportugal.org' },
      { label: 'ASI Romania', url: 'http://asiromania.ro' },
      { label: 'ASI Scandinavia', url: 'https://www.asiscandinavia.org' },
      { label: 'ASI Spain', url: 'http://www.asi-spain.org' },
      { label: 'ASI Switzerland', url: 'http://www.asi-ch.org' },
      { label: 'ASI United Kingdom', url: 'http://asi-uk.asiministries.org' },
    ],
  },
  {
    title: 'ASI Inter-América',
    summary:
      'Referencia principal para países y territorios cubiertos por la región interamericana, incluida República Dominicana.',
    links: [
      { label: 'ASI Inter-America', url: 'https://asi.interamerica.org' },
      {
        label: 'República Dominicana e islas del Caribe vinculadas',
        url: 'https://asi.interamerica.org',
      },
      {
        label: 'Centroamérica y territorios asociados',
        url: 'https://asi.interamerica.org',
      },
    ],
  },
  {
    title: 'ASI Sudáfrica',
    summary:
      'Presencia regional para Sudáfrica y vínculo operativo usado en elegibilidad para territorios asociados del sur de África.',
    links: [
      { label: 'ASI South Africa', url: 'https://www.asisauministries.org.za' },
      {
        label: 'Southern Africa-Indian Ocean Division',
        url: 'http://www.sidadventist.org',
      },
    ],
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
