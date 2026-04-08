export type MembershipApplicationVariantId =
  | 'organization'
  | 'executive-professional'
  | 'sole-proprietor'
  | 'retired'
  | 'associate'
  | 'young-professional'

export interface MembershipApplicationVariant {
  id: MembershipApplicationVariantId
  slug: string
  title: string
  description: string
  sectionTitle: string
  sectionDescription: string
  lockedBadgeLabel: string
  organizationTypeLabel?: string
  note?: string
}

export const ministryOptions = [
  'Educación de salud o estilo de vida',
  'Estudios bíblicos locales',
  'Evangelismo local o internacional',
  'Ministerio de oración',
  'Mentoría espiritual',
  'Otro'
] as const

export const volunteerOptions = [
  'Conferencia anual',
  'Presentaciones evangelísticas',
  'Capacitación evangelística',
  'Misiones internacionales',
  'Medios y comunicación',
  'Reclutamiento de membresía',
  'Mentoría',
  'Boletín o newsletter',
  'Ministerio de oración',
  'Misiones de corto plazo',
  'Otro'
] as const

export const genderOptions = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
] as const

export const certificatePreferenceOptions = [
  { value: 'yes', label: 'Sí, envíen el certificado' },
  { value: 'no', label: 'No por el momento' },
] as const

export const paymentPreferenceOptions = [
  {
    value: 'contact',
    label: 'Coordinar el pago con el equipo de ASI',
  },
  {
    value: 'bank-transfer',
    label: 'Recibir instrucciones para transferencia bancaria',
  },
  {
    value: 'in-person',
    label: 'Pagar presencialmente o por un canal acordado',
  },
] as const

export const youngProfessionalStageOptions = [
  { value: 'student', label: 'Estudiante' },
  { value: 'recent-graduate', label: 'Recién graduado' },
  { value: 'intern', label: 'Pasante' },
  { value: 'resident', label: 'Residente' },
  { value: 'entrepreneur', label: 'Joven emprendedor' },
] as const

export const professionalFocusOptions = [
  { value: 'management', label: 'Gestión y liderazgo' },
  { value: 'clinical', label: 'Práctica clínica o profesional' },
  { value: 'creative', label: 'Servicios creativos o especializados' },
  { value: 'operations', label: 'Operaciones y administración' },
] as const

export const membershipApplicationVariants: MembershipApplicationVariant[] = [
  {
    id: 'organization',
    slug: 'organizational-for-profit',
    title: 'Solicitud organizacional con fines de lucro',
    description:
      'Usa este formulario para documentar la persona de contacto, la información de la organización y la manera en que la entidad vive la misión de ASI.',
    sectionTitle: 'Información de la organización',
    sectionDescription:
      'La solicitud se mantiene enfocada en la organización aprobada durante la verificación de elegibilidad.',
    lockedBadgeLabel: 'Con fines de lucro',
  },
  {
    id: 'organization',
    slug: 'organizational-non-profit',
    title: 'Solicitud organizacional sin fines de lucro',
    description:
      'Usa este formulario para presentar organizaciones o ministerios que cumplen con los criterios institucionales de ASI.',
    sectionTitle: 'Información del ministerio u organización',
    sectionDescription:
      'Comparte el contexto operativo, el alcance del ministerio y la estructura básica de la organización.',
    lockedBadgeLabel: 'Sin fines de lucro',
  },
  {
    id: 'organization',
    slug: 'associate-international',
    title: 'Solicitud asociada internacional',
    description:
      'Esta variante documenta organizaciones sin fines de lucro que operan fuera de la División Norteamericana en territorios sin presencia activa de ASI.',
    sectionTitle: 'Información de la organización internacional',
    sectionDescription:
      'Incluye los datos del ministerio, su ubicación principal y la forma en que sostiene la misión fuera de Norteamérica.',
    lockedBadgeLabel: 'Internacional',
    organizationTypeLabel: 'Organización internacional sin fines de lucro',
    note:
      'La solicitud puede requerir coordinación adicional con la división o capítulo regional correspondiente.',
  },
  {
    id: 'executive-professional',
    slug: 'executive-professional',
    title: 'Solicitud profesional ejecutiva',
    description:
      'Diseñada para profesionales con autoridad formal de supervisión y responsabilidad de liderazgo dentro de una organización.',
    sectionTitle: 'Trayectoria profesional',
    sectionDescription:
      'Describe tu rol actual, el alcance de tu liderazgo y el contexto institucional en el que sirves.',
    lockedBadgeLabel: 'Liderazgo ejecutivo',
  },
  {
    id: 'sole-proprietor',
    slug: 'sole-proprietor',
    title: 'Solicitud de propietario individual',
    description:
      'Presenta tu negocio, práctica profesional o servicio independiente con el mismo estándar institucional del resto de categorías.',
    sectionTitle: 'Información del negocio personal',
    sectionDescription:
      'Comparte el nombre comercial, el enfoque del servicio y la estabilidad operativa de tu práctica.',
    lockedBadgeLabel: 'Propietario individual',
  },
  {
    id: 'retired',
    slug: 'retired',
    title: 'Solicitud para profesional o empresario jubilado',
    description:
      'Esta variante recoge tu trayectoria previa y la forma en que hoy continúas vinculado a la misión, el servicio y la comunidad ASI.',
    sectionTitle: 'Trayectoria y retiro',
    sectionDescription:
      'Resume la experiencia profesional que sustentó tu elegibilidad y tu situación actual de retiro.',
    lockedBadgeLabel: 'Jubilado',
  },
  {
    id: 'associate',
    slug: 'associate',
    title: 'Solicitud asociada',
    description:
      'Pensada para profesionales con alto nivel de responsabilidad que no ejercen autoridad ejecutiva formal ni supervisan equipos.',
    sectionTitle: 'Responsabilidad profesional',
    sectionDescription:
      'Explica el contexto de tu posición, el tipo de responsabilidad que manejas y el aporte que haces desde tu campo.',
    lockedBadgeLabel: 'Asociado',
    note: 'Esta categoría requiere evaluación adicional por parte del capítulo local.',
  },
  {
    id: 'young-professional',
    slug: 'young-professional',
    title: 'Solicitud de joven profesional',
    description:
      'Orientada a estudiantes, recién graduados, pasantes, residentes y jóvenes emprendedores entre 18 y 35 años.',
    sectionTitle: 'Etapa formativa y profesional',
    sectionDescription:
      'Comparte en qué momento profesional te encuentras y cómo deseas crecer dentro de la comunidad ASI.',
    lockedBadgeLabel: '18 a 35 años',
    note: 'Esta categoría requiere evaluación adicional y seguimiento de transición futura.',
  },
] as const

export function getMembershipApplicationVariant(
  categorySlug: string
): MembershipApplicationVariant | null {
  return (
    membershipApplicationVariants.find((variant) => variant.slug === categorySlug) ??
    null
  )
}
