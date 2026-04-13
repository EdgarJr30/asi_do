import { CalendarHeart, Megaphone, Newspaper } from 'lucide-react'

import { surfacePaths } from '@/app/router/surface-paths'
import type { InstitutionalPageContent } from '@/experiences/institutional/content/site-content'

export const newsPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Noticias',
    title: 'Noticias curadas para una voz institucional más editorial y menos improvisada.',
    description:
      'La sección de news debe ayudar a mantener agenda, actualidad y cobertura sin caer en una lista plana de comunicados.',
    primaryAction: {
      label: 'Ver proyectos',
      to: surfacePaths.institutional.projects,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Ir a home',
      to: surfacePaths.institutional.home,
      variant: 'secondary',
    },
    aside: [
      {
        title: 'Cobertura de eventos',
        description: 'Historias breves, citas clave y próximos pasos con lenguaje institucional.',
        icon: CalendarHeart,
      },
      {
        title: 'Actualidad de proyectos',
        description: 'Avances y llamados a participación conectados con impacto real.',
        icon: Newspaper,
      },
      {
        title: 'Agenda editorial',
        description: 'Una voz coherente entre sitio, redes, media y campañas.',
        icon: Megaphone,
      },
    ],
  },
  sections: [
    {
      type: 'list',
      tone: 'muted',
      lead: {
        eyebrow: 'Historias',
        title: 'Colección inicial de notas destacadas.',
        description: 'Las entradas se diseñan como piezas editoriales cortas y claras.',
      },
      items: [
        {
          title: 'ASI reúne líderes para su jornada anual de visión y servicio',
          description: 'Resumen de las conversaciones, decisiones y próximos pasos que marcan el año institucional.',
          meta: 'Marzo 2026',
          tag: 'Eventos',
        },
        {
          title: 'Nuevo impulso para el fondo de proyectos comunitarios',
          description: 'La red moviliza aportes y coordinación para prioridades con impacto local.',
          meta: 'Marzo 2026',
          tag: 'Financiamiento',
        },
        {
          title: 'Más espacios de mentoría para profesionales jóvenes',
          description: 'Una actualización sobre cohortes, acompañamiento y nuevas oportunidades de participación.',
          meta: 'Febrero 2026',
          tag: 'Membresía',
        },
        {
          title: 'La biblioteca media institucional se amplía con nuevos recursos',
          description: 'Piezas listas para comunicación, cobertura y extensión de historias.',
          meta: 'Febrero 2026',
          tag: 'Multimedia',
        },
      ],
    },
  ],
  cta: {
    title: 'Mantén viva la conversación con una agenda editorial clara.',
    description: 'Noticias y multimedia deben complementarse, no competir por el mismo espacio.',
    primaryAction: {
      label: 'Explorar proyectos',
      to: surfacePaths.institutional.projects,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Explorar proyectos',
      to: surfacePaths.institutional.projects,
      variant: 'secondary',
    },
  },
}
