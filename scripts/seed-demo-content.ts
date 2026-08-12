// Contenido de demostración para grabar el video de la home institucional.
//
// Uso (Node >= 22; corre TypeScript de forma nativa):
//   node scripts/seed-demo-content.ts                              # crea/actualiza el contenido
//   node scripts/seed-demo-content.ts --candidate=correo@x.do      # además deja un CV al candidato
//   node scripts/seed-demo-content.ts --company-owner=correo@x.do  # lo hace dueño de la empresa demo
//   node scripts/seed-demo-content.ts --applicants                 # postulantes para el ATS
//   node scripts/seed-demo-content.ts --recruiter \
//     --recruiter-password=<clave>                                  # cuenta de reclutadora del ATS
//   node scripts/seed-demo-content.ts --clear-application=<correo> # deja regrabar la postulación
//   node scripts/seed-demo-content.ts --purge                      # borra TODO lo sembrado
//
// Por qué existe:
//   La grabación del demo móvil necesita vacantes reales en el board. El proyecto
//   Supabase está vacío, así que este script siembra 4 empresas y 6 vacantes
//   plausibles —y sabe borrarlas—, en vez de dejar datos sueltos que nadie
//   sepa distinguir de los de producción.
//
// Seguridad:
//   - Usa SUPABASE_SERVICE_ROLE_KEY SOLO en este proceso de servidor.
//   - Todo lo que crea queda marcado: `tenants.slug` con prefijo `demo-`,
//     `profile_metadata.demo_seed` y `opportunity_metadata.demo_seed` en `true`.
//     `--purge` se apoya en esas marcas, así que nunca toca datos reales.
//   - Los IDs son fijos: correr el script dos veces no duplica nada.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const DEMO_SLUG_PREFIX = 'demo-'
const DEMO_MARK = { demo_seed: true }
/** Marca en el nombre del archivo para reconocer el CV sembrado y poder borrarlo. */
const DEMO_RESUME_FILENAME = 'CV-demo-ASI.pdf'
/**
 * Dominio de los postulantes de prueba.
 *
 * `.invalid` está reservado por la RFC 2606 justo para esto: no existe ni puede
 * llegar a existir, así que ninguna de estas direcciones va a chocar nunca con
 * la de una persona real ni va a recibir correo por accidente.
 */
const DEMO_APPLICANT_DOMAIN = 'demo.invalid'
/** La empresa cuyo espacio de trabajo se enseña en el video del ATS. */
const DEMO_WORKSPACE_TENANT = `${DEMO_SLUG_PREFIX}nexus-digital`

interface DemoCompany {
  tenantId: string
  companyId: string
  slug: string
  name: string
  legalName: string
  industry: string
  description: string
  city: string
}

interface DemoJob {
  id: string
  companySlug: string
  title: string
  slug: string
  summary: string
  description: string
  workplace: 'on_site' | 'hybrid' | 'remote'
  employment: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship'
  opportunity: 'employment' | 'project' | 'volunteer' | 'professional_service'
  compensationType: 'salary' | 'stipend' | 'budget' | 'unpaid' | 'donation_based' | 'not_disclosed'
  min: number | null
  max: number | null
  currency: string | null
  city: string | null
  experience: string | null
  featured: boolean
  /** Días de antigüedad de la publicación, para que el board no muestre todo "Hoy". */
  publishedDaysAgo: number
  /**
   * Campos que `validate_job_posting_requirements` exige según el tipo:
   * proyecto → `operating_scope` + `delivery_timeline`;
   * voluntariado → `operating_scope` + `engagement_model`.
   */
  metadata?: Record<string, string>
  questions?: Array<{ id: string; text: string; type: 'short_text' | 'long_text'; required: boolean }>
}

