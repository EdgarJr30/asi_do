import type { LucideIcon } from 'lucide-react'
import {
  BadgeHelp,
  BookOpenText,
  BriefcaseBusiness,
  Building2,
  CalendarHeart,
  Church,
  CircleDollarSign,
  Globe2,
  HandCoins,
  HandHeart,
  HeartHandshake,
  Landmark,
  Megaphone,
  MonitorPlay,
  Newspaper,
  PhoneCall,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound
} from 'lucide-react'

import { surfacePaths } from '@/app/router/surface-paths'

export type InstitutionalAction = {
  label: string
  to: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

export type InstitutionalLeadContent = {
  eyebrow?: string
  title: string
  description: string
}

export type InstitutionalTone = 'plain' | 'muted' | 'brand'

export type InstitutionalHeroCard = {
  title: string
  description: string
  icon: LucideIcon
  meta?: string
}

export type InstitutionalFeatureItem = {
  title: string
  description: string
  icon?: LucideIcon
  image?: string
  imageAlt?: string
  meta?: string
}

export type InstitutionalMediaSlide = {
  title: string
  description: string
  image: string
  imageAlt: string
  primaryAction: InstitutionalAction
  secondaryAction: InstitutionalAction
  contentMode?: 'default' | 'image-only'
}

export type InstitutionalStat = {
  label: string
  value: string
  description: string
}

export type InstitutionalListItem = {
  title: string
  description: string
  meta?: string
  tag?: string
}

export type InstitutionalPerson = {
  name: string
  role: string
  description: string
  image: string
}

export type InstitutionalSection =
  | {
      type: 'feature-grid'
      tone?: InstitutionalTone
      lead: InstitutionalLeadContent
      items: InstitutionalFeatureItem[]
      columns?: 2 | 3 | 4
    }
  | {
      type: 'stats'
      tone?: InstitutionalTone
      lead: InstitutionalLeadContent
      items: InstitutionalStat[]
    }
  | {
      type: 'split'
      tone?: InstitutionalTone
      lead: InstitutionalLeadContent
      image: string
      imageAlt: string
      bodyTitle: string
      bodyCopy: string[]
      highlights: InstitutionalListItem[]
    }
  | {
      type: 'list'
      tone?: InstitutionalTone
      lead: InstitutionalLeadContent
      items: InstitutionalListItem[]
      columns?: 1 | 2
    }
  | {
      type: 'people'
      tone?: InstitutionalTone
      lead: InstitutionalLeadContent
      items: InstitutionalPerson[]
    }

export type InstitutionalPageContent = {
  hero: InstitutionalLeadContent & {
    primaryAction: InstitutionalAction
    secondaryAction: InstitutionalAction
    aside: InstitutionalHeroCard[]
  }
  sections: InstitutionalSection[]
  cta: {
    title: string
    description: string
    primaryAction: InstitutionalAction
    secondaryAction: InstitutionalAction
  }
}

export const institutionalNavigation = [
  { label: 'Inicio', to: surfacePaths.institutional.home },
  { label: 'Membresía', to: surfacePaths.institutional.membership },
  { label: 'Proyectos', to: surfacePaths.institutional.projects },
  { label: 'Noticias', to: surfacePaths.institutional.news },
  { label: 'Multimedia', to: surfacePaths.institutional.media },
  { label: 'Directorio', to: surfacePaths.institutional.directory },
  { label: 'Contáctanos', to: surfacePaths.institutional.contactUs }
] as const

export const homeHeroMetrics: InstitutionalStat[] = [
  {
    value: '25+',
    label: 'Años de servicio',
    description: 'Construyendo una comunidad profesional orientada por la fe y la misión.'
  },
  {
    value: '300+',
    label: 'Aliados y miembros',
    description: 'Profesionales, empresarios y voluntarios colaborando en una misma red.'
  }
] as const

export const homeHeroSlides: InstitutionalMediaSlide[] = [
  {
    title: 'Convención ASI 2026',
    description: '',
    image: '/media/2026-asi-convention.jpg',
    imageAlt: 'Convención ASI 2026',
    primaryAction: {
      label: 'Únete ahora',
      to: surfacePaths.institutional.membership,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Nuestra misión',
      to: surfacePaths.institutional.whoWeAre,
      variant: 'secondary'
    },
    contentMode: 'image-only'
  },
  {
    title: 'Fe en el mercado, servicio en la misión.',
    description: 'Uniendo a profesionales laicos para servir a la comunidad con integridad, propósito y visión compartida.',
    image:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80',
    imageAlt: 'Profesionales reunidos en oración y comunidad',
    primaryAction: {
      label: 'Únete ahora',
      to: surfacePaths.institutional.membership,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Nuestra misión',
      to: surfacePaths.institutional.whoWeAre,
      variant: 'secondary'
    }
  },
  {
    title: 'Proyectos que convierten visión en impacto visible.',
    description: 'Financiamos, acompañamos y contamos iniciativas que fortalecen iglesia, comunidad y liderazgo.',
    image:
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1600&q=80',
    imageAlt: 'Voluntariado comunitario empacando donaciones',
    primaryAction: {
      label: 'Explorar proyectos',
      to: surfacePaths.institutional.projects,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Financiamiento',
      to: surfacePaths.institutional.projectFunding,
      variant: 'secondary'
    }
  },
  {
    title: 'Eventos, membresía y comunidad en una sola voz institucional.',
    description: 'Una experiencia editorial diseñada para inspirar, informar y conectar a la red de ASI con elegancia.',
    image:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80',
    imageAlt: 'Convención con audiencia levantando las manos',
    primaryAction: {
      label: 'Ver noticias',
      to: surfacePaths.institutional.news,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Ir a multimedia',
      to: surfacePaths.institutional.media,
      variant: 'secondary'
    }
  }
] as const

export const homeCarouselCards: InstitutionalFeatureItem[] = [
  {
    title: 'Testimonio de comunidad',
    description: '“Encontré una red de apoyo real para servir desde mi profesión con mayor claridad y compromiso.”',
    meta: 'Marlen Tejeda',
    image:
      'https://images.unsplash.com/photo-1760367120345-2b96c53de838?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000',
    imageAlt: 'Congregación cristiana reunida en oración'
  },
  {
    title: 'Servicio en acción',
    description: 'Jornadas locales donde fe y acción práctica se encuentran para responder a necesidades concretas.',
    image:
      'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Equipo de voluntariado en acción'
  },
  {
    title: 'Mentoría y colaboración',
    description: 'Conversaciones que conectan experiencia, propósito y misión para avanzar acompañados.',
    image:
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Personas conversando en una mesa de trabajo'
  },
  {
    title: 'Liderazgo con integridad',
    description: 'Historias breves que muestran cómo la membresía se traduce en servicio, formación y alcance.',
    meta: 'Historias de fe y servicio',
    image:
      'https://images.unsplash.com/photo-1697218173427-6bd39e9599cc?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000',
    imageAlt: 'Grupo cristiano compartiendo un momento de oración'
  },
  {
    title: 'Adoración que une',
    description: 'Celebraciones congregacionales que convierten cada encuentro en una experiencia de fe compartida y esperanza activa.',
    meta: 'Culto y comunidad',
    image:
      'https://images.unsplash.com/photo-1674566114911-cd9b71354d39?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000',
    imageAlt: 'Comunidad cristiana levantando las manos en adoración'
  }
] as const

export const homeEcosystemCards: InstitutionalFeatureItem[] = [
  {
    title: 'Eventos & convenciones',
    description:
      'Espacios donde la adoración, la enseñanza bíblica y la visión misional se comparten con orden, claridad y participación de toda la red.',
    image:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Evento con luces cálidas y público'
  },
  {
    title: 'Programas',
    description:
      'Procesos de formación que integran fe, liderazgo y servicio para acompañar decisiones concretas en la vida profesional y familiar.',
    image:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Grupo de personas conversando y aprendiendo'
  },
  {
    title: 'Membresía',
    description:
      'Una comunidad de creyentes que se fortalece en oración, acompañamiento y compromiso con una presencia cristiana coherente en la sociedad.',
    image:
      'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Profesionales compartiendo en un encuentro de comunidad cristiana',
    icon: Church
  },
  {
    title: 'Comunidad',
    description:
      'Relaciones de apoyo mutuo, testimonios y recursos que ayudan a vivir el evangelio con cercanía, unidad y servicio visible.',
    image:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Comunidad reunida'
  }
] as const

export const homeProgramShowcase: InstitutionalFeatureItem[] = [
  {
    title: 'Líderes de iniciativa',
    description: 'Programas que acompañan visión, carácter y crecimiento organizacional.',
    image:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Líder conversando con otra persona'
  },
  {
    title: 'Liderazgo de fe',
    description: 'Conversaciones, cohortes y experiencias para una influencia con integridad.',
    image:
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Reunión de liderazgo'
  },
  {
    title: 'Programas comunitarios',
    description: 'Formación y servicio conectados con necesidades reales de la comunidad.',
    image:
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Voluntariado comunitario'
  }
] as const

export const homeTestimonials: InstitutionalListItem[] = [
  {
    title: '“La comunidad me ayudó a ver mi profesión como una extensión de la misión.”',
    description: 'Un testimonio de acompañamiento, mentoría y propósito vivido en comunidad.',
    meta: 'Honor Ortega'
  },
  {
    title: '“Encontramos un espacio para servir con orden, visión y gente que camina contigo.”',
    description: 'Una historia sobre membresía, relaciones y proyectos con sentido.',
    meta: 'Aura Faña'
  },
  {
    title: '“Cada proyecto deja de sentirse aislado cuando entra en una red que lo sostiene.”',
    description: 'ASI como plataforma relacional, no solo informativa.',
    meta: 'Cesia Matos'
  }
] as const

export const homeSpotlights: InstitutionalFeatureItem[] = [
  {
    title: 'Eventos & convenciones',
    description: 'Encuentros que inspiran, forman y conectan a la comunidad profesional con propósito.',
    image:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Convención con audiencia levantando las manos'
  },
  {
    title: 'Proyectos de servicio',
    description: 'Iniciativas que traducen visión en servicio concreto para iglesias, familias y comunidades.',
    image:
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Voluntarios trabajando en comunidad'
  },
  {
    title: 'Membresía que acompaña',
    description: 'Una red para crecer en integridad, liderazgo, mentoría y colaboración.',
    image:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Equipo sonriendo en una actividad institucional'
  }
] as const

export const homeActionCards: InstitutionalFeatureItem[] = [
  {
    title: 'Programas',
    description: 'Formación, mentoría y acompañamiento para servir con excelencia.',
    icon: BookOpenText,
    meta: 'Crecimiento integral'
  },
  {
    title: 'Membresía',
    description: 'Conexiones duraderas entre líderes, empresarios y profesionales.',
    icon: UsersRound,
    meta: 'Comunidad de fe'
  },
  {
    title: 'Comunidad',
    description: 'Espacios para colaborar, compartir recursos y activar servicio.',
    icon: HeartHandshake,
    meta: 'Cuidado mutuo'
  },
  {
    title: 'Proyectos',
    description: 'Iniciativas que transforman necesidades concretas en impacto visible.',
    icon: HandHeart,
    meta: 'Servicio práctico'
  }
] as const

export const homeMissionCards: InstitutionalFeatureItem[] = [
  {
    title: 'Liderazgo con propósito',
    description: 'Curamos conversaciones, recursos y acompañamiento para que el liderazgo se traduzca en servicio.',
    icon: Sparkles
  },
  {
    title: 'Puentes entre iglesia y profesión',
    description: 'ASI fortalece el lugar donde fe, vocación y misión dejan de competir y empiezan a colaborar.',
    icon: Church
  },
  {
    title: 'Visibilidad institucional',
    description: 'Mostramos proyectos, testimonios y oportunidades con una presencia clara y confiable.',
    icon: Megaphone
  }
] as const

export const homePreviewCards: InstitutionalListItem[] = [
  {
    title: 'Nuevas alianzas para proyectos de servicio',
    description: 'Una actualización editorial sobre iniciativas que ya están movilizando recursos y voluntariado.',
    meta: 'Noticias'
  },
  {
    title: 'Biblioteca media para convenciones y campañas',
    description: 'Videos, galerías y piezas reutilizables para mantener la conversación viva.',
    meta: 'Multimedia'
  },
  {
    title: 'Directorio institucional por regiones y frentes',
    description: 'Encuentra líderes, equipos y puntos de contacto desde un hub ordenado y fácil de recorrer.',
    meta: 'Directorio'
  }
] as const

export const membershipPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Membresía',
    title: 'Una membresía pensada para acompañar vocación, liderazgo y servicio.',
    description:
      'ASI reúne profesionales y empresarios en una red que comparte recursos, mentoría, formación y oportunidades de impacto con una identidad institucional clara.',
    primaryAction: {
      label: 'Solicitar membresía',
      to: surfacePaths.institutional.contactUs,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Ver proyectos',
      to: surfacePaths.institutional.projects,
      variant: 'secondary'
    },
    aside: [
      {
        title: 'Comunidad activa',
        description: 'Capítulos locales, eventos, mentoría y colaboración entre pares.',
        icon: UsersRound
      },
      {
        title: 'Formación continua',
        description: 'Recursos y encuentros que fortalecen liderazgo, misión y servicio.',
        icon: BookOpenText
      },
      {
        title: 'Conexiones con propósito',
        description: 'Relaciones que ayudan a movilizar ideas, talento y generosidad.',
        icon: HeartHandshake
      }
    ]
  },
  sections: [
    {
      type: 'stats',
      tone: 'muted',
      lead: {
        eyebrow: 'Valor',
        title: 'Lo que la membresía hace posible.',
        description: 'La propuesta de valor se organiza como acompañamiento relacional, formación y movilización.'
      },
      items: [
        {
          value: '4',
          label: 'Pilares',
          description: 'Comunidad, mentoría, recursos y servicio.'
        },
        {
          value: '12',
          label: 'Momentos al año',
          description: 'Entre eventos, encuentros, briefings y espacios de coordinación.'
        },
        {
          value: '1 red',
          label: 'Identidad compartida',
          description: 'Una sola voz institucional para contar misión, impacto y colaboración.'
        }
      ]
    },
    {
      type: 'feature-grid',
      lead: {
        eyebrow: 'Beneficios',
        title: 'Qué recibe una persona o familia miembro.',
        description: 'La experiencia debe sentirse útil desde la primera interacción y sostenible en el tiempo.'
      },
      items: [
        {
          title: 'Mentoría y cercanía',
          description: 'Acompañamiento práctico con líderes y pares que entienden la realidad profesional.',
          icon: HeartHandshake
        },
        {
          title: 'Programas editoriales',
          description: 'Acceso a recursos, guías, eventos y conversaciones curadas con intención institucional.',
          icon: Newspaper
        },
        {
          title: 'Oportunidades de servicio',
          description: 'Proyectos concretos donde la membresía puede aportar tiempo, experiencia o financiamiento.',
          icon: HandHeart
        },
        {
          title: 'Red de colaboración',
          description: 'Vínculos con capítulos, equipos y aliados que multiplican el alcance de cada iniciativa.',
          icon: Building2
        }
      ],
      columns: 2
    },
    {
      type: 'split',
      tone: 'brand',
      lead: {
        eyebrow: 'Proceso',
        title: 'Una incorporación clara, humana y gradual.',
        description: 'La membresía se presenta como una relación, no como una transacción aislada.'
      },
      image:
        'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Miembros en un evento institucional',
      bodyTitle: 'Cómo se vive el ingreso',
      bodyCopy: [
        'El proceso combina orientación, presentación institucional y conexión con frentes de participación relevantes.',
        'La experiencia inicial debe dejar claro dónde está la comunidad, qué recursos existen y cómo empezar a servir desde el contexto real de cada miembro.'
      ],
      highlights: [
        {
          title: 'Paso 1',
          description: 'Contacto inicial y conversación de contexto.'
        },
        {
          title: 'Paso 2',
          description: 'Integración a comunidad, calendario y recursos clave.'
        },
        {
          title: 'Paso 3',
          description: 'Activación en proyectos, mentoría o frentes de colaboración.'
        }
      ]
    },
    {
      type: 'list',
      tone: 'muted',
      lead: {
        eyebrow: 'Perfiles',
        title: 'Frentes donde la membresía encuentra su lugar.',
        description: 'No todos participan igual; la web debe comunicar opciones con claridad.'
      },
      columns: 2,
      items: [
        {
          title: 'Profesionales activos',
          description: 'Personas que desean integrar vocación, testimonio y servicio desde su ejercicio profesional.',
          tag: 'Vocación'
        },
        {
          title: 'Empresarios y patrocinadores',
          description: 'Aliados que movilizan redes, recursos y oportunidades con visión de misión.',
          tag: 'Mayordomía'
        },
        {
          title: 'Familias y voluntariado',
          description: 'Núcleos que se suman a proyectos, eventos y dinámicas de comunidad.',
          tag: 'Comunidad'
        },
        {
          title: 'Liderazgo regional',
          description: 'Equipos que articulan capítulos y mantienen viva la identidad institucional.',
          tag: 'Coordinación'
        }
      ]
    }
  ],
  cta: {
    title: 'Da el próximo paso hacia una membresía con propósito.',
    description: 'La primera versión puede iniciar con un contacto guiado, mientras el flujo completo evoluciona más adelante.',
    primaryAction: {
      label: 'Hablar con ASI',
      to: surfacePaths.institutional.contactUs,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Explorar la plataforma',
      to: surfacePaths.public.home,
      variant: 'secondary'
    }
  }
}

