import { surfacePaths } from '@/app/router/surface-paths';

export type ProjectFeature = {
  name: string;
  project: string;
  description: string;
  amount: string;
  category: string;
  image: string;
  imageAlt: string;
};

export type PastProjectYear = {
  year: string;
};

export const projectsHeroContent = {
  eyebrow: 'Proyectos',
  titleLines: ['Juntos', 'Transformamos', 'Vidas'],
  heading: 'Impulsando misiones alrededor del mundo',
  description:
    'La junta de ASI Missions Inc. selecciona proyectos cada año para recibir fondos de la ofrenda reunida en la Convención Internacional de ASI. Las donaciones en línea ayudan a apoyar las ofrendas actuales y a completar compromisos previos. Cada proyecto recibe una asignación para generar un impacto global significativo. Si un proyecto no avanza en un plazo razonable, según determine ASI, los fondos pueden redirigirse a otro proyecto aprobado por ASI.',
  followUp:
    'A continuación presentamos organizaciones seleccionadas para recibir apoyo y el uso previsto de los fondos.',
  overflowIntro:
    'Las contribuciones adicionales de la ofrenda de ASI se dirigen a iniciativas de alto impacto, asegurando que cada don apoye la misión de compartir a Cristo en todo el mundo.',
  primaryAction: {
    label: 'Aplicar a fondos',
    to: surfacePaths.institutional.projectFunding,
    variant: 'primary' as const,
  },
  secondaryAction: {
    label: 'Donar hoy',
    to: surfacePaths.institutional.donate,
    variant: 'secondary' as const,
  },
} as const;

export const projectsHeroMedia = {
  image:
    'https://i.ytimg.com/vi/75CVhnv1ngk/hqdefault.jpg',
  imageAlt: 'Video motivador sobre proyectos de ayuda misionera',
  video:
    'https://www.youtube-nocookie.com/embed/75CVhnv1ngk?autoplay=1&mute=1&controls=0&loop=1&playlist=75CVhnv1ngk&playsinline=1&modestbranding=1&rel=0&disablekb=1&fs=0&iv_load_policy=3',
  videoLabel: 'Video motivador sobre proyectos de ayuda misionera',
} as const;

export const projectsImpactStats = [
  {
    value: '41',
    label: 'Proyectos 2025',
    description: 'Colección publicada más reciente de ASI Missions Inc.',
  },
  {
    value: '$1.932M',
    label: 'Fondos asignados',
    description: 'Asignación combinada para la lista publicada de proyectos 2025.',
  },
  {
    value: '3',
    label: 'Proyectos adicionales',
    description: 'Iniciativas apoyadas cuando las ofrendas superan la meta.',
  },
] as const;

export const overflowProjects2025 = [
  'Ellen G. White Estate Digital Project',
  'Hearts for Mission International (Africa)',
  'Roofs Over Africa/One Day Church',
] as const;

export const currentProjects2025: ProjectFeature[] = [
  {
    name: 'ASAP Ministries',
    project:
      'Expandir siete escuelas misioneras en el oeste de Tailandia para alcanzar a múltiples grupos de personas.',
    description:
      'Misioneros locales atienden necesidades prácticas, construyen confianza y comparten el evangelio integral por medio de la educación en comunidades con menos acceso.',
    amount: '$100,000',
    category: 'Escuelas misioneras',
    image:
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Estudiantes reunidos en un salón de clases iluminado',
  },
  {
    name: 'AudioVerse',
    project:
      'Expandir recursos bíblicos en audio y usar IA para indexar contenido de la Biblia y el Espíritu de Profecía.',
    description:
      'El proyecto mejora el acceso a la Biblia y crea rutas de estudio más profundas al conectar sermones, pasajes y temas.',
    amount: '$50,000',
    category: 'Discipulado digital',
    image:
      'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Computadora y materiales de estudio sobre una mesa',
  },
  {
    name: 'Child Impact International',
    project: 'Construir un campus de rescate en Filipinas.',
    description:
      'Un espacio seguro para niños que combina educación, formación vocacional, acompañamiento espiritual y cuidado de largo plazo.',
    amount: '$25,000',
    category: 'Protección infantil',
    image:
      'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Niños sonriendo durante una actividad comunitaria al aire libre',
  },
  {
    name: 'Ellen G. White Estate, Inc.',
    project:
      'Establecer un servidor de IA y ampliar la digitalización de traducciones.',
    description:
      'Este trabajo hace más accesibles los recursos del Espíritu de Profecía a nivel mundial mediante búsqueda digital y expansión de traducciones.',
    amount: '$100,000',
    category: 'Biblioteca digital',
    image:
      'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Estantes de biblioteca llenos de libros',
  },
  {
    name: 'FARM STEW International',
    project: 'Capacitar misioneros agrícolas y de salud en Burundi.',
    description:
      'Mujeres son capacitadas con principios bíblicos, agrícolas, de salud y ahorro que fortalecen familias y comunidades.',
    amount: '$20,000',
    category: 'Salud y agricultura',
    image:
      'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Manos cuidando cultivos en un campo',
  },
  {
    name: 'Hearts for Mission International',
    project: 'Proveer fondos para realizar dos campamentos quirúrgicos.',
    description:
      'Suministros quirúrgicos, equipos de ultrasonido y materiales evangelísticos apoyan cirugías cardíacas y alcance misionero en África.',
    amount: '$100,000',
    category: 'Misión médica',
    image:
      'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Personal médico cuidando a un niño',
  },
  {
    name: 'Lay Institute for Global Health Training',
    project: 'Ampliar equipos de enseñanza y proveer materiales básicos de capacitación.',
    description:
      'LIGHT fortalece la capacitación global en evangelismo médico preparando coordinadores de cursos y recursos prácticos de alcance.',
    amount: '$100,000',
    category: 'Capacitación',
    image:
      'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Grupo pequeño estudiando juntos',
  },
  {
    name: 'One Day Church/Roofs Over Africa',
    project:
      'Proveer estructuras de iglesia de armado rápido y materiales de techo en acero.',
    description:
      'Congregaciones en regiones remotas y con menos recursos reciben infraestructura práctica para reunirse y crecer.',
    amount: '$100,000',
    category: 'Infraestructura',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Edificación rural sencilla rodeada de paisaje abierto',
  },
  {
    name: 'Water for Life',
    project: 'Perforar 35 nuevos pozos.',
    description:
      'El acceso a agua limpia en Guatemala se acompaña de obreros bíblicos que continúan compartiendo el agua viva después de cada pozo.',
    amount: '$40,000',
    category: 'Agua limpia',
    image:
      'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Persona recogiendo agua limpia al aire libre',
  },
];

export const pastProjectYears: PastProjectYear[] = [
  {
    year: '2024',
  },
  {
    year: '2023',
  },
  {
    year: '2022',
  },
  {
    year: '2021',
  },
  {
    year: '2020',
  },
];
