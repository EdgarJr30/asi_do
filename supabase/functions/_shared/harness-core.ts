// Núcleo del arnés de estrés: orquesta la generación masiva de datos sintéticos
// y mide el comportamiento de la base (p50/p95/p99, throughput, error rate, timeouts).
//
// Es agnóstico de runtime: recibe un cliente Supabase ya construido con la
// service_role. La service_role vive SOLO en servidor (Edge Function / script Node),
// nunca en el navegador. RLS no se "bypassa" desde cliente: este código no corre en
// el browser.

import {
  MetricsCollector,
  runWithConcurrency,
  type MetricsSummary
} from './metrics.ts'
import {
  SYNTHETIC_MARKER,
  buildCompany,
  buildJob,
  buildLanguages,
  buildOpportunityMetadata,
  buildPerson,
  buildSkills,
  chance,
  createRng,
  hashSeed,
  intBetween,
  pick,
  syntheticEmail,
  type Rng
} from './synthetic.ts'

// Interfaz mínima del cliente para mantener portabilidad Deno/Node.
export type SupabaseLike = {
  auth: {
    admin: {
      createUser: (attrs: Record<string, unknown>) => Promise<{
        data: { user: { id: string } | null }
        error: { message: string } | null
      }>
    }
  }
  from: (table: string) => any
  rpc: (fn: string, args?: Record<string, unknown>) => any
}

export type HarnessPlan = {
  users: number
  companies: number
  jobs: number
  applications: number
  memberships: number
  donations: number
  notifications: number
}

// Asignación de postulaciones a un usuario administrador real (no sintético),
// para poder ver varias postulaciones "amarradas" a su cuenta.
//   off    → todas las postulaciones usan candidatos sintéticos (comportamiento base)
//   all    → todas las postulaciones se crean a nombre del administrador
//   random → mezcla aleatoria entre el administrador y candidatos sintéticos
export type AdminApplicationsMode = 'off' | 'all' | 'random'

export type AdminApplications = {
  email: string
  mode: AdminApplicationsMode
  // Solo aplica a mode='random': proporción (0..1) de postulaciones del admin.
  ratio?: number
}

export type HarnessOptions = {
  runId: string
  seed: number
  concurrency: number
  timeoutMs: number
  plan: Partial<HarnessPlan>
  // Si es false, se suprimen (borran) las entregas de email pendientes generadas
  // por el run, para no inundar inboxes reales (admins/pastores) en runs grandes.
  sendEmails: boolean
  // Opcional: asocia postulaciones a un administrador real (ver AdminApplications).
  adminApplications?: AdminApplications
  onLog?: (message: string) => void
}

export type HarnessReport = {
  runId: string
  seed: number
  concurrency: number
  startedAt: string
  finishedAt: string
  totalWallClockMs: number
  sendEmails: boolean
  // cuántas entregas de email pendientes se suprimieron (cuando sendEmails=false)
  suppressedEmails: number
  modules: MetricsSummary[]
  totals: {
    operations: number
    ok: number
    errors: number
    timeouts: number
    errorRate: number
    throughputPerSec: number
  }
}

type Ctx = {
  userIds: string[]
  candidateProfileIds: string[]
  tenantIds: string[]
  companyProfileIds: string[]
  jobIds: string[]
  systemStageByCode: Record<string, string>
}

const DEFAULT_PLAN: HarnessPlan = {
  users: 0,
  companies: 0,
  jobs: 0,
  applications: 0,
  memberships: 0,
  donations: 0,
  notifications: 0
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

function isoDaysAhead(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString()
}

async function insertReturningId(
  client: SupabaseLike,
  table: string,
  row: Record<string, unknown>
): Promise<string> {
  const { data, error } = await client.from(table).insert(row).select('id').single()
  if (error) throw new Error(`${table}: ${error.message}`)
  return data.id as string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Reintenta con backoff exponencial. Útil para auth.admin.createUser, que puede
// devolver 429 (rate limit) bajo ráfagas de concurrencia.
async function withRetry<T>(
  operation: () => Promise<T>,
  options: { attempts: number; baseDelayMs: number; isRetryable?: (error: unknown) => boolean }
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (options.isRetryable && !options.isRetryable(error)) throw error
      if (attempt < options.attempts - 1) {
        // backoff exponencial con jitter
        await sleep(options.baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 100))
      }
    }
  }
  throw lastError
}

function isRateLimitOrTransient(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    message.includes('rate') ||
    message.includes('429') ||
    message.includes('too many') ||
    message.includes('timeout') ||
    message.includes('fetch failed') ||
    message.includes('econn') ||
    message.includes('network')
  )
}

