import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { Given, Then, When } from '@cucumber/cucumber'

import { getAuthenticatedHomePath } from '../../src/app/router/surface-paths'
import { applicationMatchesFilter, type ApplicationFilter, type PublicApplicationStatus } from '../../src/features/applications/lib/application-overview-filters'
import { sanitizeNextPath } from '../../src/features/auth/lib/auth-callback'
import { hasCompletedBaseOnboarding } from '../../src/features/auth/lib/onboarding-status'
import { jobPostingSchema } from '../../src/features/jobs/lib/job-schemas'
import { hasActiveAsiAccess } from '../../src/lib/auth/asi-access'
import { resolveNotificationTarget } from '../../src/lib/notifications/resolve-target'
import type { AppNotification } from '../../src/lib/notifications/api'
import type { Tables } from '../../src/shared/types/database'

const repoRoot = resolve(import.meta.dirname, '../..')

const contractPaths = {
  deactivateMembership: 'supabase/migrations/20260703120000_deactivate_active_membership.sql',
  submitApplication: 'supabase/migrations/20260625100000_application_submit_pipeline_stage.sql',
  movePipeline: 'supabase/migrations/20260315083000_ats_lite_pipeline.sql',
  publishLimit: 'supabase/migrations/20260315103000_platform_ops_foundations.sql',
  moderation: 'supabase/migrations/20260801150000_p1_fix_broken_rpc_enums_and_ambiguity.sql',
  serviceWorker: 'public/sw.js',
  offlineBanner: 'src/components/ui/offline-banner.tsx'
} as const

interface BusinessWorld {
  requestedPath?: string
  resultPath?: string | null
  profileComplete?: boolean
  hasWorkspaceAccess?: boolean
  accessProfile?: Tables<'users'>
  accessGranted?: boolean
  jobDraft?: Record<string, unknown>
  validationPaths?: string[]
  applicationStatus?: PublicApplicationStatus
  applicationFilter?: ApplicationFilter
  applicationVisible?: boolean
  notification?: AppNotification
  contract?: string
}

function readContract(path: string) {
  return readFileSync(resolve(repoRoot, path), 'utf8')
}

function assertContains(contract: string | undefined, ...fragments: string[]) {
  assert.ok(contract, 'El escenario no cargó su contrato ejecutable')
  for (const fragment of fragments) {
    assert.ok(contract.includes(fragment), `El contrato debe contener: ${fragment}`)
  }
}

function makeValidJobDraft(): Record<string, unknown> {
  return {
    opportunityType: 'employment',
    title: 'Ingeniero de producto',
    slug: 'ingeniero-de-producto',
    summary: 'Oportunidad para construir productos digitales de impacto.',
    description:
      'Buscamos una persona que pueda construir experiencias robustas, colaborar con producto y mantener una base técnica sostenible para el equipo.',
    workplaceType: 'remote',
    employmentType: 'full_time',
    cityName: '',
    countryCode: 'DO',
    compensationVisible: true,
    compensationType: 'salary',
    compensationMinAmount: '2000',
    compensationMaxAmount: '3000',
    compensationCurrency: 'USD',
    experienceLevel: 'Senior',
    expiresAt: '',
    operatingScope: '',
    deliveryTimeline: '',
    engagementModel: '',
    serviceScope: ''
  }
}

Given('un destino solicitado {string}', function (this: BusinessWorld, path: string) {
  this.requestedPath = path
})

When('se valida el destino de autenticación', function (this: BusinessWorld) {
  this.resultPath = sanitizeNextPath(this.requestedPath ?? null)
})

Given('un perfil base {string} y acceso al workspace {string}', function (this: BusinessWorld, profile: string, workspace: string) {
  this.profileComplete = hasCompletedBaseOnboarding(
    profile === 'completo'
      ? { full_name: 'Ana Pérez', display_name: 'Ana', locale: 'es', country_code: 'DO' }
      : { full_name: 'New User', display_name: '', locale: 'es', country_code: '' }
  )
  this.hasWorkspaceAccess = workspace === 'sí'
})

When('se decide la entrada autenticada', function (this: BusinessWorld) {
  this.resultPath = getAuthenticatedHomePath(this.hasWorkspaceAccess ?? false, this.profileComplete ?? false)
})