export const projectsPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Proyectos',
    title: 'Proyectos que convierten intención institucional en impacto visible.',
    description:
      'La web de proyectos debe ayudar a entender áreas de trabajo, prioridades, oportunidades de colaboración y caminos de financiamiento con una narrativa confiable.',
    primaryAction: {
      label: 'Ver financiamiento',
      to: surfacePaths.institutional.projectFunding,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Contactar equipo',
      to: surfacePaths.institutional.contactUs,
      variant: 'secondary'
    },
    aside: [
      {
        title: 'Enfoque misional',
        description: 'Cada proyecto se presenta desde necesidad, propósito y resultados esperados.',
        icon: Church
      },
      {
        title: 'Gobernanza clara',
        description: 'Priorización, seguimiento y comunicación institucional consistente.',
        icon: ShieldCheck
      },
      {
        title: 'Oportunidades abiertas',
        description: 'Financiamiento, voluntariado, difusión y alianzas estratégicas.',
        icon: HandCoins
      }
    ]
  },
  sections: [
    {
      type: 'feature-grid',
      lead: {
        eyebrow: 'Áreas',
        title: 'Cuatro líneas para organizar el impacto.',
        description: 'La experiencia debe permitir escanear rápido sin convertir la web en un dashboard frío.'
      },
      items: [
        {
          title: 'Comunidad y servicio',
          description: 'Proyectos que responden a necesidades locales con acompañamiento, voluntariado y recursos.',
          icon: HandHeart
        },
        {
          title: 'Formación y mentoría',
          description: 'Iniciativas para desarrollar liderazgo, ética profesional y madurez espiritual.',
          icon: BookOpenText
        },
        {
          title: 'Eventos y alcance',
          description: 'Convenciones, campañas y momentos editoriales que amplifican la misión.',
          icon: CalendarHeart
        },
        {
          title: 'Infraestructura para crecer',
          description: 'Herramientas, activos y capacidades que fortalecen la operación institucional.',
          icon: Building2
        }
      ],
      columns: 2
    },
    {
      type: 'split',
      tone: 'muted',
      lead: {
        eyebrow: 'Método',
        title: 'Un marco simple para elegir y sostener iniciativas.',
        description: 'La narrativa debe sentirse seria y bien curada, no improvisada.'
      },
      image:
        'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Equipo planeando proyectos alrededor de una mesa',
      bodyTitle: 'Cómo se leen y priorizan los proyectos',
      bodyCopy: [
        'Cada iniciativa se comunica desde su necesidad real, la respuesta propuesta, los recursos requeridos y el seguimiento esperado.',
        'La web debe ayudar a que líderes, donantes y voluntarios entiendan dónde una oportunidad ya está madura y dónde todavía se está formando.'
      ],
      highlights: [
        {
          title: 'Necesidad',
          description: 'Contexto claro y humano, no solo cifras.'
        },
        {
          title: 'Respuesta',
          description: 'Qué se hará, con quién y para qué.'
        },
        {
          title: 'Sostenibilidad',
          description: 'Cómo se cuidará continuidad, comunicación y cierre.'
        }
      ]
    },
    {
      type: 'list',
      lead: {
        eyebrow: 'Iniciativas',
        title: 'Ejemplos de iniciativas para la primera fase editorial.',
        description: 'Estas colecciones locales sirven como punto de partida antes de una futura fuente dinámica.'
      },
      items: [
        {
          title: 'Red de mentoría profesional',
          description: 'Pareos, sesiones temáticas y acompañamiento con enfoque de fe en el mercado.',
          tag: 'Mentoría'
        },
        {
          title: 'Convención anual y circuitos regionales',
          description: 'Programación, comunicación, materiales y cobertura de experiencias clave.',
          tag: 'Eventos'
        },
        {
          title: 'Fondo para proyectos comunitarios',
          description: 'Prioridades de financiamiento para servicio local con seguimiento institucional.',
          tag: 'Financiamiento'
        },
        {
          title: 'Biblioteca editorial y media',
          description: 'Activos para extender el alcance de historias, campañas y testimonios.',
          tag: 'Multimedia'
        }
      ]
    }
  ],
  cta: {
    title: 'Activa recursos para proyectos listos para crecer.',
    description: 'La página de funding organiza las prioridades y los caminos de aporte sin requerir backend dinámico en esta fase.',
    primaryAction: {
      label: 'Ir a funding',
      to: surfacePaths.institutional.projectFunding,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Donar ahora',
      to: surfacePaths.institutional.donate,
      variant: 'secondary'
    }
  }
}