// ---------------------------------------------------------------------------
// Helpers que aseguran "padres" existentes para escenarios ejecutados de forma
// independiente (p. ej. correr solo "applications" reutilizando datos previos).
// ---------------------------------------------------------------------------

async function ensureUserPool(client: SupabaseLike, ctx: Ctx, min: number): Promise<void> {
  if (ctx.userIds.length >= min) return
  const { data, error } = await client
    .from('users')
    .select('id')
    .like('email', `stress+%@harness.asido.test`)
    .limit(min)
  if (error) throw new Error(`pool users: ${error.message}`)
  ctx.userIds = (data ?? []).map((r: { id: string }) => r.id)
}

async function ensureCandidatePool(client: SupabaseLike, ctx: Ctx, min: number): Promise<void> {
  if (ctx.candidateProfileIds.length >= min) return
  const { data, error } = await client
    .from('candidate_profiles')
    .select('id, users!inner(email)')
    .like('users.email', `stress+%@harness.asido.test`)
    .limit(min)
  if (error) throw new Error(`pool candidates: ${error.message}`)
  ctx.candidateProfileIds = (data ?? []).map((r: { id: string }) => r.id)
}

async function ensureCompanyPool(client: SupabaseLike, ctx: Ctx, min: number): Promise<void> {
  if (ctx.companyProfileIds.length >= min && ctx.tenantIds.length >= min) return
  const { data, error } = await client
    .from('company_profiles')
    .select('id, tenant_id')
    .contains('profile_metadata', { marker: SYNTHETIC_MARKER })
    .limit(min)
  if (error) throw new Error(`pool companies: ${error.message}`)
  ctx.companyProfileIds = (data ?? []).map((r: { id: string }) => r.id)
  ctx.tenantIds = (data ?? []).map((r: { tenant_id: string }) => r.tenant_id)
}

async function ensureJobPool(client: SupabaseLike, ctx: Ctx, min: number): Promise<void> {
  if (ctx.jobIds.length >= min) return
  const { data, error } = await client
    .from('job_postings')
    .select('id')
    .like('slug', 'harness-%')
    .limit(min)
  if (error) throw new Error(`pool jobs: ${error.message}`)
  ctx.jobIds = (data ?? []).map((r: { id: string }) => r.id)
}

// Resuelve (y si hace falta crea) el perfil de candidato de un administrador real,
// para poder asociarle postulaciones. Devuelve null si el email no existe.
type AdminCandidate = { profileId: string; displayName: string; headline: string; summary: string }

async function resolveAdminCandidate(
  client: SupabaseLike,
  email: string
): Promise<AdminCandidate | null> {
  const { data: userRow, error: userErr } = await client
    .from('users')
    .select('id, display_name, full_name')
    .eq('email', email)
    .maybeSingle()
  if (userErr) throw new Error(`admin lookup: ${userErr.message}`)
  if (!userRow) return null

  const displayName = userRow.full_name || userRow.display_name || email
  const { data: profileRow, error: profErr } = await client
    .from('candidate_profiles')
    .select('id, headline, summary')
    .eq('user_id', userRow.id)
    .maybeSingle()
  if (profErr) throw new Error(`admin profile lookup: ${profErr.message}`)

  if (profileRow) {
    return {
      profileId: profileRow.id as string,
      displayName,
      headline: (profileRow.headline as string) || 'Perfil del administrador',
      summary: (profileRow.summary as string) || 'Perfil del administrador.'
    }
  }

  // No tiene perfil de candidato aún: creamos uno mínimo para sostener postulaciones.
  const headline = 'Perfil del administrador (arnés)'
  const summary = 'Perfil creado por el arnés de estrés para asociar postulaciones de prueba.'
  const profileId = await insertReturningId(client, 'candidate_profiles', {
    user_id: userRow.id,
    headline,
    summary,
    city_name: 'Santo Domingo',
    country_code: 'DO',
    desired_role: 'Administrador',
    visibility: 'public',
    is_visible_to_recruiters: true
  })
  return { profileId, displayName, headline, summary }
}

async function loadSystemStages(client: SupabaseLike, ctx: Ctx): Promise<void> {
  if (Object.keys(ctx.systemStageByCode).length > 0) return
  const { data, error } = await client
    .from('pipeline_stages')
    .select('id, code')
    .is('tenant_id', null)
  if (error) throw new Error(`system stages: ${error.message}`)
  for (const row of data ?? []) ctx.systemStageByCode[row.code] = row.id
}

// ---------------------------------------------------------------------------
// Fases de generación. Cada "operación" cronometrada mapea a un collector.
// ---------------------------------------------------------------------------