Then('la ruta resultante debe ser {string}', function (this: BusinessWorld, expectedPath: string) {
  assert.equal(this.resultPath, expectedPath)
})

Given(
  'una cuenta {string} con aprobación {string}, membresía {string} y suscripción {string}',
  function (this: BusinessWorld, account: string, approval: string, membership: string, subscription: string) {
    const future = '2030-01-01T00:00:00.000Z'
    this.accessProfile = {
      status: account === 'activa' ? 'active' : 'inactive',
      user_approval_status: approval === 'aprobada' ? 'approved' : 'pending',
      asi_membership_status:
        membership === 'activa' ? 'active' : membership === 'gracia' ? 'grace_period' : 'suspended',
      user_subscription_status:
        subscription === 'activa' ? 'active' : subscription === 'gracia' ? 'grace_period' : 'ended',
      membership_expires_at: future,
      subscription_expires_at: future,
      manual_access_override_until: null
    } as Tables<'users'>
  }
)

When('se evalúa el acceso ASI protegido', function (this: BusinessWorld) {
  this.accessGranted = hasActiveAsiAccess(this.accessProfile ?? null, new Date('2029-01-01T00:00:00.000Z'))
})

Given('el contrato administrativo de inactivación de membresía', function (this: BusinessWorld) {
  this.contract = readContract(contractPaths.deactivateMembership)
})

When('se inspecciona su efecto persistente', function () {
  // La verificación ocurre sobre la migración versionada que define el RPC.
})

Then('la membresía queda suspendida y la suscripción finalizada', function (this: BusinessWorld) {
  assertContains(this.contract, "asi_membership_status = 'suspended'", "user_subscription_status = 'ended'")
})

Then('la cuenta de usuario no se marca como inactiva', function (this: BusinessWorld) {
  assert.ok(this.contract)
  assert.doesNotMatch(this.contract, /\n\s*status\s*=\s*'inactive'/)
})

Then('se registra el evento auditado {string}', function (this: BusinessWorld, eventType: string) {
  assertContains(this.contract, 'insert into public.audit_logs', `'${eventType}'`)
})

Then('exige autenticación y rol de administrador de plataforma', function (this: BusinessWorld) {
  assertContains(this.contract, 'if auth.uid() is null', 'if not public.is_platform_admin()')
})

Given(
  'una oportunidad válida con compensación visible entre {string} y {string}',
  function (this: BusinessWorld, minimum: string, maximum: string) {
    this.jobDraft = {
      ...makeValidJobDraft(),
      compensationMinAmount: minimum,
      compensationMaxAmount: maximum
    }
  }
)

Given('una oportunidad de proyecto sin alcance operativo ni plazo de entrega', function (this: BusinessWorld) {
  this.jobDraft = {
    ...makeValidJobDraft(),
    opportunityType: 'project',
    operatingScope: '',
    deliveryTimeline: ''
  }
})

When('se valida la oportunidad', function (this: BusinessWorld) {
  const result = jobPostingSchema.safeParse(this.jobDraft)
  this.validationPaths = result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
})

Then('la oportunidad debe ser rechazada por {string}', function (this: BusinessWorld, path: string) {
  assert.ok(this.validationPaths?.includes(path), `Se esperaba un rechazo en ${path}`)
})

Given('el contrato de envío de postulaciones', function (this: BusinessWorld) {
  this.contract = readContract(contractPaths.submitApplication)
})

Then('una postulación duplicada se rechaza con feedback explícito', function (this: BusinessWorld) {
  assertContains(this.contract, "raise exception 'You already applied to this opportunity'")
})

Then('la postulación recibe la etapa inicial {string}', function (this: BusinessWorld, stage: string) {
  assertContains(this.contract, `and code = '${stage}'`, 'current_stage_id')
})

Then('se registra su primera entrada en el historial del pipeline', function (this: BusinessWorld) {
  assertContains(this.contract, 'insert into public.application_stage_history', 'Initial ATS stage assigned on application submit')
})

Given('una postulación con estado {string}', function (this: BusinessWorld, status: PublicApplicationStatus) {
  this.applicationStatus = status
})

