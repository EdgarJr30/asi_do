// Guardas de entorno para el arnés de estrés.
//
// Criterio de aceptación: "Corre solo contra local o entornos de preview/desarrollo
// explícitamente aprobados por defecto. No toca producción por defecto."
//
// Estrategia FAIL-CLOSED: si no hay aprobación explícita y un label de entorno
// no-productivo conocido, se bloquea. Producción se bloquea siempre.

export const ALLOWED_ENV_LABELS = ['local', 'development', 'dev', 'preview', 'test'] as const
export const BLOCKED_ENV_LABELS = ['production', 'prod', 'live'] as const

export type HarnessGuardConfig = {
  supabaseUrl: string
  // HARNESS_ENV: etiqueta declarada del entorno actual.
  envLabel: string | undefined
  // STRESS_HARNESS_ENABLED: debe ser exactamente 'true' para habilitar el arnés.
  enabledFlag: string | undefined
  // Lista negra explícita de URLs/refs de producción (separadas por coma).
  productionTargets: string[]
}

export type HarnessGuardResult = {
  allowed: boolean
  reason: string
  envLabel: string
  projectRef: string
}

export function projectRefFromUrl(supabaseUrl: string): string {
  try {
    const host = new URL(supabaseUrl).host
    // <ref>.supabase.co  ó  127.0.0.1:54321 (local)
    if (host.includes('supabase.co')) return host.split('.')[0]
    return host
  } catch {
    return supabaseUrl
  }
}

function isLocalUrl(supabaseUrl: string): boolean {
  return /127\.0\.0\.1|localhost|::1|kong:8000/.test(supabaseUrl)
}

export function evaluateHarnessGuard(config: HarnessGuardConfig): HarnessGuardResult {
  const projectRef = projectRefFromUrl(config.supabaseUrl)
  const envLabel = (config.envLabel ?? '').trim().toLowerCase()

  const base = { projectRef, envLabel: envLabel || 'unknown' }

  // 1) Interruptor maestro explícito (fail-closed).
  if (config.enabledFlag !== 'true') {
    return {
      ...base,
      allowed: false,
      reason: 'STRESS_HARNESS_ENABLED no está en "true". El arnés está deshabilitado por defecto.'
    }
  }

  // 2) Lista negra de producción por URL/ref.
  const target = config.supabaseUrl.toLowerCase()
  for (const blocked of config.productionTargets) {
    const needle = blocked.trim().toLowerCase()
    if (needle.length > 0 && (target.includes(needle) || projectRef === needle)) {
      return { ...base, allowed: false, reason: `Destino bloqueado por lista negra de producción: "${needle}".` }
    }
  }

  // 3) Etiqueta de entorno productiva bloqueada siempre.
  if ((BLOCKED_ENV_LABELS as readonly string[]).includes(envLabel)) {
    return { ...base, allowed: false, reason: `HARNESS_ENV="${envLabel}" es un entorno de producción. Bloqueado.` }
  }

  // 4) Local siempre permitido si el interruptor está activo.
  if (isLocalUrl(config.supabaseUrl)) {
    return { ...base, allowed: true, reason: 'Entorno local detectado y habilitado.' }
  }

  // 5) Etiqueta no-productiva conocida y aprobada explícitamente.
  if ((ALLOWED_ENV_LABELS as readonly string[]).includes(envLabel)) {
    return { ...base, allowed: true, reason: `Entorno "${envLabel}" aprobado explícitamente.` }
  }

  // 6) Fail-closed: sin etiqueta aprobada, no se permite.
  return {
    ...base,
    allowed: false,
    reason:
      'Sin etiqueta de entorno aprobada. Define HARNESS_ENV a uno de: ' +
      `${ALLOWED_ENV_LABELS.join(', ')} para confirmar que NO es producción.`
  }
}
