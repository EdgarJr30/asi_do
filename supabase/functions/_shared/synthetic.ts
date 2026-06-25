// Generadores de datos SINTÉTICOS y deterministas para el arnés de estrés.
//
// Reglas de diseño:
// - 100% puro: no importa nada específico de runtime (sirve en Deno y Node).
// - Determinista: dado un mismo `seed` produce exactamente los mismos datos, de
//   modo que los escenarios sean repetibles de forma controlada.
// - Todo dato sintético queda marcado (emails @harness.asido.test, slugs/metadata
//   con `synthetic: true` y el `runId`) para poder identificarlo y purgarlo sin
//   tocar datos reales.

export const SYNTHETIC_EMAIL_DOMAIN = 'harness.asido.test'
export const SYNTHETIC_SLUG_PREFIX = 'harness'
export const SYNTHETIC_MARKER = 'asido-stress-harness'

// PRNG mulberry32: rápido, determinista y suficiente para datos de prueba.
export function createRng(seed: number) {
  let state = seed >>> 0
  return function next() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = ReturnType<typeof createRng>

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

export function intBetween(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability
}

// Hash determinista de cadena -> semilla numérica, para sembrar sub-RNGs estables.
export function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const FIRST_NAMES = [
  'María', 'José', 'Ana', 'Luis', 'Carmen', 'Juan', 'Rosa', 'Pedro', 'Laura',
  'Carlos', 'Sofía', 'Miguel', 'Elena', 'Jorge', 'Patricia', 'Andrés', 'Lucía',
  'Rafael', 'Daniela', 'Manuel', 'Valeria', 'Francisco', 'Gabriela', 'Diego',
  'Paola', 'Ricardo', 'Isabel', 'Fernando', 'Camila', 'Héctor'
] as const

const LAST_NAMES = [
  'Pérez', 'Rodríguez', 'García', 'Martínez', 'Sánchez', 'Ramírez', 'Cruz',
  'Reyes', 'Fernández', 'Díaz', 'Jiménez', 'Mejía', 'Castillo', 'Vásquez',
  'Peña', 'Núñez', 'Santana', 'Polanco', 'Then', 'Encarnación', 'De los Santos',
  'Féliz', 'Guzmán', 'Herrera', 'Medina'
] as const

const CITIES = [
  { city: 'Santo Domingo', country: 'DO' },
  { city: 'Santiago', country: 'DO' },
  { city: 'La Vega', country: 'DO' },
  { city: 'San Cristóbal', country: 'DO' },
  { city: 'Puerto Plata', country: 'DO' },
  { city: 'San Pedro de Macorís', country: 'DO' },
  { city: 'Bogotá', country: 'CO' },
  { city: 'Ciudad de México', country: 'MX' },
  { city: 'Lima', country: 'PE' },
  { city: 'Buenos Aires', country: 'AR' }
] as const

const ROLES = [
  'Desarrollador Full Stack', 'Diseñador UX/UI', 'Project Manager', 'Contador',
  'Especialista en Marketing', 'Analista de Datos', 'Enfermero', 'Docente',
  'Administrador de Sistemas', 'Coordinador de Voluntariado', 'Pastor de Jóvenes',
  'Líder de Misiones', 'Ingeniero Civil', 'Community Manager', 'Soporte Técnico'
] as const

const INDUSTRIES = [
  'Tecnología', 'Educación', 'Salud', 'Servicios financieros', 'Manufactura',
  'Retail', 'Ministerio', 'ONG / Sin fines de lucro', 'Construcción', 'Logística'
] as const

const SKILLS = [
  'TypeScript', 'React', 'PostgreSQL', 'Liderazgo', 'Comunicación', 'Node.js',
  'Excel', 'Gestión de proyectos', 'Diseño gráfico', 'Inglés', 'Contabilidad',
  'Atención al cliente', 'Predicación', 'Consejería', 'Análisis de datos'
] as const

const LANGUAGES = ['Español', 'Inglés', 'Francés', 'Portugués', 'Creole'] as const
const PROFICIENCY = ['Básico', 'Intermedio', 'Avanzado', 'Nativo'] as const
const COMPANY_SUFFIX = ['SRL', 'SAS', 'Group', 'Ministerios', 'Foundation', 'Corp'] as const

export function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : fallback
}

export type SyntheticPerson = {
  fullName: string
  firstName: string
  lastName: string
  city: string
  country: string
  desiredRole: string
  phone: string
}

export function buildPerson(rng: Rng): SyntheticPerson {
  const firstName = pick(rng, FIRST_NAMES)
  const lastName = `${pick(rng, LAST_NAMES)} ${pick(rng, LAST_NAMES)}`
  const place = pick(rng, CITIES)
  return {
    fullName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    city: place.city,
    country: place.country,
    desiredRole: pick(rng, ROLES),
    phone: `+1809${intBetween(rng, 2000000, 9999999)}`
  }
}

