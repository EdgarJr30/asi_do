export type MembershipApplicationVariantId =
  | 'individual'
  | 'professional'
  | 'organization'

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
  'Otro'
] as const

export const volunteerOptions = [
  'Conferencia anual',
  'Presentador de evangelismo',
  'Capacitador de evangelismo',
  'Misiones internacionales',
  'Medios (web, video, TV, etc.)',
  'Reclutamiento de membresía',
  'Mentoría',
  'Boletín',
  'Ministerio de oración',
  'Misiones de corto plazo',
  'Otro'
] as const

export const genderOptions = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
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
    id: 'individual',
    slug: 'laico',
    title: 'Solicitud de membresía laica',
    description:
      'Usa este formulario para registrar tus datos personales, tu iglesia local y tu vínculo con la misión de ASI como miembro laico individual.',
    sectionTitle: 'Datos de la membresía',
    sectionDescription:
      'La membresía laica no requiere información profesional ni organizacional adicional.',
    lockedBadgeLabel: 'Laico',
  },
  {
    id: 'professional',
    slug: 'profesional',
    title: 'Solicitud de membresía profesional',
    description:
      'Diseñada para profesionales, ejecutivos y propietarios que integran su vocación y testimonio desde el ejercicio de su profesión.',
    sectionTitle: 'Trayectoria profesional',
    sectionDescription:
      'Describe tu ocupación actual y el contexto en el que ejerces tu profesión.',
    lockedBadgeLabel: 'Profesional',
  },
  {
    id: 'organization',
    slug: 'empresa',
    title: 'Solicitud de membresía empresarial',
    description:
      'Usa este formulario para documentar la persona de contacto, la información de la organización y la manera en que la entidad vive la misión de ASI.',
    sectionTitle: 'Información de la organización',
    sectionDescription:
      'Comparte los datos de la empresa u organización que solicita la membresía.',
    lockedBadgeLabel: 'Empresa',
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
