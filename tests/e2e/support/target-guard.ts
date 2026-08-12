export type MutatingE2ETarget = {
  allowedRemoteProjectRefs: readonly string[]
  e2eSupabaseUrl: string
  productionProjectRef: string
  targetEnvironment: string
}

/**
 * Allow-list versionada: cambiar secretos o variables de CI no puede ampliar
 * por sí solo los proyectos donde Playwright tiene permiso de escritura.
 */
export const ALLOWED_REMOTE_E2E_PROJECT_REFS = [
  'jgmojkzthfogynqixkob' // development
] as const

const REMOTE_SUPABASE_HOST = /^([a-z0-9-]+)\.supabase\.co$/i
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/**
 * Impide que una suite con `service_role` escriba en producción.
 *
 * Los destinos remotos fallan cerrados: además de declararse development o
 * staging, su project ref debe estar en la allow-list versionada. La referencia
 * productiva añade una segunda negación explícita cuando ese proyecto exista.
 */
export function validateMutatingE2ETarget(target: MutatingE2ETarget): string[] {
  const errors: string[] = []
  const productionProjectRef = target.productionProjectRef.trim().toLowerCase()
  const targetEnvironment = target.targetEnvironment.trim().toLowerCase()
  const allowedRemoteProjectRefs = target.allowedRemoteProjectRefs.map((ref) => ref.trim().toLowerCase())
  let url: URL

  try {
    url = new URL(target.e2eSupabaseUrl)
  } catch {
    errors.push('E2E_SUPABASE_URL debe ser Supabase local o una URL https://<project-ref>.supabase.co.')
    return errors
  }

  const isLocal = LOCAL_HOSTS.has(url.hostname)
  const remoteMatch = url.protocol === 'https:' ? url.hostname.match(REMOTE_SUPABASE_HOST) : null

  if (!isLocal && !remoteMatch) {
    errors.push('E2E_SUPABASE_URL debe ser Supabase local o una URL https://<project-ref>.supabase.co.')
    return errors
  }

  if (targetEnvironment === 'production') {
    errors.push('E2E_TARGET_ENV=production prohíbe pruebas que crean, modifican o eliminan datos.')
  } else if (!['development', 'staging'].includes(targetEnvironment)) {
    errors.push('E2E_TARGET_ENV debe ser development o staging para pruebas que modifican datos.')
  }

  if (isLocal) {
    return errors
  }

  const remoteProjectRef = remoteMatch![1].toLowerCase()

  if (!allowedRemoteProjectRefs.includes(remoteProjectRef)) {
    errors.push(`El proyecto ${remoteProjectRef} no está autorizado para E2E mutantes en la allow-list del repositorio.`)
  }

  if (productionProjectRef && remoteProjectRef === productionProjectRef) {
    errors.push(`E2E_SUPABASE_URL apunta al proyecto Supabase de producción (${productionProjectRef}).`)
  }

  return errors
}

// Stryker disable all: este wrapper solo convierte los errores ya probados del
// validador en el mensaje operativo; la decisión de seguridad vive arriba.
export function assertSafeMutatingE2ETarget(target: MutatingE2ETarget) {
  const errors = validateMutatingE2ETarget(target)

  if (errors.length > 0) {
    throw new Error(
      [
        'ESCUDO E2E: ejecución bloqueada antes de usar credenciales administrativas.',
        ...errors.map((error) => `- ${error}`),
        'Las pruebas mutantes solo pueden ejecutarse contra Supabase local, development o staging.',
        'Producción admite únicamente npm run test:e2e:production-smoke, sin service_role.'
      ].join('\n')
    )
  }
}
// Stryker restore all