export const projectFundingPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Financiamiento de proyectos',
    title: 'Financiamiento que cuenta con claridad dónde puede crecer el impacto.',
    description:
      'Esta sección debe combinar confianza institucional, prioridades visibles y llamados a la acción concretos para patrocinadores, miembros y aliados.',
    primaryAction: {
      label: 'Donar',
      to: surfacePaths.institutional.donate,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Explorar proyectos',
      to: surfacePaths.institutional.projects,
      variant: 'secondary'
    },
    aside: [
      {
        title: 'Prioridades visibles',
        description: 'La necesidad se comunica con contexto y propósito.',
        icon: CircleDollarSign
      },
      {
        title: 'Caminos de aporte',
        description: 'Donación, patrocinio, matching y apoyo en especie.',
        icon: HandCoins
      },
      {
        title: 'Confianza institucional',
        description: 'Lenguaje claro sobre seguimiento, transparencia y destino de recursos.',
        icon: ShieldCheck
      }
    ]
  },
  sections: [
    {
      type: 'stats',
      tone: 'brand',
      lead: {
        eyebrow: 'Impacto',
        title: 'Tres preguntas que la página debe responder rápido.',
        description: 'Qué se está financiando, por qué importa ahora y cómo puede sumarse cada aliado.'
      },
      items: [
        {
          value: '3',
          label: 'Caminos de aporte',
          description: 'Donación directa, patrocinio de proyecto y acompañamiento recurrente.'
        },
        {
          value: '100%',
          label: 'Narrativa orientada a claridad',
          description: 'Sin opacidad innecesaria ni lenguaje administrativo excesivo.'
        },
        {
          value: '1 hub',
          label: 'Prioridades centralizadas',
          description: 'La información se agrupa para decidir con rapidez y confianza.'
        }
      ]
    },
    {
      type: 'feature-grid',
      lead: {
        eyebrow: 'Modalidades',
        title: 'Cómo puede participar un patrocinador.',
        description: 'La plataforma visual debe dejar claro que dar no es una sola acción plana.'
      },
      items: [
        {
          title: 'Patrocinio completo',
          description: 'Aliados que adoptan una iniciativa o una parte crítica de su ejecución.',
          icon: CircleDollarSign
        },
        {
          title: 'Aporte recurrente',
          description: 'Contribuciones periódicas para sostener continuidad y planificación.',
          icon: HandCoins
        },
        {
          title: 'Aporte en especie',
          description: 'Recursos, talento, equipos o espacios que fortalecen la operación.',
          icon: BriefcaseBusiness
        },
        {
          title: 'Amplificación',
          description: 'Difusión y movilización de nuevas redes alrededor de una causa.',
          icon: Megaphone
        }
      ],
      columns: 2
    },
    {
      type: 'list',
      tone: 'muted',
      lead: {
        eyebrow: 'Prioridades',
        title: 'Colección inicial de oportunidades financiables.',
        description: 'Se presentan como listas curadas, listas para migrar a contenido dinámico en el futuro.'
      },
      items: [
        {
          title: 'Becas para mentoría y liderazgo',
          description: 'Apoyo a cohortes formativas y acompañamiento de nuevos líderes.',
          tag: 'Educación'
        },
        {
          title: 'Fondo de respuesta comunitaria',
          description: 'Recursos para intervenciones locales con ejecución ágil y acompañamiento.',
          tag: 'Servicio'
        },
        {
          title: 'Infraestructura editorial y media',
          description: 'Producción de materiales, transmisiones y archivo institucional.',
          tag: 'Multimedia'
        },
        {
          title: 'Convenciones y encuentros regionales',
          description: 'Experiencias de conexión, movilización y aprendizaje para toda la red.',
          tag: 'Eventos'
        }
      ]
    }
  ],
  cta: {
    title: 'Haz visible tu generosidad donde la misión ya tiene dirección.',
    description: 'La página de donación puede ser el siguiente paso inmediato para quienes ya están listos para actuar.',
    primaryAction: {
      label: 'Ir a donaciones',
      to: surfacePaths.institutional.donate,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Hablar con nosotros',
      to: surfacePaths.institutional.contactUs,
      variant: 'secondary'
    }
  }
}