async function phaseUsers(client: SupabaseLike, ctx: Ctx, opts: HarnessOptions, count: number) {
  const collector = new MetricsCollector('users')
  const created: string[] = []
  const tasks = Array.from({ length: count }, (_, i) => async () => {
    const rng = createRng(hashSeed(`${opts.runId}:user:${i}`))
    const person = buildPerson(rng)
    const email = syntheticEmail(opts.runId, i)
    // Reintenta ante 429/transitorios: la API de auth limita ráfagas de creación.
    const userId = await withRetry(
      async () => {
        const { data, error } = await client.auth.admin.createUser({
          email,
          password: `Harness!${opts.runId}${i}`,
          email_confirm: true,
          user_metadata: { full_name: person.fullName, display_name: person.firstName, synthetic: true }
        })
        if (error || !data.user) throw new Error(error?.message ?? 'createUser sin usuario')
        return data.user.id
      },
      { attempts: 4, baseDelayMs: 400, isRetryable: isRateLimitOrTransient }
    )
    // El trigger handle_new_user ya creó public.users; completamos atributos.
    const approved = chance(rng, 0.8)
    const membership = pick(rng, ['none', 'pending', 'active', 'grace_period', 'expired'] as const)
    const { error: updErr } = await client
      .from('users')
      .update({
        country_code: person.country,
        phone: person.phone,
        locale: 'es',
        status: 'active',
        user_approval_status: approved ? 'approved' : 'pending_review',
        asi_membership_status: membership,
        membership_activated_at: membership === 'active' ? isoDaysAgo(intBetween(rng, 1, 200)) : null,
        membership_expires_at: membership === 'active' ? isoDaysAhead(intBetween(rng, 30, 365)) : null
      })
      .eq('id', userId)
    if (updErr) throw new Error(`users.update: ${updErr.message}`)
    created.push(userId)
  })

  await runWithConcurrency(tasks, { ...opts, collector })
  ctx.userIds.push(...created)
  opts.onLog?.(`users: ${created.length}/${count} creados`)
  return collector.summary()
}

async function phaseCandidateProfiles(client: SupabaseLike, ctx: Ctx, opts: HarnessOptions) {
  const collector = new MetricsCollector('candidate_profiles')
  await ensureUserPool(client, ctx, ctx.userIds.length)
  const userIds = ctx.userIds
  const created: string[] = []
  const tasks = userIds.map((userId, i) => async () => {
    const rng = createRng(hashSeed(`${opts.runId}:profile:${userId}`))
    const person = buildPerson(rng)
    const profileId = await insertReturningId(client, 'candidate_profiles', {
      user_id: userId,
      headline: `${person.desiredRole} con experiencia`,
      summary: `Profesional sintético de prueba #${i}. ${'Resumen de carrera. '.repeat(3)}`,
      city_name: person.city,
      country_code: person.country,
      desired_role: person.desiredRole,
      visibility: 'public',
      is_visible_to_recruiters: true
    })

    const expCount = intBetween(rng, 1, 3)
    for (let e = 0; e < expCount; e += 1) {
      await client.from('candidate_experiences').insert({
        candidate_profile_id: profileId,
        company_name: `Empresa ${pick(rng, ['Alfa', 'Beta', 'Gamma', 'Delta'] as const)}`,
        role_title: person.desiredRole,
        employment_type: 'full_time',
        city_name: person.city,
        country_code: person.country,
        start_date: isoDaysAgo(intBetween(rng, 400, 2000)).slice(0, 10),
        end_date: e === 0 ? null : isoDaysAgo(intBetween(rng, 30, 399)).slice(0, 10),
        is_current: e === 0,
        sort_order: e
      })
    }
    await client.from('candidate_educations').insert({
      candidate_profile_id: profileId,
      institution_name: 'Universidad Sintética',
      degree_name: pick(rng, ['Licenciatura', 'Ingeniería', 'Maestría', 'Técnico'] as const),
      field_of_study: person.desiredRole,
      start_date: isoDaysAgo(2500).slice(0, 10),
      end_date: isoDaysAgo(1200).slice(0, 10),
      is_current: false,
      sort_order: 0
    })
    const skills = buildSkills(rng).map((s, idx) => ({
      candidate_profile_id: profileId,
      skill_name: s.name,
      proficiency_label: s.proficiency,
      sort_order: idx
    }))
    await client.from('candidate_skills').insert(skills)
    const langs = buildLanguages(rng).map((l, idx) => ({
      candidate_profile_id: profileId,
      language_name: l.name,
      proficiency_label: l.proficiency,
      sort_order: idx
    }))
    await client.from('candidate_languages').insert(langs)
    await client.from('candidate_links').insert({
      candidate_profile_id: profileId,
      link_type: 'linkedin',
      label: 'LinkedIn',
      url: `https://linkedin.example/${profileId}`,
      sort_order: 0
    })
    await client.from('candidate_resumes').insert({
      candidate_profile_id: profileId,
      storage_path: `harness/${profileId}/cv.pdf`,
      filename: 'cv-sintetico.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: intBetween(rng, 50000, 400000),
      is_default: true
    })
    created.push(profileId)
  })

  await runWithConcurrency(tasks, { ...opts, collector })
  ctx.candidateProfileIds.push(...created)
  opts.onLog?.(`candidate_profiles: ${created.length} con experiencias/skills/idiomas/CV`)
  return collector.summary()
}