const COMPANIES: DemoCompany[] = [
  {
    tenantId: 'd3a70000-0000-4000-8000-000000000001',
    companyId: 'd3a70000-0000-4000-8000-000000000101',
    slug: `${DEMO_SLUG_PREFIX}nexus-digital`,
    name: 'Nexus Digital RD',
    legalName: 'Nexus Digital RD, SRL',
    industry: 'Tecnología y desarrollo de software',
    description:
      'Estudio dominicano de software que acompaña a empresas y ministerios en su transformación digital.',
    city: 'Santo Domingo'
  },
  {
    tenantId: 'd3a70000-0000-4000-8000-000000000002',
    companyId: 'd3a70000-0000-4000-8000-000000000102',
    slug: `${DEMO_SLUG_PREFIX}clinica-vida-plena`,
    name: 'Clínica Vida Plena',
    legalName: 'Centro Médico Vida Plena, SRL',
    industry: 'Salud y bienestar',
    description:
      'Centro médico ambulatorio con enfoque en medicina preventiva y estilo de vida saludable.',
    city: 'Santiago'
  },
  {
    tenantId: 'd3a70000-0000-4000-8000-000000000003',
    companyId: 'd3a70000-0000-4000-8000-000000000103',
    slug: `${DEMO_SLUG_PREFIX}colegio-adventista-del-este`,
    name: 'Colegio Adventista del Este',
    legalName: 'Colegio Adventista del Este, Inc.',
    industry: 'Educación',
    description:
      'Institución educativa de nivel inicial, primario y secundario con formación en valores cristianos.',
    city: 'La Romana'
  },
  {
    tenantId: 'd3a70000-0000-4000-8000-000000000004',
    companyId: 'd3a70000-0000-4000-8000-000000000104',
    slug: `${DEMO_SLUG_PREFIX}fundacion-manos-que-sirven`,
    name: 'Fundación Manos que Sirven',
    legalName: 'Fundación Manos que Sirven, Inc.',
    industry: 'ONG y proyectos sociales',
    description:
      'Organización sin fines de lucro que ejecuta jornadas de salud, alfabetización y ayuda comunitaria.',
    city: 'Santo Domingo'
  }
]

