import {
  BookOpenText,
  ClipboardList,
  HeartHandshake,
  Layers,
  RefreshCw,
  UsersRound,
} from 'lucide-react';

import { surfacePaths } from '@/app/router/surface-paths';
import type { InstitutionalPageContent } from '@/experiences/institutional/content/site-content';

export const membershipFeatures = [
  {
    name: 'Comunidad activa',
    description:
      'Capítulos locales, eventos, mentoría y colaboración entre pares.',
    icon: UsersRound,
  },
  {
    name: 'Formación continua',
    description:
      'Recursos y encuentros que fortalecen liderazgo, misión y servicio.',
    icon: BookOpenText,
  },
  {
    name: 'Conexiones con propósito',
    description:
      'Relaciones que ayudan a movilizar ideas, talento y generosidad.',
    icon: HeartHandshake,
  },
] as const;

export const membershipHeroImage = {
  src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=2400&q=80',
  alt: 'Hermanos cristianos unidos en comunidad y servicio',
};

export const membershipBenefitColumns = [
  {
    title: 'Miembros individuales',
    description:
      'Únete a ASI como miembro individual y forma parte de una familia de profesionales y empresarios comprometidos con la misión y el testimonio adventista.',
    highlights: [
      'Formación con líderes experimentados en fe y negocios',
      'Red de colaboración con pares que comparten tu visión',
      'Acceso a oportunidades concretas de servicio e impacto',
      'Profesionales activos: integra vocación, testimonio y servicio desde tu ejercicio profesional',
      'Familias y voluntariado: súmate a proyectos, eventos y dinámicas de comunidad',
    ],
    cta: { label: 'Nueva membresía', to: '/eligibility' },
  },
  {
    title: 'Organizaciones y ministerios',
    description:
      'Las organizaciones miembro de ASI son ministerios aprobados que amplían su alcance y credibilidad al ser parte de una red institucional de alcance global.',
    highlights: [
      'Potencia el crecimiento y alcance de tu ministerio',
      'Conéctate con otros ministerios en el mundo',
      'Avanza el reino con el respaldo de una familia institucional',
      'Empresarios y patrocinadores: moviliza redes, recursos y oportunidades con visión de misión',
      'Liderazgo regional: articula capítulos y mantén viva la identidad institucional',
    ],
    cta: { label: 'Formulario de interés', to: surfacePaths.institutional.contactUs },
  },
] as const;

export const membershipFaqs = [
  {
    question: '¿Cuáles son los beneficios de ser miembro de ASI?',
    answer:
      'La membresía ASI te conecta con una red de personas y organizaciones comprometidas con compartir a Cristo en el mercado. Los miembros acceden a recursos exclusivos, oportunidades de red, tarifas especiales en convenciones y la posibilidad de colaborar en proyectos de misión de alto impacto.',
  },
  {
    question: '¿Quién puede ser miembro de ASI?',
    answer:
      'La membresía está abierta a personas, empresas y organizaciones que apoyan la misión de compartir a Cristo en el mercado. Ya sea que seas un profesional, líder de ministerio o miembro laico, hay un lugar para ti en ASI.',
  },
  {
    question: '¿Cómo aplico para la membresía?',
    answer:
      '¡Unirse a ASI es sencillo! Elige tu categoría de membresía (Laico, Profesional o Empresa), completa el formulario de solicitud y envíalo junto con los materiales requeridos. Una vez aprobado, tendrás acceso a todos los beneficios de ser parte de esta vibrante comunidad.',
  },
  {
    question: '¿Cómo puedo renovar mi membresía existente?',
    answer:
      'Los miembros activos pueden renovar su membresía anual directamente desde nuestra plataforma en línea. Ingresa a tu perfil institucional y sigue el proceso de renovación antes de la fecha de vencimiento.',
  },
  {
    question: '¿Qué debo hacer si tengo preguntas adicionales?',
    answer:
      'Puedes comunicarte con nuestro equipo a través del formulario de contacto o escribirnos directamente. Estaremos encantados de acompañarte en el proceso.',
  },
] as const;

export const membershipActionCards = [
  {
    icon: ClipboardList,
    title: 'Formulario de elegibilidad',
    description:
      'Los miembros de ASI se comprometen a vivir y ejercer su trabajo en armonía con los principios adventistas, manteniéndose en buena posición con la Iglesia Adventista del Séptimo Día.',
    cta: { label: 'Completar formulario', to: '/eligibility' },
  },
  {
    icon: Layers,
    title: 'Categorías y cuotas',
    description:
      'La membresía está abierta a adventistas que dirigen negocios, ofrecen servicios profesionales o apoyan ministerios. Estudiantes y recientes graduados son también bienvenidos.',
    cta: { label: 'Ver categorías', to: '/membership/categories' },
  },
  {
    icon: RefreshCw,
    title: 'Renovación de membresía',
    description:
      'Los miembros actuales pueden renovar su membresía anual en línea. Los nuevos deben completar la solicitud y cumplir con las cuotas correspondientes al iniciar.',
    cta: { label: 'Renovar en línea', to: surfacePaths.institutional.contactUs },
  },
] as const;

export const membershipPageContent: InstitutionalPageContent = {
  hero: {
    eyebrow: 'Membresía',
    title:
      'Una membresía pensada para acompañar vocación, liderazgo y servicio.',
    description:
      'ASI reúne profesionales y empresarios en una red que comparte recursos, mentoría, formación y oportunidades de impacto con una identidad institucional clara.',
    primaryAction: {
      label: 'Solicitar membresía',
      to: '/eligibility',
      variant: 'primary',
    },
    secondaryAction: {
      label: 'Renovar membresía',
      to: surfacePaths.institutional.contactUs,
      variant: 'secondary',
    },
    aside: [
      {
        title: 'Comunidad activa',
        description:
          'Capítulos locales, eventos, mentoría y colaboración entre pares.',
        icon: UsersRound,
      },
      {
        title: 'Formación continua',
        description:
          'Recursos y encuentros que fortalecen liderazgo, misión y servicio.',
        icon: BookOpenText,
      },
      {
        title: 'Conexiones con propósito',
        description:
          'Relaciones que ayudan a movilizar ideas, talento y generosidad.',
        icon: HeartHandshake,
      },
    ],
  },
  sections: [],
};