async function phaseCompanies(client: SupabaseLike, ctx: Ctx, opts: HarnessOptions, count: number) {
  const collector = new MetricsCollector('companies')
  await ensureUserPool(client, ctx, 1)
  const owners = ctx.userIds
  const created: { companyId: string; tenantId: string }[] = []
  const tasks = Array.from({ length: count }, (_, i) => async () => {
    const rng = createRng(hashSeed(`${opts.runId}:company:${i}`))
    const company = buildCompany(rng, i, opts.runId)
    const ownerId = owners.length > 0 ? owners[i % owners.length] : null
    const tenantId = await insertReturningId(client, 'tenants', {
      name: company.displayName,
      slug: `harness-${opts.runId}-t${i}`,
      tenant_kind: pick(rng, ['company', 'ministry', 'project', 'field', 'generic_profile'] as const),
      status: 'active',
      created_by_user_id: ownerId
    })
    const companyId = await insertReturningId(client, 'company_profiles', {
      tenant_id: tenantId,
      display_name: company.displayName,
      legal_name: company.legalName,
      industry: company.industry,
      country_code: company.country,
      company_email: company.email,
      company_phone: company.phone,
      website_url: company.website,
      size_range: company.sizeRange,
      is_public: true,
      profile_metadata: { marker: SYNTHETIC_MARKER, runId: opts.runId, index: i }
    })
    // Vincula al dueño como miembro del tenant (membership de workspace) cuando exista.
    if (ownerId) {
      await client.from('memberships').insert({
        tenant_id: tenantId,
        user_id: ownerId,
        status: 'active',
        invited_by_user_id: ownerId
      })
    }
    created.push({ companyId, tenantId })
  })

  await runWithConcurrency(tasks, { ...opts, collector })
  ctx.companyProfileIds.push(...created.map((c) => c.companyId))
  ctx.tenantIds.push(...created.map((c) => c.tenantId))
  opts.onLog?.(`companies: ${created.length} tenants + company_profiles`)
  return collector.summary()
}

async function phaseJobs(client: SupabaseLike, ctx: Ctx, opts: HarnessOptions, count: number) {
  const collector = new MetricsCollector('jobs')
  await ensureCompanyPool(client, ctx, 1)
  await ensureUserPool(client, ctx, 1)
  const companies = ctx.companyProfileIds
  const tenants = ctx.tenantIds
  if (companies.length === 0) throw new Error('jobs: no hay company_profiles disponibles')
  // El trigger validate_job_posting_tenant_kind exige tenant_kind='company' para
  // opportunity_type='employment'. Como los tenants sintéticos tienen kinds
  // variados, mapeamos kind por tenant para no asignar 'employment' a no-company.
  const kindByTenant = new Map<string, string>()
  {
    const { data, error } = await client
      .from('tenants')
      .select('id, tenant_kind')
      .in('id', tenants)
    if (error) throw new Error(`jobs: tenant kinds: ${error.message}`)
    for (const row of data ?? []) kindByTenant.set(row.id, row.tenant_kind)
  }
  const created: string[] = []
  const tasks = Array.from({ length: count }, (_, i) => async () => {
    const rng = createRng(hashSeed(`${opts.runId}:job:${i}`))
    const job = buildJob(rng, i)
    const idx = i % companies.length
    // Solo tenants 'company' pueden publicar empleos; en el resto, sustituimos
    // 'employment' por otro tipo de oportunidad válido.
    let opportunityType = job.opportunityType
    if (opportunityType === 'employment' && kindByTenant.get(tenants[idx]) !== 'company') {
      opportunityType = pick(rng, ['project', 'volunteer', 'professional_service'] as const)
    }
    const creator = ctx.userIds.length > 0 ? ctx.userIds[i % ctx.userIds.length] : null
    const jobId = await insertReturningId(client, 'job_postings', {
      tenant_id: tenants[idx],
      company_profile_id: companies[idx],
      created_by_user_id: creator,
      title: job.title,
      slug: `harness-${opts.runId}-job-${i}`,
      status: 'published',
      summary: job.summary,
      description: job.description,
      workplace_type: job.workplaceType,
      employment_type: job.employmentType,
      opportunity_type: opportunityType,
      city_name: job.city,
      country_code: job.country,
      salary_visible: chance(rng, 0.6),
      salary_min_amount: job.salaryMin,
      salary_max_amount: job.salaryMax,
      salary_currency: 'DOP',
      experience_level: job.experienceLevel,
      is_featured: chance(rng, 0.15),
      published_at: isoDaysAgo(intBetween(rng, 0, 60)),
      // Incluye los campos de scope que exige el trigger por opportunity_type.
      opportunity_metadata: {
        marker: SYNTHETIC_MARKER,
        runId: opts.runId,
        ...buildOpportunityMetadata(rng, opportunityType)
      }
    })
    const qCount = intBetween(rng, 0, 3)
    for (let q = 0; q < qCount; q += 1) {
      await client.from('job_screening_questions').insert({
        job_posting_id: jobId,
        question_text: `Pregunta de filtro #${q + 1} para ${job.title}`,
        answer_type: pick(rng, ['short_text', 'long_text', 'yes_no', 'single_select'] as const),
        is_required: chance(rng, 0.5),
        sort_order: q
      })
    }
    created.push(jobId)
  })

  await runWithConcurrency(tasks, { ...opts, collector })
  ctx.jobIds.push(...created)
  opts.onLog?.(`jobs: ${created.length} vacantes publicadas`)
  return collector.summary()
}