const JOBS: DemoJob[] = [
  {
    id: 'd3a70000-0000-4000-8000-000000000201',
    companySlug: `${DEMO_SLUG_PREFIX}nexus-digital`,
    title: 'Desarrollador Frontend React',
    slug: 'demo-desarrollador-frontend-react',
    summary:
      'Construye interfaces accesibles y rápidas para productos web que usan miles de personas cada día.',
    description: [
      'Buscamos un desarrollador frontend que disfrute el detalle: interfaces claras, accesibles y veloces.',
      '',
      'Lo que harás',
      '· Desarrollar y mantener interfaces en React y TypeScript.',
      '· Traducir diseños a componentes reutilizables del sistema de diseño.',
      '· Cuidar el rendimiento, la accesibilidad y la experiencia en móvil.',
      '· Colaborar con producto y backend en el ciclo completo de cada entrega.',
      '',
      'Lo que buscamos',
      '· 2+ años de experiencia con React y TypeScript.',
      '· Dominio de HTML semántico, CSS moderno y consumo de APIs REST.',
      '· Experiencia trabajando con control de versiones y revisiones de código.',
      '· Comunicación clara y disposición a aprender en equipo.',
      '',
      'Lo que ofrecemos',
      '· Modalidad híbrida: dos días presenciales en Santo Domingo.',
      '· Seguro médico complementario y días de bienestar.',
      '· Presupuesto anual de formación.'
    ].join('\n'),
    workplace: 'hybrid',
    employment: 'full_time',
    opportunity: 'employment',
    compensationType: 'salary',
    min: 65_000,
    max: 95_000,
    currency: 'DOP',
    city: 'Santo Domingo',
    experience: 'Semi Senior',
    featured: true,
    publishedDaysAgo: 2,
    questions: [
      {
        id: 'd3a70000-0000-4000-8000-000000000301',
        text: '¿Cuántos años de experiencia tienes trabajando con React?',
        type: 'short_text',
        required: true
      },
      {
        id: 'd3a70000-0000-4000-8000-000000000302',
        text: '¿Puedes asistir dos días por semana a la oficina en Santo Domingo?',
        type: 'short_text',
        required: true
      }
    ]
  },
  {
    id: 'd3a70000-0000-4000-8000-000000000202',
    companySlug: `${DEMO_SLUG_PREFIX}nexus-digital`,
    title: 'Analista de Datos Junior',
    slug: 'demo-analista-de-datos-junior',
    summary: 'Convierte datos en decisiones: reportes, tableros y métricas para el equipo de producto.',
    description: [
      'Apoyarás al equipo de producto construyendo reportes y tableros que expliquen qué está pasando y por qué.',
      '',
      'Lo que harás',
      '· Preparar y limpiar conjuntos de datos.',
      '· Construir tableros de seguimiento y reportes recurrentes.',
      '· Documentar métricas y su definición.',
      '',
      'Lo que buscamos',
      '· Manejo de SQL y hojas de cálculo avanzadas.',
      '· Curiosidad analítica y orden en la documentación.'
    ].join('\n'),
    workplace: 'remote',
    employment: 'full_time',
    opportunity: 'employment',
    compensationType: 'salary',
    min: 45_000,
    max: 60_000,
    currency: 'DOP',
    city: 'Santo Domingo',
    experience: 'Junior',
    featured: false,
    publishedDaysAgo: 5
  },
  {
    id: 'd3a70000-0000-4000-8000-000000000203',
    companySlug: `${DEMO_SLUG_PREFIX}clinica-vida-plena`,
    title: 'Enfermera(o) de consulta externa',
    slug: 'demo-enfermeria-consulta-externa',
    summary: 'Acompaña a los pacientes en consulta ambulatoria con calidez y rigor clínico.',
    description: [
      'Formarás parte del equipo de consulta externa, en contacto directo con los pacientes.',
      '',
      'Lo que harás',
      '· Tomar signos vitales y preparar al paciente para la consulta.',
      '· Asistir al médico durante los procedimientos ambulatorios.',
      '· Registrar la historia clínica en el sistema.',
      '',
      'Lo que buscamos',
      '· Licenciatura en Enfermería con exequátur vigente.',
      '· Al menos 1 año de experiencia en consulta ambulatoria.'
    ].join('\n'),
    workplace: 'on_site',
    employment: 'full_time',
    opportunity: 'employment',
    compensationType: 'salary',
    min: 38_000,
    max: 46_000,
    currency: 'DOP',
    city: 'Santiago',
    experience: 'Intermedio',
    featured: false,
    publishedDaysAgo: 8
  },
  {
    id: 'd3a70000-0000-4000-8000-000000000204',
    companySlug: `${DEMO_SLUG_PREFIX}colegio-adventista-del-este`,
    title: 'Docente de Matemáticas (Secundaria)',
    slug: 'demo-docente-matematicas-secundaria',
    summary: 'Enseña matemáticas a 7mo y 8vo grado con acompañamiento pedagógico y formación continua.',
    description: [
      'Buscamos un docente que despierte el gusto por las matemáticas y acompañe el proceso de cada estudiante.',
      '',
      'Lo que harás',
      '· Planificar y dictar clases de matemáticas del nivel secundario.',
      '· Dar seguimiento al desempeño de cada estudiante.',
      '· Participar en las actividades formativas de la institución.',
      '',
      'Lo que buscamos',
      '· Licenciatura en Matemáticas o Educación mención Matemáticas.',
      '· Experiencia previa en aula de nivel secundario.'
    ].join('\n'),
    workplace: 'on_site',
    employment: 'full_time',
    opportunity: 'employment',
    compensationType: 'salary',
    min: 42_000,
    max: 55_000,
    currency: 'DOP',
    city: 'La Romana',
    experience: 'Intermedio',
    featured: false,
    publishedDaysAgo: 11
  },
  {
    id: 'd3a70000-0000-4000-8000-000000000205',
    companySlug: `${DEMO_SLUG_PREFIX}fundacion-manos-que-sirven`,
    title: 'Coordinador(a) de Proyectos Sociales',
    slug: 'demo-coordinador-proyectos-sociales',
    summary: 'Lidera la ejecución de jornadas comunitarias: presupuesto, equipo y resultados.',
    description: [
      'Coordinarás los proyectos comunitarios de la fundación de principio a fin.',
      '',
      'Lo que harás',
      '· Planificar cronograma, presupuesto y logística de cada jornada.',
      '· Coordinar voluntarios y aliados institucionales.',
      '· Reportar resultados e indicadores de impacto.',
      '',
      'Lo que buscamos',
      '· Experiencia gestionando proyectos sociales o comunitarios.',
      '· Habilidad para trabajar con equipos voluntarios.'
    ].join('\n'),
    workplace: 'hybrid',
    employment: 'contract',
    opportunity: 'project',
    compensationType: 'budget',
    min: 55_000,
    max: 70_000,
    currency: 'DOP',
    city: 'Santo Domingo',
    experience: 'Senior',
    featured: false,
    publishedDaysAgo: 14,
    metadata: {
      operating_scope: 'Nacional — comunidades del Gran Santo Domingo',
      delivery_timeline: '6 meses, con posibilidad de extensión'
    }
  },
  {
    id: 'd3a70000-0000-4000-8000-000000000206',
    companySlug: `${DEMO_SLUG_PREFIX}fundacion-manos-que-sirven`,
    title: 'Voluntario(a) de logística — Jornada médica',
    slug: 'demo-voluntario-logistica-jornada-medica',
    summary: 'Apoya la organización de la jornada médica comunitaria de este trimestre.',
    description: [
      'Necesitamos manos para que la jornada médica funcione: registro, orientación y control de insumos.',
      '',
      'Lo que harás',
      '· Recibir y orientar a los asistentes.',
      '· Apoyar el control de insumos y medicamentos.',
      '· Colaborar con el equipo clínico en tareas no asistenciales.',
      '',
      'Lo que buscamos',
      '· Disponibilidad de un sábado al mes.',
      '· Trato amable y disposición de servicio.'
    ].join('\n'),
    workplace: 'on_site',
    employment: 'part_time',
    opportunity: 'volunteer',
    compensationType: 'unpaid',
    min: null,
    max: null,
    currency: null,
    city: 'Santo Domingo',
    experience: null,
    featured: false,
    publishedDaysAgo: 20,
    metadata: {
      operating_scope: 'Local — Santo Domingo Este',
      engagement_model: 'Un sábado al mes, jornada completa'
    }
  }
]