When('el candidato consulta el filtro {string}', function (this: BusinessWorld, filter: ApplicationFilter) {
  assert.ok(this.applicationStatus)
  this.applicationFilter = filter
  this.applicationVisible = applicationMatchesFilter(this.applicationStatus, filter)
})

Then('la postulación debe estar {string}', function (this: BusinessWorld, visibility: string) {
  assert.equal(this.applicationVisible, visibility === 'visible')
})

Given('el contrato de movimiento del pipeline', function (this: BusinessWorld) {
  this.contract = readContract(contractPaths.movePipeline)
})

Then('exige el permiso {string} sobre el tenant de la oportunidad', function (this: BusinessWorld, permission: string) {
  assertContains(this.contract, `public.has_tenant_permission(v_job.tenant_id, '${permission}')`)
})

Then('sólo acepta una etapa global o perteneciente al mismo tenant', function (this: BusinessWorld) {
  assertContains(this.contract, 'and (tenant_id is null or tenant_id = v_job.tenant_id)')
})

Then('registra actor, origen y destino en el historial', function (this: BusinessWorld) {
  assertContains(this.contract, 'insert into public.application_stage_history', 'v_from_stage_id', 'v_to_stage.id', 'auth.uid()')
})

Given('el contrato de límites de publicación', function (this: BusinessWorld) {
  this.contract = readContract(contractPaths.publishLimit)
})

Then('cuenta únicamente las oportunidades publicadas del mismo tenant', function (this: BusinessWorld) {
  assertContains(this.contract, 'where jp.tenant_id = new.tenant_id', "and jp.status = 'published'")
})

Then('rechaza una nueva publicación cuando se alcanza el límite', function (this: BusinessWorld) {
  assertContains(this.contract, 'if published_count >= published_limit', "raise exception 'Plan limit reached")
})

Given('el contrato de acciones de moderación', function (this: BusinessWorld) {
  this.contract = readContract(contractPaths.moderation)
})

Then('exige el permiso {string} o administración de plataforma', function (this: BusinessWorld, permission: string) {
  assertContains(this.contract, 'public.is_platform_admin()', `public.has_platform_permission('${permission}')`)
})

Then('registra la acción, el actor y la entidad afectada', function (this: BusinessWorld) {
  assertContains(this.contract, 'insert into public.moderation_actions', 'actor_user_id', "jsonb_build_object('entity_type'")
})

Given('una notificación de tipo {string} con destino {string}', function (this: BusinessWorld, type: string, actionUrl: string) {
  this.notification = makeNotification(type, actionUrl)
})

Given('una notificación de tipo {string} sin destino', function (this: BusinessWorld, type: string) {
  this.notification = makeNotification(type, null)
})

When('se resuelve el destino de la notificación', function (this: BusinessWorld) {
  assert.ok(this.notification)
  this.resultPath = resolveNotificationTarget(this.notification)
})

Then('la notificación no debe navegar', function (this: BusinessWorld) {
  assert.equal(this.resultPath, null)
})

Given('el contrato offline de la PWA', function (this: BusinessWorld) {
  this.contract = `${readContract(contractPaths.serviceWorker)}\n${readContract(contractPaths.offlineBanner)}`
})

Then('una navegación fallida recupera el shell desde caché', function (this: BusinessWorld) {
  assertContains(this.contract, "request.mode === 'navigate'", "cache.match('/index.html')")
})

Then('se informa que se muestra la última información guardada', function (this: BusinessWorld) {
  assertContains(this.contract, 'Estás viendo la última información guardada.')
})

Then('existe una acción explícita para reintentar', function (this: BusinessWorld) {
  assertContains(this.contract, "'Reintentar'", "refetchQueries({ type: 'all' })")
})

function makeNotification(type: string, actionUrl: string | null): AppNotification {
  return {
    id: 'notification-1',
    recipient_user_id: 'user-1',
    tenant_id: null,
    type,
    title: 'Actualización',
    body: 'Hay una actualización disponible.',
    action_url: actionUrl,
    payload: {},
    read_at: null,
    clicked_at: null,
    created_at: '2026-08-05T00:00:00.000Z',
    updated_at: '2026-08-05T00:00:00.000Z'
  }
}