// Una postulación a generar: a qué vacante, con qué candidato y si es del admin.
type AppAssignment = {
  jobId: string
  candidateProfileId: string
  isAdmin: boolean
  index: number
}

async function phaseApplications(client: SupabaseLike, ctx: Ctx, opts: HarnessOptions, count: number) {
  const collector = new MetricsCollector('applications')
  await loadSystemStages(client, ctx)
  // Solo cargamos vacantes del DB si la corrida no creó ninguna (modo standalone).
  // Si phaseJobs ya pobló ctx.jobIds, usamos esas (no las sobrescribimos con viejas):
  // en modo 'all' cada postulación del admin necesita una vacante distinta, así que la
  // capacidad depende del nº de vacantes disponibles.
  if (ctx.jobIds.length === 0) await ensureJobPool(client, ctx, count)
  const jobs = ctx.jobIds
  if (jobs.length === 0) throw new Error('applications: faltan vacantes')

  // Resuelve (opcionalmente) el candidato administrador real al que amarrar postulaciones.
  const adminConfig = opts.adminApplications
  let admin: AdminCandidate | null = null
  let mode: AdminApplicationsMode = 'off'
  // Vacantes a las que el admin puede postular (excluye las que ya tiene), para que
  // re-ejecutar sea idempotente y no choque con unique(job_posting_id, candidate_profile_id).
  let adminJobs: string[] = []
  if (adminConfig && (adminConfig.mode === 'all' || adminConfig.mode === 'random')) {
    admin = await resolveAdminCandidate(client, adminConfig.email)
    if (admin) {
      mode = adminConfig.mode
      const { data, error } = await client
        .from('applications')
        .select('job_posting_id')
        .eq('candidate_profile_id', admin.profileId)
      if (error) throw new Error(`admin applications: ${error.message}`)
      const used = new Set((data ?? []).map((r: { job_posting_id: string }) => r.job_posting_id))
      adminJobs = jobs.filter((jobId) => !used.has(jobId))
    } else {
      opts.onLog?.(`applications: admin ${adminConfig.email} no encontrado; se usan candidatos sintéticos`)
    }
  }

  const stageForStatus: Record<string, string> = {
    submitted: 'applied',
    in_review: 'screening',
    interviewing: 'interview',
    offer: 'offer',
    hired: 'hired',
    rejected: 'rejected',
    withdrawn: 'rejected'
  }

  // Construye la lista de asignaciones respetando unique(job_posting_id, candidate_profile_id).
  // El admin tiene un único perfil, así que cada postulación suya debe ir a una vacante distinta.
  const assignments: AppAssignment[] = []
  if (mode === 'all' && admin) {
    // Todas a nombre del admin: una por vacante libre (capacidad = #vacantes sin postular).
    const total = Math.min(count, adminJobs.length)
    for (let i = 0; i < total; i += 1) {
      assignments.push({ jobId: adminJobs[i], candidateProfileId: admin.profileId, isAdmin: true, index: i })
    }
    if (adminJobs.length === 0) {
      opts.onLog?.('applications: el admin ya postuló a todas las vacantes disponibles')
    }
  } else {
    // Necesitamos candidatos sintéticos para las postulaciones que no sean del admin.
    await ensureCandidatePool(client, ctx, count)
    const candidates = ctx.candidateProfileIds
    if (candidates.length === 0) throw new Error('applications: faltan candidatos')
    const syntheticCapacity = jobs.length * candidates.length

    if (mode === 'random' && admin) {
      // Mezcla aleatoria: el admin toma vacantes distintas; el resto, pares sintéticos únicos.
      const ratio = Math.min(1, Math.max(0, adminConfig?.ratio ?? 0.4))
      const total = Math.min(count, adminJobs.length + syntheticCapacity)
      let adminCursor = 0
      let synthCursor = 0
      for (let i = 0; i < total; i += 1) {
        const rng = createRng(hashSeed(`${opts.runId}:appmix:${i}`))
        const adminHasRoom = adminCursor < adminJobs.length
        const synthExhausted = synthCursor >= syntheticCapacity
        const useAdmin = adminHasRoom && (synthExhausted || chance(rng, ratio))
        if (useAdmin) {
          assignments.push({ jobId: adminJobs[adminCursor], candidateProfileId: admin.profileId, isAdmin: true, index: i })
          adminCursor += 1
        } else {
          const job = jobs[Math.floor(synthCursor / candidates.length) % jobs.length]
          const candidate = candidates[synthCursor % candidates.length]
          assignments.push({ jobId: job, candidateProfileId: candidate, isAdmin: false, index: i })
          synthCursor += 1
        }
      }
    } else {
      // Base: solo candidatos sintéticos (pares únicos por capacidad).
      const total = Math.min(count, syntheticCapacity)
      for (let i = 0; i < total; i += 1) {
        const job = jobs[Math.floor(i / candidates.length) % jobs.length]
        const candidate = candidates[i % candidates.length]
        assignments.push({ jobId: job, candidateProfileId: candidate, isAdmin: false, index: i })
      }
    }
  }

  const tasks = assignments.map((a) => async () => {
    const rng = createRng(hashSeed(`${opts.runId}:app:${a.index}`))
    const status = pick(rng, [
      'submitted', 'submitted', 'in_review', 'interviewing', 'offer', 'hired', 'rejected'
    ] as const)
    const stageCode = stageForStatus[status]
    await client.from('applications').insert({
      job_posting_id: a.jobId,
      candidate_profile_id: a.candidateProfileId,
      candidate_display_name_snapshot: a.isAdmin && admin ? admin.displayName : `Candidato sintético ${a.index}`,
      candidate_headline_snapshot: a.isAdmin && admin ? admin.headline : 'Perfil de prueba',
      candidate_summary_snapshot: a.isAdmin && admin ? admin.summary : 'Resumen sintético del candidato.',
      cover_letter: chance(rng, 0.5) ? `Carta de presentación sintética #${a.index}.` : null,
      status_public: status,
      current_stage_id: ctx.systemStageByCode[stageCode] ?? null,
      submitted_at: isoDaysAgo(intBetween(rng, 0, 45))
    })
  })

  await runWithConcurrency(tasks, { ...opts, collector })
  const adminCount = assignments.filter((a) => a.isAdmin).length
  opts.onLog?.(
    `applications: ${assignments.length} postulaciones` +
      (adminCount > 0 ? ` (admin: ${adminCount}, sintéticas: ${assignments.length - adminCount})` : '')
  )
  return collector.summary()
}