/** Postulantes de prueba, repartidos por el proceso de selección. */
const APPLICANTS: Array<{
  name: string
  headline: string
  city: string
  jobSlug: string
  stage: 'applied' | 'screening' | 'interview' | 'offer'
  status: 'submitted' | 'in_review' | 'interviewing' | 'offer'
  daysAgo: number
  coverLetter: string
}> = [
  {
    name: 'María Fernández',
    headline: 'Desarrolladora Frontend · React y TypeScript',
    city: 'Santo Domingo',
    jobSlug: 'demo-desarrollador-frontend-react',
    stage: 'interview',
    status: 'interviewing',
    daysAgo: 6,
    coverLetter: 'Cuatro años construyendo interfaces accesibles. Me entusiasma el enfoque de producto del equipo.'
  },
  {
    name: 'José Ramírez',
    headline: 'Ingeniero de software · Front-end',
    city: 'Santiago',
    jobSlug: 'demo-desarrollador-frontend-react',
    stage: 'screening',
    status: 'in_review',
    daysAgo: 4,
    coverLetter: 'Vengo del mundo del diseño y me pasé al código. Cuido mucho el detalle visual.'
  },
  {
    name: 'Laura Peña',
    headline: 'Desarrolladora web · React, Next.js',
    city: 'Santo Domingo',
    jobSlug: 'demo-desarrollador-frontend-react',
    stage: 'applied',
    status: 'submitted',
    daysAgo: 1,
    coverLetter: 'Busco un equipo donde el trabajo tenga propósito además de calidad técnica.'
  },
  {
    name: 'Carlos Medina',
    headline: 'Analista de datos · SQL y visualización',
    city: 'Santo Domingo',
    jobSlug: 'demo-analista-de-datos-junior',
    stage: 'offer',
    status: 'offer',
    daysAgo: 9,
    coverLetter: 'Me gusta explicar con datos lo que al equipo le cuesta ver. Disponible de inmediato.'
  },
  {
    name: 'Rosa Jiménez',
    headline: 'Analista junior · Reportería y tableros',
    city: 'La Vega',
    jobSlug: 'demo-analista-de-datos-junior',
    stage: 'screening',
    status: 'in_review',
    daysAgo: 3,
    coverLetter: 'Recién graduada, con dos pasantías en análisis de datos y muchas ganas de aprender.'
  },
  {
    name: 'Daniel Castillo',
    headline: 'Business intelligence · Power BI',
    city: 'Santo Domingo',
    jobSlug: 'demo-analista-de-datos-junior',
    stage: 'applied',
    status: 'submitted',
    daysAgo: 2,
    coverLetter: 'Vengo de operaciones y llevo dos años dedicado a reportería y tableros.'
  }
]

function applicantEmail(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
  return `demo.${slug}@${DEMO_APPLICANT_DOMAIN}`
}

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [key, value] = arg.slice(2).split('=')
    out[key] = value === undefined ? true : value
  }
  return out
}

// Lee variables de un archivo .env sin dependencias externas.
function loadEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const content = readFileSync(path, 'utf8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  } catch {
    // archivo ausente: se ignora
  }
  return env
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

/**
 * PDF de una página escrito a mano.
 *
 * Se genera aquí, sin dependencias, porque el único requisito del paso 1 del
 * asistente de postulación es que exista un CV con un nombre y un tamaño
 * creíbles; no hace falta un generador de documentos para eso.
 */
function buildResumePdf(fullName: string): Uint8Array {
  const lines = [
    `(${fullName}) Tj`,
    '0 -28 Td /F1 12 Tf',
    '(Curriculum de demostracion - Plataforma ASI Rep. Dominicana) Tj',
    '0 -22 Td',
    '(Documento generado para la grabacion del demo movil.) Tj',
    '0 -22 Td',
    '(No contiene datos reales de ningun candidato.) Tj'
  ].join('\n')

  const content = `BT /F1 20 Tf 72 720 Td\n${lines}\nET\n`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return new TextEncoder().encode(pdf)
}

