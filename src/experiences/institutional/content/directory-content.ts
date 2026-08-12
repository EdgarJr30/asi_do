import { Globe2, Search, UsersRound } from 'lucide-react';

import { surfacePaths } from '@/app/router/surface-paths';
import type { InstitutionalPageContent } from '@/experiences/institutional/content/site-content';

export const directoryPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Directorio',
    title:
      'Un directorio institucional listo para crecer sin sentirse improvisado.',
    description:
      'Esta primera versión presenta contactos y frentes visibles como una colección ordenada, fácil de recorrer en móvil y desktop.',
    primaryAction: {
      label: 'Contactar ASI',
      to: surfacePaths.institutional.contactUs,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Ver membership',
      to: surfacePaths.institutional.membership,
      variant: 'secondary',
    },
    aside: [
      {
        title: 'Búsqueda clara',
        description:
          'El directorio debe escanearse rápido incluso antes de tener filtros dinámicos.',
        icon: Search,
      },
      {
        title: 'Cobertura regional',
        description: 'Capítulos, equipos y puntos de contacto por frente.',
        icon: Globe2,
      },
      {
        title: 'Lenguaje humano',
        description:
          'La información se presenta como personas y equipos, no como registros fríos.',
        icon: UsersRound,
      },
    ],
  },
  sections: [
    {
      type: 'list',
      tone: 'muted',
      lead: {
        eyebrow: 'Listado',
        title: 'Entradas iniciales para el hub de contactos.',
        description:
          'Se pueden reemplazar por datos dinámicos después sin rehacer la composición.',
      },
      columns: 2,
      items: [
        {
          title: 'Capítulo Norte',
          description:
            'Coordinación regional, eventos y red local de miembros.',
          meta: 'Santiago · hola@asidominicana.do',
          tag: 'Regional',
        },
        {
          title: 'Membresía y acompañamiento',
          description:
            'Consultas sobre ingreso, activación y recursos para miembros.',
          meta: 'hola@asidominicana.do',
          tag: 'Equipo',
        },
        {
          title: 'Proyectos y funding',
          description:
            'Seguimiento a alianzas, prioridades y oportunidades de patrocinio.',
          meta: 'hola@asidominicana.do',
          tag: 'Equipo',
        },
        {
          title: 'Comunicación y media',
          description:
            'Cobertura, materiales, agenda editorial y activos institucionales.',
          meta: 'hola@asidominicana.do',
          tag: 'Multimedia',
        },
        {
          title: 'Capítulo Sur',
          description:
            'Relación con miembros, convocatorias y frentes de servicio territorial.',
          meta: 'Barahona · hola@asidominicana.do',
          tag: 'Regional',
        },
        {
          title: 'Secretaría general',
          description:
            'Canal principal para orientación general y contacto institucional.',
          meta: 'hola@asidominicana.do',
          tag: 'Oficina',
        },
      ],
    },
  ],
  cta: {
    title: 'Usa el directorio como puerta de entrada a conversaciones reales.',
    description:
      'El siguiente paso lógico puede ser contacto, membresía o participación en proyectos.',
    primaryAction: {
      label: 'Escribir a secretaría',
      to: surfacePaths.institutional.contactUs,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Ver noticias',
      to: surfacePaths.institutional.news,
      variant: 'secondary',
    },
  },
};
