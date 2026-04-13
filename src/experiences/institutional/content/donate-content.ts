import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarHeart,
  CircleDollarSign,
  HandCoins,
  HandHeart,
  HeartHandshake,
  Landmark,
  Megaphone,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'

import { surfacePaths } from '@/app/router/surface-paths'
import type { InstitutionalPageContent } from '@/experiences/institutional/content/site-content'

export const donatePageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Donaciones',
    title: 'Tu generosidad extiende la misión de Cristo donde más se necesita.',
    description:
      'ASI Republic Dominicana canaliza recursos hacia proyectos evangelísticos, educación, servicio comunitario y liderazgo. Cada aporte fortalece una red adventista comprometida con llevar el evangelio al corazón del mercado.',
    primaryAction: {
      label: 'Donar ahora',
      to: surfacePaths.institutional.contactUs,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Ver proyectos',
      to: surfacePaths.institutional.projectFunding,
      variant: 'secondary',
    },
    image: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Comunidad adventista unida en servicio y misión',
    aside: [
      {
        title: 'Transparencia total',
        description: 'Cada donación va acompañada de información clara sobre su destino, propósito y seguimiento.',
        icon: ShieldCheck,
      },
      {
        title: 'Impacto misionero real',
        description: 'Tus recursos se conectan directamente con proyectos activos en República Dominicana y más allá.',
        icon: HandHeart,
      },
      {
        title: 'Múltiples formas de apoyar',
        description: 'Donación directa, patrocinio de proyectos, apoyo en especie y mucho más.',
        icon: HandCoins,
      },
    ],
  },
  sections: [
    {
      type: 'split',
      lead: {
        eyebrow: 'Por qué importa',
        title: 'Cuando los laicos dan, la misión avanza.',
        description:
          'ASI nació de una convicción sencilla: los adventistas en el mercado tienen recursos, redes y vocación para sostener la obra de Dios. Donar a ASI es unirse a esa historia.',
      },
      image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Profesionales y voluntarios adventistas reunidos en servicio comunitario',
      bodyTitle: 'Tu aporte transforma vidas y comunidades',
      bodyCopy: [
        'En República Dominicana, ASI articula a empresarios, profesionales y ministerios en torno a proyectos que responden a necesidades reales — desde educación bíblica hasta atención en salud comunitaria.',
        'Una donación a ASI DO no es solo un acto financiero. Es una declaración de misión: que el evangelio debe llegar a cada rincón del mercado, cada empresa, cada barrio.',
        'Con transparencia institucional, seguimiento claro y proyectos liderados por personas comprometidas, cada recurso recibido produce fruto visible y duradero.',
      ],
      highlights: [
        {
          title: 'Destino claro',
          description: 'Sabes exactamente qué proyecto o frente respalda tu donación.',
        },
        {
          title: 'Seguimiento real',
          description: 'El equipo te mantiene informado sobre el avance del proyecto que apoyaste.',
        },
        {
          title: 'Confianza institucional',
          description: 'ASI opera con los valores y el respaldo de la Iglesia Adventista del Séptimo Día.',
        },
      ],
    },
    {
      type: 'stats',
      tone: 'brand',
      lead: {
        eyebrow: 'Impacto',
        title: 'Una misión con historia, alcance y urgencia.',
        description:
          'Desde 1947, ASI ha movilizado laicos adventistas para servir con fe visible en cada profesión e industria. En República Dominicana, esa misión cobra fuerza con cada aporte recibido.',
      },
      items: [
        {
          value: '75+',
          label: 'Años de misión global',
          description:
            'ASI nació en 1947 uniendo instituciones de sostén propio al servicio de la Iglesia Adventista del Séptimo Día.',
        },
        {
          value: '100%',
          label: 'Orientado a la misión',
          description:
            'Cada proyecto financiado tiene alcance claro, liderazgo comprometido y propósito evangelístico definido.',
        },
        {
          value: '4 frentes',
          label: 'Áreas de impacto activo',
          description:
            'Educación, salud, evangelismo directo y servicio comunitario articulan el trabajo de la red en el país.',
        },
      ],
    },
    {
      type: 'feature-grid',
      tone: 'muted',
      lead: {
        eyebrow: 'Cómo apoyar',
        title: 'Elige la forma de dar que mejor se alinea con tu llamado.',
        description:
          'No existe una sola manera de apoyar la misión. ASI ofrece canales flexibles para que tu generosidad llegue exactamente donde puede tener mayor impacto.',
      },
      items: [
        {
          title: 'Donación institucional',
          description:
            'Aporta al fondo general de ASI DO para sostener operaciones, liderazgo y la red de miembros activos.',
          icon: Landmark,
        },
        {
          title: 'Patrocinio de proyectos',
          description:
            'Adopta una iniciativa específica — evangelismo, salud, educación o comunidad — y sigue de cerca su impacto.',
          icon: CircleDollarSign,
        },
        {
          title: 'Apoyo a convenciones',
          description:
            'Financia encuentros regionales, convenciones nacionales y espacios de visión que movilizan a toda la red.',
          icon: CalendarHeart,
        },
        {
          title: 'Apoyo en especie',
          description:
            'Ofrece espacios, logística, talento profesional, equipos o activos de comunicación para potenciar la misión.',
          icon: BriefcaseBusiness,
        },
        {
          title: 'Becas de liderazgo',
          description:
            'Invierte en la próxima generación de laicos adventistas comprometidos con el servicio y el testimonio profesional.',
          icon: Sparkles,
        },
        {
          title: 'Amplificación',
          description:
            'Conecta tu red empresarial o ministerial con ASI para multiplicar el alcance de proyectos estratégicos.',
          icon: Megaphone,
        },
      ],
      columns: 3,
    },
    {
      type: 'list',
      tone: 'muted',
      lead: {
        eyebrow: 'Prioridades actuales',
        title: 'Proyectos listos para recibir tu apoyo hoy.',
        description:
          'Estas son las iniciativas activas que necesitan respaldo financiero en esta temporada. Cada una tiene liderazgo, alcance y propósito definidos.',
      },
      items: [
        {
          title: 'Programa de mentoría para profesionales jóvenes',
          description:
            'Acompañamiento a nuevos líderes adventistas en el mercado: fe, vocación e integridad profesional.',
          tag: 'Liderazgo',
        },
        {
          title: 'Fondo de respuesta comunitaria',
          description:
            'Recursos de acción rápida para intervenciones locales en comunidades vulnerables de todo el país.',
          tag: 'Servicio',
        },
        {
          title: 'Convención nacional ASI DO 2026',
          description:
            'El encuentro principal de la red — testimonios, visión, proyectos y llamado a la misión laica.',
          tag: 'Eventos',
          meta: 'Segundo semestre 2026',
        },
        {
          title: 'Infraestructura editorial y media',
          description:
            'Producción de materiales institucionales, transmisiones en vivo y archivo digital para toda la red.',
          tag: 'Multimedia',
        },
        {
          title: 'Proyecto de salud comunitaria',
          description:
            'Clínicas, ferias de salud y educación preventiva conducidas por profesionales adventistas comprometidos.',
          tag: 'Salud',
        },
        {
          title: 'Evangelismo en el mercado',
          description:
            'Iniciativas de testimonio, literatura y presencia cristiana en espacios empresariales y profesionales.',
          tag: 'Evangelismo',
        },
      ],
      columns: 2,
    },
  ],
  cta: {
    title: 'Da el primer paso: contáctanos y tu generosidad encontrará su destino.',
    description:
      'El equipo de ASI DO está listo para orientarte, responderte y acompañarte en la decisión de donar. No importa el tamaño del aporte — lo que importa es que se sume a la misión.',
    primaryAction: {
      label: 'Contactar para donar',
      to: surfacePaths.institutional.contactUs,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Ver financiamiento de proyectos',
      to: surfacePaths.institutional.projectFunding,
      variant: 'secondary',
    },
  },
}