export const donatePageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Donaciones',
    title: 'Una página de donación diseñada para inspirar confianza y acción inmediata.',
    description:
      'El objetivo es presentar la generosidad como una extensión natural de la misión, con caminos claros y lenguaje sobrio.',
    primaryAction: {
      label: 'Contactar para donar',
      to: surfacePaths.institutional.contactUs,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Ver financiamiento',
      to: surfacePaths.institutional.projectFunding,
      variant: 'secondary'
    },
    aside: [
      {
        title: 'Donación guiada',
        description: 'Mientras no exista pago en línea, el canal principal debe seguir siendo claro y confiable.',
        icon: HandCoins
      },
      {
        title: 'Compromiso institucional',
        description: 'La confianza se construye con lenguaje transparente y contexto suficiente.',
        icon: ShieldCheck
      },
      {
        title: 'Impacto visible',
        description: 'La donación se conecta con historias, prioridades y frentes concretos.',
        icon: HandHeart
      }
    ]
  },
  sections: [
    {
      type: 'feature-grid',
      tone: 'muted',
      lead: {
        eyebrow: 'Canales',
        title: 'Cómo se organiza el llamado a donar en esta fase.',
        description: 'Aunque el pago aún no sea transaccional, la experiencia debe sentirse real y útil.'
      },
      items: [
        {
          title: 'Donación institucional',
          description: 'Un canal principal para aportes generales y conversaciones de seguimiento.',
          icon: Landmark
        },
        {
          title: 'Aporte para proyectos',
          description: 'Conexión con oportunidades que ya tienen alcance, necesidad y prioridad definidos.',
          icon: CircleDollarSign
        },
        {
          title: 'Patrocinio de eventos',
          description: 'Apoyo a convenciones, encuentros y piezas de alcance comunitario.',
          icon: CalendarHeart
        },
        {
          title: 'Apoyo en especie',
          description: 'Espacios, logística, servicios profesionales o activos de comunicación.',
          icon: BriefcaseBusiness
        }
      ],
      columns: 2
    },
    {
      type: 'split',
      lead: {
        eyebrow: 'Confianza',
        title: 'La decisión de donar necesita contexto, no ruido.',
        description: 'La página debe sentirse premium, sobria y pastoral a la vez.'
      },
      image:
        'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Manos extendidas en oración y apoyo comunitario',
      bodyTitle: 'Qué debe transmitir la página',
      bodyCopy: [
        'Un tono institucional cálido, prioridades visibles y una explicación sencilla de cómo se canaliza el apoyo.',
        'La interfaz debe invitar a la acción con gradientes, profundidad tonal y llamados claros, sin parecer una campaña agresiva.'
      ],
      highlights: [
        {
          title: 'Claridad',
          description: 'Qué se apoya y con qué propósito.'
        },
        {
          title: 'Cercanía',
          description: 'Cómo continuar la conversación con el equipo.'
        },
        {
          title: 'Seriedad',
          description: 'Qué señales de confianza institucional acompañan el flujo.'
        }
      ]
    }
  ],
  cta: {
    title: 'Convierte intención en una conversación de apoyo concreta.',
    description: 'Si la donación online llega después, esta primera versión ya prepara el puente correcto.',
    primaryAction: {
      label: 'Escribir al equipo',
      to: surfacePaths.institutional.contactUs,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Volver a home',
      to: surfacePaths.institutional.home,
      variant: 'ghost'
    }
  }
}