async function seed(client: SupabaseClient, candidateEmail: string | null): Promise<void> {
  const tenants = COMPANIES.map((company) => ({
    id: company.tenantId,
    slug: company.slug,
    name: company.name,
    status: 'active' as const,
    tenant_kind: 'company' as const
  }))

  const tenantResponse = await client.from('tenants').upsert(tenants, { onConflict: 'id' })
  if (tenantResponse.error) throw tenantResponse.error

  const companies = COMPANIES.map((company) => ({
    id: company.companyId,
    tenant_id: company.tenantId,
    legal_name: company.legalName,
    display_name: company.name,
    country_code: 'DO',
    industry: company.industry,
    description: company.description,
    size_range: '11-50',
    // Sin `is_public` el join anidado del board devuelve null en silencio y las
    // tarjetas salen sin nombre de empresa (RLS de company_profiles).
    is_public: true,
    profile_kind: 'company' as const,
    profile_metadata: DEMO_MARK
  }))

  const companyResponse = await client.from('company_profiles').upsert(companies, { onConflict: 'id' })
  if (companyResponse.error) throw companyResponse.error

  const companyByTenantSlug = new Map(COMPANIES.map((company) => [company.slug, company]))
  const jobs = JOBS.map((job) => {
    const company = companyByTenantSlug.get(job.companySlug)
    if (!company) throw new Error(`Empresa desconocida: ${job.companySlug}`)

    return {
      id: job.id,
      tenant_id: company.tenantId,
      company_profile_id: company.companyId,
      title: job.title,
      slug: job.slug,
      status: 'published' as const,
      summary: job.summary,
      description: job.description,
      workplace_type: job.workplace,
      employment_type: job.employment,
      city_name: job.city,
      country_code: 'DO',
      salary_visible: job.min != null,
      salary_min_amount: job.min,
      salary_max_amount: job.max,
      salary_currency: job.currency,
      experience_level: job.experience,
      is_featured: job.featured,
      published_at: daysAgo(job.publishedDaysAgo),
      opportunity_type: job.opportunity,
      compensation_type: job.compensationType,
      compensation_min_amount: job.min,
      compensation_max_amount: job.max,
      compensation_currency: job.currency,
      opportunity_metadata: { ...DEMO_MARK, ...(job.metadata ?? {}) }
    }
  })

  const jobResponse = await client.from('job_postings').upsert(jobs, { onConflict: 'id' })
  if (jobResponse.error) throw jobResponse.error

  const questions = JOBS.flatMap((job) =>
    (job.questions ?? []).map((question, index) => ({
      id: question.id,
      job_posting_id: job.id,
      question_text: question.text,
      answer_type: question.type,
      is_required: question.required,
      sort_order: index
    }))
  )

  if (questions.length > 0) {
    const questionResponse = await client
      .from('job_screening_questions')
      .upsert(questions, { onConflict: 'id' })
    if (questionResponse.error) throw questionResponse.error
  }

  console.log(`✓ ${COMPANIES.length} empresas y ${JOBS.length} vacantes publicadas`)

  if (candidateEmail) {
    await seedCandidateResume(client, candidateEmail)
  }
}

/**
 * Da a un usuario la propiedad de la empresa de demostración.
 *
 * Es lo que hace aparecer la sección "Mi empresa" en el sidebar: el shell la
 * añade cuando los permisos incluyen `workspace:read`, y ese permiso llega por
 * la membresía y su rol. Los roles de tenant son globales (`tenant_id is
 * null`), así que basta con enlazar el rol `tenant_owner` que ya existe.
 */
async function seedCompanyOwner(client: SupabaseClient, email: string): Promise<void> {
  const user = await findUserByEmail(client, email)
  if (!user) throw new Error(`No existe una cuenta con el correo ${email}`)

  const company = COMPANIES.find((item) => item.slug === DEMO_WORKSPACE_TENANT)
  if (!company) throw new Error(`No está sembrada la empresa ${DEMO_WORKSPACE_TENANT}`)

  const existing = await client
    .from('memberships')
    .select('id')
    .eq('tenant_id', company.tenantId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing.error) throw existing.error

  let membershipId = existing.data?.id as string | undefined
  if (!membershipId) {
    const created = await client
      .from('memberships')
      .insert({
        tenant_id: company.tenantId,
        user_id: user.id,
        status: 'active',
        joined_at: new Date().toISOString()
      })
      .select('id')
      .single()
    if (created.error) throw created.error
    membershipId = created.data.id as string
  }

  const role = await client
    .from('tenant_roles')
    .select('id')
    .is('tenant_id', null)
    .eq('code', 'tenant_owner')
    .single()
  if (role.error) throw role.error

  const assignment = await client
    .from('membership_roles')
    .upsert(
      {
        membership_id: membershipId,
        role_id: role.data.id as string,
        assigned_at: new Date().toISOString(),
        revoked_at: null
      },
      { onConflict: 'membership_id,role_id' }
    )
  if (assignment.error) throw assignment.error

  console.log(`✓ ${email} es dueño de ${company.name} (aparece "Mi empresa" en el sidebar)`)
}