async function phaseMemberships(client: SupabaseLike, ctx: Ctx, opts: HarnessOptions, count: number) {
  // Membresías institucionales ASI: pagadas (verified) vs no pagadas (submitted/rejected).
  const collector = new MetricsCollector('memberships')
  await ensureUserPool(client, ctx, count)
  const users = ctx.userIds
  if (users.length === 0) throw new Error('memberships: no hay usuarios')
  const categories = [
    { slug: 'regular', name: 'Membresía Regular', dues: '1500' },
    { slug: 'professional', name: 'Membresía Profesional', dues: '3000' },
    { slug: 'student', name: 'Membresía Estudiante', dues: '750' }
  ] as const
  const tasks = Array.from({ length: count }, (_, i) => async () => {
    const rng = createRng(hashSeed(`${opts.runId}:membership:${i}`))
    const user = users[i % users.length]
    const person = buildPerson(rng)
    const category = pick(rng, categories)
    const paid = chance(rng, 0.55) // ~55% pagadas
    const appStatus = paid
      ? 'approved'
      : pick(rng, ['submitted', 'under_review', 'rejected'] as const)
    const applicationId = await insertReturningId(client, 'institutional_membership_applications', {
      requester_user_id: user,
      applicant_email: syntheticEmail(opts.runId, 10000 + i),
      applicant_first_name: person.firstName,
      applicant_last_name: person.lastName,
      applicant_phone: person.phone,
      category_name: category.name,
      category_slug: category.slug,
      church_city: person.city,
      church_state_province: person.country,
      conference_name: 'Conferencia Sintética',
      dues: category.dues,
      home_church_name: 'Iglesia Central Sintética',
      pastor_email: `pastor+${i}@harness.asido.test`,
      pastor_name: `Pastor ${person.lastName}`,
      pastor_phone: person.phone,
      status: appStatus,
      assigned_queue: pick(rng, ['pastor', 'admin'] as const),
      pastoral_reference_status: paid ? 'endorsed' : pick(rng, ['pending', 'contacted'] as const)
    })
    const amount = Number(category.dues)
    await client.from('membership_payments').insert({
      application_id: applicationId,
      member_user_id: user,
      category_slug: category.slug,
      intent: 'membership',
      method: paid ? 'azul_card' : 'manual',
      amount: paid ? amount : null,
      currency: 'DOP',
      term_months: 12,
      status: paid ? 'verified' : pick(rng, ['submitted', 'rejected'] as const),
      gateway: paid ? 'azul' : null,
      verified_at: paid ? isoDaysAgo(intBetween(rng, 0, 60)) : null,
      period_start: paid ? isoDaysAgo(intBetween(rng, 0, 30)).slice(0, 10) : null,
      period_end: paid ? isoDaysAhead(intBetween(rng, 335, 365)).slice(0, 10) : null,
      reference_note: paid ? `AZUL-${opts.runId}-${i}` : 'Pago pendiente',
      order_number: `MBR-${opts.runId}-${i}`
    })
  })

  await runWithConcurrency(tasks, { ...opts, collector })
  opts.onLog?.(`memberships: ${count} solicitudes + pagos (mix pagadas/no pagadas)`)
  return collector.summary()
}