export const whoWeArePageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Quiénes somos',
    title: 'Una asociación que curaría mejor su identidad, historia y propósito en la web.',
    description:
      'La sección institucional debe afirmar misión, trayectoria y liderazgo con una mezcla de autoridad, cercanía y dirección editorial.',
    primaryAction: {
      label: 'Conocer proyectos',
      to: surfacePaths.institutional.projects,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Ver directorio',
      to: surfacePaths.institutional.directory,
      variant: 'secondary'
    },
    aside: [
      {
        title: 'Misión clara',
        description: 'Fe, vocación y servicio articulados sin ambigüedad.',
        icon: Church
      },
      {
        title: 'Historia viva',
        description: 'Trayectoria que se cuenta con sobriedad y sentido contemporáneo.',
        icon: Landmark
      },
      {
        title: 'Liderazgo visible',
        description: 'Personas, equipos y frentes presentados con orden.',
        icon: UsersRound
      }
    ]
  },
  sections: [
    {
      type: 'split',
      tone: 'muted',
      lead: {
        eyebrow: 'Historia',
        title: 'La institución necesita una narrativa que conecte pasado, presente y dirección.',
        description: 'La página no debe limitarse a una biografía larga; debe ayudar a entender por qué ASI existe hoy.'
      },
      image:
        'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Reunión institucional alrededor de una mesa',
      bodyTitle: 'Una trayectoria que da contexto',
      bodyCopy: [
        'La historia institucional se presenta como continuidad de servicio, liderazgo y comunidad, no solo como cronología.',
        'La web debe permitir que una persona nueva entienda rápidamente la identidad de ASI y que una persona cercana la reconozca sin verla genérica.'
      ],
      highlights: [
        {
          title: 'Fe en el mercado',
          description: 'Vocación profesional conectada con misión.'
        },
        {
          title: 'Servicio visible',
          description: 'Impacto que no se queda en discurso.'
        },
        {
          title: 'Comunidad organizada',
          description: 'Relaciones sostenidas por estructura y propósito.'
        }
      ]
    },
    {
      type: 'feature-grid',
      lead: {
        eyebrow: 'Principios',
        title: 'Valores que deben sentirse también en el diseño.',
        description: 'La identidad visual propuesta necesita reflejar estos principios de forma consistente.'
      },
      items: [
        {
          title: 'Integridad',
          description: 'Decisiones, lenguaje y acciones alineadas con fe y transparencia.',
          icon: ShieldCheck
        },
        {
          title: 'Excelencia',
          description: 'Una experiencia cuidada, curada y útil en cada punto de contacto.',
          icon: Sparkles
        },
        {
          title: 'Comunidad',
          description: 'Pertenencia, colaboración y cuidado mutuo como estructuras reales.',
          icon: HeartHandshake
        },
        {
          title: 'Misión',
          description: 'Toda iniciativa debe seguir apuntando hacia servicio y testimonio.',
          icon: Globe2
        }
      ],
      columns: 2
    },
    {
      type: 'people',
      tone: 'muted',
      lead: {
        eyebrow: 'Leadership',
        title: 'Liderazgo presentado como comunidad de servicio.',
        description: 'No se trata de llenar la página de perfiles, sino de dar referencias claras y confiables.'
      },
      items: [
        {
          name: 'Pastor Daniel Rosario',
          role: 'Presidencia',
          description: 'Dirección general, visión institucional y acompañamiento de frentes estratégicos.',
          image:
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80'
        },
        {
          name: 'Martha Almonte',
          role: 'Coordinación de membresía',
          description: 'Relación con capítulos, acompañamiento a miembros y activación de comunidad.',
          image:
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80'
        },
        {
          name: 'Samuel Peña',
          role: 'Proyectos y alianzas',
          description: 'Seguimiento de prioridades, patrocinios y relaciones de impacto.',
          image:
            'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80'
        }
      ]
    }
  ],
  cta: {
    title: 'Conoce la institución y luego decide cómo quieres participar.',
    description: 'La relación entre misión, membresía, proyectos y donación debe sentirse natural desde aquí.',
    primaryAction: {
      label: 'Explorar membership',
      to: surfacePaths.institutional.membership,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Ir a contact us',
      to: surfacePaths.institutional.contactUs,
      variant: 'secondary'
    }
  }
}