/**
 * Cuenta de reclutadora para el video del módulo de empresa.
 *
 * Hace falta una cuenta aparte, y no la del dueño real, porque el espacio de
 * trabajo se sirve de la primera membresía activa del usuario: quien pertenece
 * a dos empresas ve la otra. Esta pertenece solo a la empresa de demostración,
 * así que el ATS sale con sus vacantes y sus candidatos y no con los de nadie
 * más.
 */
async function seedRecruiter(client: SupabaseClient, password: string): Promise<string> {
  const email = `demo.reclutadora@${DEMO_APPLICANT_DOMAIN}`
  const fullName = 'Patricia Núñez'

  const company = COMPANIES.find((item) => item.slug === DEMO_WORKSPACE_TENANT)
  if (!company) throw new Error(`No está sembrada la empresa ${DEMO_WORKSPACE_TENANT}`)

  let user = await findUserByEmail(client, email)
  if (!user) {
    const account = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })
    if (account.error) throw account.error
    user = account.data.user
  } else {
    const update = await client.auth.admin.updateUserById(user.id, { password })
    if (update.error) throw update.error
  }

  // Onboarding base completo y acceso ASI vigente: sin las dos cosas los guards
  // la mandan al perfil o al panel de membresía en vez de al espacio de trabajo.
  const profile = await client
    .from('users')
    .update({
      full_name: fullName,
      display_name: fullName,
      locale: 'es',
      country_code: 'DO',
      status: 'active',
      manual_access_override_until: '9999-12-31T00:00:00+00:00',
      manual_access_override_reason: 'Cuenta de demostración del módulo de empresa'
    })
    .eq('id', user.id)
  if (profile.error) throw profile.error

  const existing = await client
    .from('memberships')
    .select('id')
    .eq('tenant_id', company.tenantId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing.error) throw existing.error

  let membershipId = existing.data?.id as string | undefined
  if (!membershipId) {
    const created = await client
      .from('memberships')
      .insert({
        tenant_id: company.tenantId,
        user_id: user.id,
        status: 'active',
        joined_at: new Date().toISOString()
      })
      .select('id')
      .single()
    if (created.error) throw created.error
    membershipId = created.data.id as string
  }

  const role = await client
    .from('tenant_roles')
    .select('id')
    .is('tenant_id', null)
    .eq('code', 'tenant_owner')
    .single()
  if (role.error) throw role.error

  const assignment = await client.from('membership_roles').upsert(
    {
      membership_id: membershipId,
      role_id: role.data.id as string,
      assigned_at: new Date().toISOString(),
      revoked_at: null
    },
    { onConflict: 'membership_id,role_id' }
  )
  if (assignment.error) throw assignment.error

  console.log(`✓ reclutadora de demostración lista: ${email} (${company.name})`)
  return email
}

/**
 * Postulantes de prueba repartidos por el proceso de selección.
 *
 * Sin ellos el espacio de la empresa se ve vacío —cero candidatos, tablero sin
 * tarjetas— y no hay nada que enseñar. Cada uno necesita su cuenta porque el
 * perfil de candidato cuelga de un usuario real.
 */
async function seedApplicants(client: SupabaseClient): Promise<void> {
  const stages = await client.from('pipeline_stages').select('id, code').is('tenant_id', null)
  if (stages.error) throw stages.error
  const stageByCode = new Map((stages.data ?? []).map((row) => [row.code as string, row.id as string]))

  const jobs = await client
    .from('job_postings')
    .select('id, slug')
    .in('slug', [...new Set(APPLICANTS.map((applicant) => applicant.jobSlug))])
  if (jobs.error) throw jobs.error
  const jobBySlug = new Map((jobs.data ?? []).map((row) => [row.slug as string, row.id as string]))

  let created = 0
  for (const applicant of APPLICANTS) {
    const email = applicantEmail(applicant.name)
    const jobId = jobBySlug.get(applicant.jobSlug)
    if (!jobId) throw new Error(`Falta la vacante ${applicant.jobSlug}`)

    let user = await findUserByEmail(client, email)
    if (!user) {
      const account = await client.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID(),
        user_metadata: { full_name: applicant.name }
      })
      if (account.error) throw account.error
      user = account.data.user
      created += 1
    }

    const profileUpsert = await client
      .from('candidate_profiles')
      .upsert(
        {
          user_id: user.id,
          headline: applicant.headline,
          city_name: applicant.city,
          country_code: 'DO',
          visibility: 'public',
          is_visible_to_recruiters: true
        },
        { onConflict: 'user_id' }
      )
      .select('id')
      .single()
    if (profileUpsert.error) throw profileUpsert.error

    // El nombre visible se guarda en `public.users`, que crea el trigger de alta.
    const nameUpdate = await client
      .from('users')
      .update({ full_name: applicant.name, display_name: applicant.name })
      .eq('id', user.id)
    if (nameUpdate.error) throw nameUpdate.error

    const submittedAt = daysAgo(applicant.daysAgo)
    const application = await client
      .from('applications')
      .upsert(
        {
          job_posting_id: jobId,
          candidate_profile_id: profileUpsert.data.id as string,
          status_public: applicant.status,
          cover_letter: applicant.coverLetter,
          candidate_display_name_snapshot: applicant.name,
          candidate_email_snapshot: email,
          candidate_headline_snapshot: applicant.headline,
          current_stage_id: stageByCode.get(applicant.stage) ?? null,
          submitted_at: submittedAt
        },
        { onConflict: 'job_posting_id,candidate_profile_id' }
      )
    if (application.error) throw application.error
  }

  console.log(`✓ ${APPLICANTS.length} postulantes en el proceso de selección (${created} cuentas nuevas)`)
}

