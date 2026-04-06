import { BriefcaseBusiness, CircleDollarSign, HandCoins, Megaphone, ShieldCheck } from 'lucide-react'

import { surfacePaths } from '@/app/router/surface-paths'
import type { InstitutionalPageContent } from '@/experiences/institutional/content/site-content'

export const projectFundingPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Financiamiento de proyectos',
    title: 'Financiamiento que cuenta con claridad dónde puede crecer el impacto.',
    description:
      'Esta sección debe combinar confianza institucional, prioridades visibles y llamados a la acción concretos para patrocinadores, miembros y aliados.',
    primaryAction: {
      label: 'Donar',
      to: surfacePaths.institutional.donate,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Explorar proyectos',
      to: surfacePaths.institutional.projects,
      variant: 'secondary',
    },
    aside: [
      {
        title: 'Prioridades visibles',
        description: 'La necesidad se comunica con contexto y propósito.',
        icon: CircleDollarSign,
      },
      {
        title: 'Caminos de aporte',
        description: 'Donación, patrocinio, matching y apoyo en especie.',
        icon: HandCoins,
      },
      {
        title: 'Confianza institucional',
        description: 'Lenguaje claro sobre seguimiento, transparencia y destino de recursos.',
        icon: ShieldCheck,
      },
    ],
  },
  sections: [
    {
      type: 'stats',
      tone: 'brand',
      lead: {
        eyebrow: 'Impacto',
        title: 'Tres preguntas que la página debe responder rápido.',
        description: 'Qué se está financiando, por qué importa ahora y cómo puede sumarse cada aliado.',
      },
      items: [
        {
          value: '3',
          label: 'Caminos de aporte',
          description: 'Donación directa, patrocinio de proyecto y acompañamiento recurrente.',
        },
        {
          value: '100%',
          label: 'Narrativa orientada a claridad',
          description: 'Sin opacidad innecesaria ni lenguaje administrativo excesivo.',
        },
        {
          value: '1 hub',
          label: 'Prioridades centralizadas',
          description: 'La información se agrupa para decidir con rapidez y confianza.',
        },
      ],
    },
    {
      type: 'feature-grid',
      lead: {
        eyebrow: 'Modalidades',
        title: 'Cómo puede participar un patrocinador.',
        description: 'La plataforma visual debe dejar claro que dar no es una sola acción plana.',
      },
      items: [
        {
          title: 'Patrocinio completo',
          description: 'Aliados que adoptan una iniciativa o una parte crítica de su ejecución.',
          icon: CircleDollarSign,
        },
        {
          title: 'Aporte recurrente',
          description: 'Contribuciones periódicas para sostener continuidad y planificación.',
          icon: HandCoins,
        },
        {
          title: 'Aporte en especie',
          description: 'Recursos, talento, equipos o espacios que fortalecen la operación.',
          icon: BriefcaseBusiness,
        },
        {
          title: 'Amplificación',
          description: 'Difusión y movilización de nuevas redes alrededor de una causa.',
          icon: Megaphone,
        },
      ],
      columns: 2,
    },
    {
      type: 'list',
      tone: 'muted',
      lead: {
        eyebrow: 'Prioridades',
        title: 'Colección inicial de oportunidades financiables.',
        description: 'Se presentan como listas curadas, listas para migrar a contenido dinámico en el futuro.',
      },
      items: [
        {
          title: 'Becas para mentoría y liderazgo',
          description: 'Apoyo a cohortes formativas y acompañamiento de nuevos líderes.',
          tag: 'Educación',
        },
        {
          title: 'Fondo de respuesta comunitaria',
          description: 'Recursos para intervenciones locales con ejecución ágil y acompañamiento.',
          tag: 'Servicio',
        },
        {
          title: 'Infraestructura editorial y media',
          description: 'Producción de materiales, transmisiones y archivo institucional.',
          tag: 'Multimedia',
        },
        {
          title: 'Convenciones y encuentros regionales',
          description: 'Experiencias de conexión, movilización y aprendizaje para toda la red.',
          tag: 'Eventos',
        },
      ],
    },
  ],
  cta: {
    title: 'Haz visible tu generosidad donde la misión ya tiene dirección.',
    description: 'La página de donación puede ser el siguiente paso inmediato para quienes ya están listos para actuar.',
    primaryAction: {
      label: 'Ir a donaciones',
      to: surfacePaths.institutional.donate,
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Hablar con nosotros',
      to: surfacePaths.institutional.contactUs,
      variant: 'secondary',
    },
  },
}