export const directoryPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Directorio',
    title: 'Un directorio institucional listo para crecer sin sentirse improvisado.',
    description:
      'Esta primera versión presenta contactos y frentes visibles como una colección ordenada, fácil de recorrer en móvil y desktop.',
    primaryAction: {
      label: 'Contactar ASI',
      to: surfacePaths.institutional.contactUs,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Ver membership',
      to: surfacePaths.institutional.membership,
      variant: 'secondary'
    },
    aside: [
      {
        title: 'Búsqueda clara',
        description: 'El directorio debe escanearse rápido incluso antes de tener filtros dinámicos.',
        icon: Search
      },
      {
        title: 'Cobertura regional',
        description: 'Capítulos, equipos y puntos de contacto por frente.',
        icon: Globe2
      },
      {
        title: 'Lenguaje humano',
        description: 'La información se presenta como personas y equipos, no como registros fríos.',
        icon: UsersRound
      }
    ]
  },
  sections: [
    {
      type: 'list',
      tone: 'muted',
      lead: {
        eyebrow: 'Listado',
        title: 'Entradas iniciales para el hub de contactos.',
        description: 'Se pueden reemplazar por datos dinámicos después sin rehacer la composición.'
      },
      columns: 2,
      items: [
        {
          title: 'Capítulo Norte',
          description: 'Coordinación regional, eventos y red local de miembros.',
          meta: 'Santiago · capitulo-norte@asirdo.org',
          tag: 'Regional'
        },
        {
          title: 'Membresía y acompañamiento',
          description: 'Consultas sobre ingreso, activación y recursos para miembros.',
          meta: 'membership@asirdo.org',
          tag: 'Equipo'
        },
        {
          title: 'Proyectos y funding',
          description: 'Seguimiento a alianzas, prioridades y oportunidades de patrocinio.',
          meta: 'projects@asirdo.org',
          tag: 'Equipo'
        },
        {
          title: 'Comunicación y media',
          description: 'Cobertura, materiales, agenda editorial y activos institucionales.',
          meta: 'media@asirdo.org',
          tag: 'Multimedia'
        },
        {
          title: 'Capítulo Sur',
          description: 'Relación con miembros, convocatorias y frentes de servicio territorial.',
          meta: 'Barahona · capitulo-sur@asirdo.org',
          tag: 'Regional'
        },
        {
          title: 'Secretaría general',
          description: 'Canal principal para orientación general y contacto institucional.',
          meta: 'secretaria@asirdo.org',
          tag: 'Oficina'
        }
      ]
    }
  ],
  cta: {
    title: 'Usa el directorio como puerta de entrada a conversaciones reales.',
    description: 'El siguiente paso lógico puede ser contacto, membresía o participación en proyectos.',
    primaryAction: {
      label: 'Escribir a secretaría',
      to: surfacePaths.institutional.contactUs,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Ver noticias',
      to: surfacePaths.institutional.news,
      variant: 'secondary'
    }
  }
}