async function phaseDonations(client: SupabaseLike, ctx: Ctx, opts: HarnessOptions, count: number) {
  const collector = new MetricsCollector('donations')
  await ensureUserPool(client, ctx, 1)
  const users = ctx.userIds
  const tasks = Array.from({ length: count }, (_, i) => async () => {
    const rng = createRng(hashSeed(`${opts.runId}:donation:${i}`))
    const settled = chance(rng, 0.6)
    const donor = users.length > 0 && chance(rng, 0.7) ? users[i % users.length] : null
    const person = buildPerson(rng)
    await client.from('donations').insert({
      donor_user_id: donor,
      donor_name: donor ? null : person.fullName,
      donor_email: donor ? null : syntheticEmail(opts.runId, 20000 + i),
      donor_phone: person.phone,
      amount: intBetween(rng, 100, 10000),
      currency: 'DOP',
      custom_amount: chance(rng, 0.4),
      campaign_slug: pick(rng, ['general', 'misiones', 'educacion', 'construccion'] as const),
      designation: pick(rng, ['Fondo general', 'Misiones', 'Becas', null] as const),
      gateway: 'azul',
      method: 'azul_card',
      order_number: `DON-${opts.runId}-${i}`,
      status: settled ? 'verified' : pick(rng, ['initiated', 'failed', 'cancelled'] as const),
      settled_at: settled ? isoDaysAgo(intBetween(rng, 0, 90)) : null,
      gateway_payload: { marker: SYNTHETIC_MARKER, runId: opts.runId }
    })
  })

  await runWithConcurrency(tasks, { ...opts, collector })
  opts.onLog?.(`donations: ${count} (settled + pendientes)`)
  return collector.summary()
}

async function phaseNotifications(client: SupabaseLike, ctx: Ctx, opts: HarnessOptions, count: number) {
  const collector = new MetricsCollector('notifications')
  await ensureUserPool(client, ctx, 1)
  const users = ctx.userIds
  if (users.length === 0) throw new Error('notifications: no hay usuarios')
  const tasks = Array.from({ length: count }, (_, i) => async () => {
    const rng = createRng(hashSeed(`${opts.runId}:notif:${i}`))
    const user = users[i % users.length]
    const type = pick(rng, [
      'application_update', 'membership_update', 'job_match', 'system', 'donation_receipt'
    ] as const)
    await client.from('notifications').insert({
      recipient_user_id: user,
      type,
      title: `Notificación sintética ${i}`,
      body: `Cuerpo de la notificación de prueba #${i} para medir capacidad.`,
      action_url: '/workspace',
      is_test: true, // aísla las notificaciones sintéticas del flujo real
      read_at: chance(rng, 0.4) ? isoDaysAgo(intBetween(rng, 0, 10)) : null,
      payload: { marker: SYNTHETIC_MARKER, runId: opts.runId }
    })
  })

  await runWithConcurrency(tasks, { ...opts, collector })
  opts.onLog?.(`notifications: ${count}`)
  return collector.summary()
}