// Email único y trazable por run + índice (evita colisiones entre corridas).
export function syntheticEmail(runId: string, index: number): string {
  return `stress+${runId}-${index}@${SYNTHETIC_EMAIL_DOMAIN}`
}

export function buildCompany(rng: Rng, index: number, runId: string) {
  const place = pick(rng, CITIES)
  const baseName = `${pick(rng, LAST_NAMES)} ${pick(rng, COMPANY_SUFFIX)}`
  const industry = pick(rng, INDUSTRIES)
  return {
    displayName: baseName,
    legalName: `${baseName} ${runId}-${index}`,
    industry,
    city: place.city,
    country: place.country,
    sizeRange: pick(rng, ['1-10', '11-50', '51-200', '201-500', '500+'] as const),
    // El email tiene índice único global: hay que scoparlo por runId para no
    // colisionar con company_profiles_company_email_unique_idx entre corridas.
    email: `contacto+${runId}-${index}@${SYNTHETIC_EMAIL_DOMAIN}`,
    phone: `+1809${intBetween(rng, 2000000, 9999999)}`,
    website: `https://${SYNTHETIC_SLUG_PREFIX}-company-${runId}-${index}.${SYNTHETIC_EMAIL_DOMAIN}`
  }
}

export function buildJob(rng: Rng, index: number) {
  const role = pick(rng, ROLES)
  const place = pick(rng, CITIES)
  const min = intBetween(rng, 25, 80) * 1000
  const max = min + intBetween(rng, 5, 40) * 1000
  return {
    title: `${role} (${index})`,
    summary: `Buscamos ${role.toLowerCase()} para sumarse a un equipo en crecimiento.`,
    description:
      `Responsabilidades del rol de ${role.toLowerCase()}. ` +
      'Esta es una vacante sintética generada por el arnés de estrés para medir capacidad. '.repeat(4),
    city: place.city,
    country: place.country,
    workplaceType: pick(rng, ['on_site', 'hybrid', 'remote'] as const),
    employmentType: pick(rng, ['full_time', 'part_time', 'contract', 'temporary', 'internship'] as const),
    opportunityType: pick(rng, ['employment', 'project', 'volunteer', 'professional_service'] as const),
    salaryMin: min,
    salaryMax: max,
    experienceLevel: pick(rng, ['junior', 'mid', 'senior', 'lead'] as const)
  }
}

// Metadata requerida por el trigger de asi_type_requirements según opportunity_type:
//   project              → operating_scope + delivery_timeline
//   volunteer            → operating_scope + engagement_model
//   professional_service → service_scope
//   employment           → (sin requisitos extra)
export function buildOpportunityMetadata(rng: Rng, opportunityType: string): Record<string, string> {
  const operatingScope = pick(rng, ['local', 'regional', 'nacional', 'internacional'] as const)
  switch (opportunityType) {
    case 'project':
      return {
        operating_scope: operatingScope,
        delivery_timeline: pick(rng, ['1 mes', '3 meses', '6 meses', '1 año'] as const)
      }
    case 'volunteer':
      return {
        operating_scope: operatingScope,
        engagement_model: pick(rng, ['remoto', 'presencial', 'híbrido', 'por proyecto'] as const)
      }
    case 'professional_service':
      return {
        service_scope: pick(rng, ['consultoría', 'desarrollo', 'diseño', 'asesoría legal'] as const)
      }
    default:
      return {}
  }
}

export const SYSTEM_STAGE_CODES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const
export const APPLICATION_PUBLIC_STATUSES = [
  'submitted', 'in_review', 'interviewing', 'offer', 'rejected', 'withdrawn', 'hired'
] as const

export function buildSkills(rng: Rng) {
  const count = intBetween(rng, 3, 6)
  const used = new Set<string>()
  const out: { name: string; proficiency: string }[] = []
  while (out.length < count && used.size < SKILLS.length) {
    const name = pick(rng, SKILLS)
    if (used.has(name)) continue
    used.add(name)
    out.push({ name, proficiency: pick(rng, PROFICIENCY) })
  }
  return out
}

export function buildLanguages(rng: Rng) {
  const count = intBetween(rng, 1, 3)
  const used = new Set<string>()
  const out: { name: string; proficiency: string }[] = []
  while (out.length < count && used.size < LANGUAGES.length) {
    const name = pick(rng, LANGUAGES)
    if (used.has(name)) continue
    used.add(name)
    out.push({ name, proficiency: pick(rng, PROFICIENCY) })
  }
  return out
}

export { ROLES, INDUSTRIES, CITIES }