export const newsPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Noticias',
    title: 'Noticias curadas para una voz institucional más editorial y menos improvisada.',
    description:
      'La sección de news debe ayudar a mantener agenda, actualidad y cobertura sin caer en una lista plana de comunicados.',
    primaryAction: {
      label: 'Ver multimedia',
      to: surfacePaths.institutional.media,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Ir a home',
      to: surfacePaths.institutional.home,
      variant: 'secondary'
    },
    aside: [
      {
        title: 'Cobertura de eventos',
        description: 'Historias breves, citas clave y próximos pasos con lenguaje institucional.',
        icon: CalendarHeart
      },
      {
        title: 'Actualidad de proyectos',
        description: 'Avances y llamados a participación conectados con impacto real.',
        icon: Newspaper
      },
      {
        title: 'Agenda editorial',
        description: 'Una voz coherente entre sitio, redes, media y campañas.',
        icon: Megaphone
      }
    ]
  },
  sections: [
    {
      type: 'list',
      tone: 'muted',
      lead: {
        eyebrow: 'Historias',
        title: 'Colección inicial de notas destacadas.',
        description: 'Las entradas se diseñan como piezas editoriales cortas y claras.'
      },
      items: [
        {
          title: 'ASI reúne líderes para su jornada anual de visión y servicio',
          description: 'Resumen de las conversaciones, decisiones y próximos pasos que marcan el año institucional.',
          meta: 'Marzo 2026',
          tag: 'Eventos'
        },
        {
          title: 'Nuevo impulso para el fondo de proyectos comunitarios',
          description: 'La red moviliza aportes y coordinación para prioridades con impacto local.',
          meta: 'Marzo 2026',
          tag: 'Financiamiento'
        },
        {
          title: 'Más espacios de mentoría para profesionales jóvenes',
          description: 'Una actualización sobre cohortes, acompañamiento y nuevas oportunidades de participación.',
          meta: 'Febrero 2026',
          tag: 'Membresía'
        },
        {
          title: 'La biblioteca media institucional se amplía con nuevos recursos',
          description: 'Piezas listas para comunicación, cobertura y extensión de historias.',
          meta: 'Febrero 2026',
          tag: 'Multimedia'
        }
      ]
    }
  ],
  cta: {
    title: 'Mantén viva la conversación con una agenda editorial clara.',
    description: 'Noticias y multimedia deben complementarse, no competir por el mismo espacio.',
    primaryAction: {
      label: 'Ir a multimedia',
      to: surfacePaths.institutional.media,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Explorar proyectos',
      to: surfacePaths.institutional.projects,
      variant: 'secondary'
    }
  }
}