// ---------------------------------------------------------------------------
// Orquestador principal.
// ---------------------------------------------------------------------------

export async function runHarness(client: SupabaseLike, options: HarnessOptions): Promise<HarnessReport> {
  const plan: HarnessPlan = { ...DEFAULT_PLAN, ...options.plan }
  const startedAt = new Date()
  const ctx: Ctx = {
    userIds: [],
    candidateProfileIds: [],
    tenantIds: [],
    companyProfileIds: [],
    jobIds: [],
    systemStageByCode: {}
  }
  const modules: MetricsSummary[] = []

  // Supresión de correos (garantía sin carrera): encendemos la bandera ANTES de
  // generar nada. El trigger BEFORE INSERT en notification_deliveries omite las
  // entregas de email mientras esté activa, así que el cron nunca tiene qué enviar.
  const suppressEmails = !options.sendEmails
  if (suppressEmails) {
    const { error } = await client.rpc('set_harness_email_suppression', { p_active: true })
    if (error) {
      // Si no podemos activar la supresión, abortamos para no arriesgar correos.
      throw new Error(`No se pudo activar la supresión de correos: ${error.message}`)
    }
    options.onLog?.('supresión de correos ACTIVADA (no se enviará ningún email)')
  }

  let suppressedEmails = 0
  try {
    if (plan.users > 0) {
      modules.push(await phaseUsers(client, ctx, options, plan.users))
      // Perfiles de candidato para los usuarios recién creados.
      modules.push(await phaseCandidateProfiles(client, ctx, options))
    }
    if (plan.companies > 0) modules.push(await phaseCompanies(client, ctx, options, plan.companies))
    if (plan.jobs > 0) modules.push(await phaseJobs(client, ctx, options, plan.jobs))
    if (plan.applications > 0) modules.push(await phaseApplications(client, ctx, options, plan.applications))
    if (plan.memberships > 0) modules.push(await phaseMemberships(client, ctx, options, plan.memberships))
    if (plan.donations > 0) modules.push(await phaseDonations(client, ctx, options, plan.donations))
    if (plan.notifications > 0) modules.push(await phaseNotifications(client, ctx, options, plan.notifications))
  } finally {
    if (suppressEmails) {
      // Belt-and-suspenders: borra cualquier entrega de email pendiente que se
      // hubiera colado, y apaga la bandera SIEMPRE (incluso si una fase falló).
      const sweep = await client
        .from('notification_deliveries')
        .delete()
        .eq('channel', 'email')
        .eq('delivery_status', 'pending')
        .gte('created_at', startedAt.toISOString())
        .select('id')
      if (!sweep.error) suppressedEmails = (sweep.data ?? []).length
      await client.rpc('set_harness_email_suppression', { p_active: false })
      options.onLog?.(`supresión de correos DESACTIVADA (entregas residuales borradas: ${suppressedEmails})`)
    }
  }

  const finishedAt = new Date()
  const totals = modules.reduce(
    (acc, m) => {
      acc.operations += m.count
      acc.ok += m.ok
      acc.errors += m.errors
      acc.timeouts += m.timeouts
      return acc
    },
    { operations: 0, ok: 0, errors: 0, timeouts: 0 }
  )
  const totalWallClockMs = finishedAt.getTime() - startedAt.getTime()

  return {
    runId: options.runId,
    seed: options.seed,
    concurrency: options.concurrency,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    totalWallClockMs,
    sendEmails: options.sendEmails,
    suppressedEmails,
    modules,
    totals: {
      ...totals,
      errorRate: totals.operations === 0 ? 0 : totals.errors / totals.operations,
      throughputPerSec: totalWallClockMs === 0 ? 0 : (totals.operations / totalWallClockMs) * 1000
    }
  }
}

export function resolveSeedPlan(profile: 'smoke' | 'baseline' | 'heavy'): Partial<HarnessPlan> {
  switch (profile) {
    case 'smoke':
      return { users: 5, companies: 5, jobs: 5, applications: 5, memberships: 5, donations: 5, notifications: 5 }
    case 'heavy':
      return {
        users: 200, companies: 100, jobs: 300, applications: 1000,
        memberships: 300, donations: 300, notifications: 500
      }
    case 'baseline':
    default:
      return {
        users: 60, companies: 55, jobs: 60, applications: 60,
        memberships: 60, donations: 55, notifications: 60
      }
  }
}