async function findUserByEmail(client: SupabaseClient, email: string) {
  const normalized = email.trim().toLowerCase()
  // `listUsers` pagina de 50 en 50; el proyecto tiene pocos usuarios, pero se
  // recorre igual para no depender del tamaño.
  for (let page = 1; page <= 20; page += 1) {
    const response = await client.auth.admin.listUsers({ page, perPage: 200 })
    if (response.error) throw response.error
    const match = response.data.users.find((user) => user.email?.toLowerCase() === normalized)
    if (match) return match
    if (response.data.users.length < 200) break
  }
  return null
}

async function seedCandidateResume(client: SupabaseClient, email: string): Promise<void> {
  const user = await findUserByEmail(client, email)
  if (!user) throw new Error(`No existe una cuenta con el correo ${email}`)

  const profileResponse = await client
    .from('candidate_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profileResponse.error) throw profileResponse.error

  let profileId = profileResponse.data?.id as string | undefined
  if (!profileId) {
    const created = await client
      .from('candidate_profiles')
      .insert({ user_id: user.id })
      .select('id')
      .single()
    if (created.error) throw created.error
    profileId = created.data.id as string
  }

  const existing = await client
    .from('candidate_resumes')
    .select('id')
    .eq('candidate_profile_id', profileId)
    .eq('filename', DEMO_RESUME_FILENAME)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) {
    console.log('✓ el candidato ya tiene el CV de demostración')
    return
  }

  const nameResponse = await client.from('users').select('full_name').eq('id', user.id).maybeSingle()
  const pdf = buildResumePdf((nameResponse.data?.full_name as string | undefined) ?? 'Candidato ASI')
  // Misma convención de ruta que `uploadPrivateFile`: `{userId}/{prefijo}-{uuid}.{ext}`.
  const storagePath = `${user.id}/resume-${crypto.randomUUID()}.pdf`

  const upload = await client.storage
    .from('candidate-resumes')
    .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: false })
  if (upload.error) throw upload.error

  const insert = await client.from('candidate_resumes').insert({
    candidate_profile_id: profileId,
    storage_path: upload.data.path,
    filename: DEMO_RESUME_FILENAME,
    mime_type: 'application/pdf',
    file_size_bytes: pdf.byteLength,
    is_default: true
  })
  if (insert.error) {
    await client.storage.from('candidate-resumes').remove([storagePath])
    throw insert.error
  }

  console.log(`✓ CV de demostración cargado para ${email}`)
}

/**
 * Retira las postulaciones de una persona a las vacantes de demostración.
 *
 * Sirve para poder regrabar: si el candidato ya aplicó, el asistente entra en
 * modo "actualizar CV" y el recorrido del video deja de ser el de alguien que
 * se postula por primera vez.
 */