export const mediaPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Multimedia',
    title: 'Un centro multimedia con profundidad tonal, orden editorial y llamadas a reutilizar activos.',
    description:
      'La página centraliza videos, galerías, campañas y materiales institucionales con una presentación más curada que un simple archivo.',
    primaryAction: {
      label: 'Explorar news',
      to: surfacePaths.institutional.news,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Contactar media',
      to: surfacePaths.institutional.contactUs,
      variant: 'secondary'
    },
    aside: [
      {
        title: 'Galerías',
        description: 'Cobertura visual de eventos, proyectos y comunidad.',
        icon: MonitorPlay
      },
      {
        title: 'Videos',
        description: 'Mensajes, testimonios y piezas de alcance institucional.',
        icon: MonitorPlay
      },
      {
        title: 'Recursos reutilizables',
        description: 'Materiales listos para campañas, presentaciones y comunicación local.',
        icon: Megaphone
      }
    ]
  },
  sections: [
    {
      type: 'feature-grid',
      tone: 'muted',
      lead: {
        eyebrow: 'Biblioteca',
        title: 'Cómo se organiza el centro multimedia.',
        description: 'La experiencia debe dejar claro qué es inspiracional, qué es utilitario y qué es archivo.'
      },
      items: [
        {
          title: 'Cobertura de convenciones',
          description: 'Fotos, clips y piezas listas para extender la vida de cada evento.',
          icon: CalendarHeart
        },
        {
          title: 'Testimonios de impacto',
          description: 'Historias breves que conectan donación, servicio y transformación.',
          icon: HandHeart
        },
        {
          title: 'Activos de marca',
          description: 'Logos, íconos, fondos y piezas institucionales para uso consistente.',
          icon: Building2
        },
        {
          title: 'Mensajes y cápsulas',
          description: 'Video y audio para presencia digital, reuniones y campañas.',
          icon: MonitorPlay
        }
      ],
      columns: 2
    },
    {
      type: 'list',
      lead: {
        eyebrow: 'Colecciones',
        title: 'Colecciones iniciales para la primera entrega.',
        description: 'Contenido local, preparado para luego migrar a un origen más dinámico.'
      },
      items: [
        {
          title: 'Convención 2026',
          description: 'Galería, clips destacados y kit de comunicación posterior al evento.',
          tag: 'Evento'
        },
        {
          title: 'Historias de servicio',
          description: 'Serie editorial con testimonios de proyectos y voluntariado.',
          tag: 'Series'
        },
        {
          title: 'Recursos de presentación institucional',
          description: 'Logos, slides maestras, fondos y piezas para equipos regionales.',
          tag: 'Marca'
        },
        {
          title: 'Mensajes de liderazgo',
          description: 'Videos cortos y cápsulas para reforzar misión, comunidad y visión.',
          tag: 'Video'
        }
      ]
    }
  ],
  cta: {
    title: 'Conecta media, stories y marca dentro de una sola voz.',
    description: 'El resultado debe sentirse institucionalmente coherente y listo para crecer.',
    primaryAction: {
      label: 'Ver quiénes somos',
      to: surfacePaths.institutional.whoWeAre,
      variant: 'primary'
    },
    secondaryAction: {
      label: 'Ir a directorio',
      to: surfacePaths.institutional.directory,
      variant: 'secondary'
    }
  }
}

export const contactPoints: InstitutionalFeatureItem[] = [
  {
    title: 'Secretaría general',
    description: 'Canal principal para orientación institucional, agenda y solicitudes generales.',
    icon: PhoneCall,
    meta: 'secretaria@asirdo.org · +1 809 555 0140'
  },
  {
    title: 'Membresía',
    description: 'Acompañamiento para ingreso, activación y comunidad de miembros.',
    icon: UsersRound,
    meta: 'membership@asirdo.org'
  },
  {
    title: 'Proyectos y financiamiento',
    description: 'Conversaciones sobre proyectos, alianzas y oportunidades de patrocinio.',
    icon: CircleDollarSign,
    meta: 'projects@asirdo.org'
  },
  {
    title: 'Multimedia y comunicaciones',
    description: 'Solicitudes editoriales, cobertura, materiales y uso de marca.',
    icon: MonitorPlay,
    meta: 'media@asirdo.org'
  }
] as const

export const platformBridgeCards: InstitutionalFeatureItem[] = [
  {
    title: 'Plataforma ASI',
    description: 'La experiencia SaaS del proyecto vive aparte en una superficie propia para jobs, auth y app.',
    icon: BriefcaseBusiness,
    meta: 'Rutas bajo /platform'
  },
  {
    title: 'Separación clara',
    description: 'El portal institucional y la plataforma comercial comparten marca, pero no el mismo shell visual.',
    icon: BadgeHelp,
    meta: 'Dos superficies enlazadas'
  }
] as const
