import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

/**
 * Soporte para la prueba e2e de datos en vivo (Supabase Realtime).
 *
 * Esta suite necesita el `service_role` para simular cambios "de otra empresa"
 * en la BD. Por seguridad NO se ejecuta a menos que el entorno esté configurado;
 * `realtimeEnvReady()` decide el skip. En local, los valores se toman de
 * `.env.local` automáticamente; en CI, de variables de entorno reales.
 */

// Carga best-effort de .env.local SOLO para llaves aún no presentes en el entorno.
// CI siempre puede sobrescribir exportando las variables reales.
function loadLocalEnvOnce() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) {
    return
  }
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue
    }
    const i = trimmed.indexOf('=')
    const key = trimmed.slice(0, i).trim()
    const value = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadLocalEnvOnce()

export const realtimeConfig = {
  supabaseUrl: process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
  serviceRoleKey: process.env.E2E_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  // Tenant/empresa semilla ("Empresa Demo") usados como dueños de la vacante de prueba.
  tenantId: process.env.E2E_REALTIME_TENANT_ID ?? 'ac2fe711-a642-4010-b6ee-5b67fe0a8937',
  companyProfileId: process.env.E2E_REALTIME_COMPANY_PROFILE_ID ?? '3f26fb90-5089-4b4e-b31e-5d280a0c1034',
  candidatePassword: process.env.E2E_REALTIME_PASSWORD ?? 'RealtimeTest!2026'
}

export function realtimeEnvReady() {
  return Boolean(realtimeConfig.supabaseUrl && realtimeConfig.serviceRoleKey)
}

export function createServiceClient() {
  return createClient(realtimeConfig.supabaseUrl, realtimeConfig.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export type ServiceClient = ReturnType<typeof createServiceClient>

export interface ProvisionedCandidate {
  userId: string
  email: string
  password: string
}

/**
 * Crea un candidato temporal con acceso ASI (vía `manual_access_override_until`,
 * que saltea el pipeline de membresía) para poder ver el job board en la prueba.
 */
export async function provisionRealtimeCandidate(admin: ServiceClient): Promise<ProvisionedCandidate> {
  const email = `rt-e2e+${Date.now()}@asido.test`
  const password = realtimeConfig.candidatePassword

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Realtime E2E' }
  })
  if (createError) {
    throw createError
  }
  const userId = created.user.id

  // El trigger de sync crea la fila public.users en el alta; esperamos a verla.
  let synced = false
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data } = await admin.from('users').select('id').eq('id', userId).maybeSingle()
    if (data) {
      synced = true
      break
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
  }
  if (!synced) {
    throw new Error('La fila public.users no se creó tras el alta del usuario de prueba.')
  }

  const overrideUntil = new Date(Date.now() + 1000 * 60 * 60).toISOString() // +1h
  const { error: grantError } = await admin
    .from('users')
    .update({ status: 'active', manual_access_override_until: overrideUntil })
    .eq('id', userId)
  if (grantError) {
    throw grantError
  }

  return { userId, email, password }
}

export async function cleanupRealtimeCandidate(admin: ServiceClient, candidate: ProvisionedCandidate | null) {
  if (!candidate) {
    return
  }
  await admin.auth.admin.deleteUser(candidate.userId).catch(() => {})
}