async function clearApplication(client: SupabaseClient, email: string): Promise<void> {
  const user = await findUserByEmail(client, email)
  if (!user) throw new Error(`No existe una cuenta con el correo ${email}`)

  const profile = await client
    .from('candidate_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profile.error) throw profile.error
  if (!profile.data) {
    console.log(`· ${email} no tiene perfil de candidato`)
    return
  }

  const applications = await client
    .from('applications')
    .select('id')
    .eq('candidate_profile_id', profile.data.id as string)
    .in('job_posting_id', JOBS.map((job) => job.id))
  if (applications.error) throw applications.error

  const ids = (applications.data ?? []).map((row) => row.id as string)
  if (ids.length === 0) {
    console.log(`· ${email} no tiene postulaciones a las vacantes de demostración`)
    return
  }

  for (const table of ['application_answers', 'application_notes', 'application_ratings', 'application_stage_history']) {
    const response = await client.from(table).delete().in('application_id', ids)
    if (response.error) throw response.error
  }
  const removal = await client.from('applications').delete().in('id', ids)
  if (removal.error) throw removal.error

  console.log(`✓ retiradas ${ids.length} postulaciones de ${email}`)
}

async function purge(client: SupabaseClient): Promise<void> {
  const jobIds = JOBS.map((job) => job.id)
  const companyIds = COMPANIES.map((company) => company.companyId)
  const tenantIds = COMPANIES.map((company) => company.tenantId)

  // Orden inverso al de creación: primero lo que referencia, después lo referenciado.
  const applications = await client.from('applications').select('id').in('job_posting_id', jobIds)
  if (applications.error) throw applications.error
  const applicationIds = (applications.data ?? []).map((row) => row.id as string)

  if (applicationIds.length > 0) {
    for (const table of ['application_answers', 'application_notes', 'application_ratings', 'application_stage_history']) {
      const response = await client.from(table).delete().in('application_id', applicationIds)
      if (response.error) throw response.error
    }
    const response = await client.from('applications').delete().in('id', applicationIds)
    if (response.error) throw response.error
  }

  for (const [table, column, ids] of [
    ['saved_jobs', 'job_posting_id', jobIds],
    ['job_screening_questions', 'job_posting_id', jobIds],
    ['job_postings', 'id', jobIds],
    ['company_profiles', 'id', companyIds]
  ] as const) {
    const response = await client.from(table).delete().in(column, ids)
    if (response.error) throw response.error
  }

  // El tenant se intenta al final y su fallo no es fatal: el trigger de
  // auditoría inserta una fila en `audit_logs` que referencia al tenant que se
  // acaba de borrar, y la FK lo rechaza. Un tenant sin perfil de empresa ni
  // vacantes no es alcanzable desde la app (su RLS exige ser miembro), así que
  // dejarlo es preferible a tocar la auditoría.
  const tenantResponse = await client.from('tenants').delete().in('id', tenantIds)
  if (tenantResponse.error) {
    console.warn(`· los tenants de demostración quedan (los retiene la auditoría): ${tenantResponse.error.message}`)
  }

  // El CV de demostración: fila + objeto en storage.
  const resumes = await client
    .from('candidate_resumes')
    .select('id, storage_path')
    .eq('filename', DEMO_RESUME_FILENAME)
  if (resumes.error) throw resumes.error

  if ((resumes.data ?? []).length > 0) {
    const paths = resumes.data.map((row) => row.storage_path as string)
    await client.storage.from('candidate-resumes').remove(paths)
    const response = await client
      .from('candidate_resumes')
      .delete()
      .in('id', resumes.data.map((row) => row.id as string))
    if (response.error) throw response.error
  }

  // Las membresías del espacio de trabajo: se borran las de los tenants demo,
  // que son las únicas que este script pudo crear.
  const memberships = await client.from('memberships').select('id').in('tenant_id', tenantIds)
  if (memberships.error) throw memberships.error
  const membershipIds = (memberships.data ?? []).map((row) => row.id as string)
  if (membershipIds.length > 0) {
    const roles = await client.from('membership_roles').delete().in('membership_id', membershipIds)
    if (roles.error) throw roles.error
    const response = await client.from('memberships').delete().in('id', membershipIds)
    if (response.error) throw response.error
  }

  // Las cuentas de los postulantes de prueba. Borrar el usuario de auth arrastra
  // en cascada su fila de `public.users` y su perfil de candidato.
  let removedApplicants = 0
  for (const applicant of APPLICANTS) {
    const user = await findUserByEmail(client, applicantEmail(applicant.name))
    if (!user) continue
    const removal = await client.auth.admin.deleteUser(user.id)
    if (removal.error) throw removal.error
    removedApplicants += 1
  }

  console.log(
    `✓ purgado: ${applicationIds.length} postulaciones, ${jobIds.length} vacantes, ${companyIds.length} empresas, ` +
      `${membershipIds.length} membresías, ${removedApplicants} cuentas de postulante`
  )
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const env = { ...loadEnvFile(resolve(process.cwd(), '.env.local')), ...process.env }

  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? ''
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) {
    console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (revisa .env.local).')
    process.exit(1)
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  if (args.purge) {
    await purge(client)
    return
  }

  if (typeof args['clear-application'] === 'string') {
    await clearApplication(client, args['clear-application'])
    return
  }

  await seed(client, typeof args.candidate === 'string' ? args.candidate : null)

  if (typeof args['company-owner'] === 'string') {
    await seedCompanyOwner(client, args['company-owner'])
  }

  if (args.applicants) {
    await seedApplicants(client)
  }

  if (args.recruiter) {
    const password = typeof args['recruiter-password'] === 'string' ? args['recruiter-password'] : ''
    if (!password) {
      console.error('--recruiter necesita --recruiter-password=<clave> (no se guarda en el repo).')
      process.exit(1)
    }
    await seedRecruiter(client, password)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
