import { Building2, CalendarHeart, HandHeart, Megaphone, MonitorPlay } from 'lucide-react'

import { surfacePaths } from '@/app/router/surface-paths'
import type { InstitutionalPageContent } from '@/experiences/institutional/content/site-content'

export const mediaPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Multimedia',
    title: 'Un centro multimedia con profundidad tonal, orden editorial y llamadas a reutilizar activos.',
    description:
      'La página centraliza videos, galerías, campañas y materiales institucionales con una presentación más curada que un simple archivo.',
    primaryAction: {
      label: 'Explorar news',
      to: surfacePaths.institutional.news,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Contactar media',
      to: surfacePaths.institutional.contactUs,
      variant: 'secondary',
    },
    aside: [
      {
        title: 'Galerías',
        description: 'Cobertura visual de eventos, proyectos y comunidad.',
        icon: MonitorPlay,
      },
      {
        title: 'Videos',
        description: 'Mensajes, testimonios y piezas de alcance institucional.',
        icon: MonitorPlay,
      },
      {
        title: 'Recursos reutilizables',
        description: 'Materiales listos para campañas, presentaciones y comunicación local.',
        icon: Megaphone,
      },
    ],
  },
  sections: [
    {
      type: 'feature-grid',
      tone: 'muted',
      lead: {
        eyebrow: 'Biblioteca',
        title: 'Cómo se organiza el centro multimedia.',
        description: 'La experiencia debe dejar claro qué es inspiracional, qué es utilitario y qué es archivo.',
      },
      items: [
        {
          title: 'Cobertura de convenciones',
          description: 'Fotos, clips y piezas listas para extender la vida de cada evento.',
          icon: CalendarHeart,
        },
        {
          title: 'Testimonios de impacto',
          description: 'Historias breves que conectan donación, servicio y transformación.',
          icon: HandHeart,
        },
        {
          title: 'Activos de marca',
          description: 'Logos, íconos, fondos y piezas institucionales para uso consistente.',
          icon: Building2,
        },
        {
          title: 'Mensajes y cápsulas',
          description: 'Video y audio para presencia digital, reuniones y campañas.',
          icon: MonitorPlay,
        },
      ],
      columns: 2,
    },
    {
      type: 'list',
      lead: {
        eyebrow: 'Colecciones',
        title: 'Colecciones iniciales para la primera entrega.',
        description: 'Contenido local, preparado para luego migrar a un origen más dinámico.',
      },
      items: [
        {
          title: 'Convención 2026',
          description: 'Galería, clips destacados y kit de comunicación posterior al evento.',
          tag: 'Evento',
        },
        {
          title: 'Historias de servicio',
          description: 'Serie editorial con testimonios de proyectos y voluntariado.',
          tag: 'Series',
        },
        {
          title: 'Recursos de presentación institucional',
          description: 'Logos, slides maestras, fondos y piezas para equipos regionales.',
          tag: 'Marca',
        },
        {
          title: 'Mensajes de liderazgo',
          description: 'Videos cortos y cápsulas para reforzar misión, comunidad y visión.',
          tag: 'Video',
        },
      ],
    },
  ],
  cta: {
    title: 'Conecta media, stories y marca dentro de una sola voz.',
    description: 'El resultado debe sentirse institucionalmente coherente y listo para crecer.',
    primaryAction: {
      label: 'Ver quiénes somos',
      to: surfacePaths.institutional.whoWeAre,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Ir a directorio',
      to: surfacePaths.institutional.directory,
      variant: 'secondary',
    },
  },
}
