/**
 * A qué proyecto Supabase puede apuntar cada entorno desplegable.
 *
 * Vive aparte de `required-env.ts` porque tiene **dos consumidores que no se
 * parecen**: el plugin de Vite que valida el build del frontend, y el script que
 * CI ejecuta antes de desplegar las Edge Functions. Duplicar la lista en el
 * workflow habría sido garantizar que las dos copias se separen; y separarse,
 * aquí, significa que una de las dos deja de proteger sin decirlo.
 */

/**
 * Proyectos Supabase que **no** son producción, por ref.
 *
 * Lista versionada, igual que la de `tests/e2e/support/target-guard.ts`: cambiar
 * una variable en el panel de GitHub no puede bastar para publicar producción
 * contra una base que no lo es.
 */
export const NON_PRODUCTION_SUPABASE_PROJECT_REFS = [
  'jgmojkzthfogynqixkob' // development
] as const

const SUPABASE_PROJECT_HOST = /^([a-z0-9-]+)\.supabase\.co$/i

/** Ref del proyecto, o null si la URL no es un host de Supabase alojado. */
export function supabaseProjectRefFromUrl(url: URL | null): string | null {
  if (!url) return null

  const match = url.hostname.match(SUPABASE_PROJECT_HOST)

  return match ? match[1].toLowerCase() : null
}

/** Comparación contra el ref completo, nunca por subcadena. */
export function isNonProductionProjectRef(projectRef: string): boolean {
  const normalized = projectRef.trim().toLowerCase()

  return NON_PRODUCTION_SUPABASE_PROJECT_REFS.some((ref) => ref === normalized)
}

/** Origen canónico de los enlaces de correo (`APP_URL`) de cada entorno. */
export const DEPLOY_ORIGIN_BY_ENVIRONMENT: Record<string, string> = {
  staging: 'https://dev.asidominicana.do',
  production: 'https://asidominicana.do'
}

/**
 * Problemas del destino al que CI iba a desplegar las Edge Functions.
 *
 * El caso que justifica la función: en GitHub, un job con `environment:`
 * **hereda** los vars del repositorio, y el del entorno solo gana si existe. Un
 * environment `production` sin su propio `SUPABASE_PROJECT_REF` recibe el de
 * desarrollo —no vacío, perfectamente válido, y equivocado—, así que
 * comprobar presencia no detecta nada. Es B4 de `SALIDA_A_PRODUCCION.md`: el
 * cron de producción acabaría disparando contra las funciones de desarrollo.
 *
 * Se comprueban las dos direcciones y no solo esa: staging publicando funciones
 * en la base de producción es un cambio sin revisar corriendo contra usuarios
 * reales. Y se comprueba `APP_URL`, que es el origen que el procesador incrusta
 * en cada correo: cruzado, un aviso de staging abre sesión en producción.
 *
 * Devuelve **todos** los problemas: quien configura un entorno nuevo prefiere
 * una lista a tres intentos.
 */
export function validateEdgeDeployTarget(input: {
  environment: string
  projectRef: string
  appUrl: string
}): string[] {
  const environment = input.environment.trim().toLowerCase()
  const projectRef = input.projectRef.trim()
  const appUrl = input.appUrl.trim()
  const problems: string[] = []
  const expectedOrigin = DEPLOY_ORIGIN_BY_ENVIRONMENT[environment]

  if (!projectRef) {
    problems.push(
      `Falta la variable SUPABASE_PROJECT_REF del entorno "${environment || 'sin nombre'}". ` +
        'Configurala en Settings → Environments → ese entorno.'
    )
  } else if (environment === 'production' && isNonProductionProjectRef(projectRef)) {
    problems.push(
      `SUPABASE_PROJECT_REF del entorno production vale "${projectRef}", que es un proyecto de desarrollo. ` +
        'Lo mas probable es que el environment production no defina la suya y este heredando la del repositorio: ' +
        'definela en Settings → Environments → production.'
    )
  } else if (environment === 'staging' && !isNonProductionProjectRef(projectRef)) {
    problems.push(
      `SUPABASE_PROJECT_REF del entorno staging vale "${projectRef}", que no es un proyecto de no-produccion. ` +
        'Staging no debe publicar Edge Functions en la base de produccion.'
    )
  }

  if (expectedOrigin && appUrl !== expectedOrigin) {
    problems.push(
      `VITE_AUTH_SITE_URL del entorno ${environment} vale "${appUrl || '(vacia)'}" y deberia ser "${expectedOrigin}". ` +
        'Es el origen que viaja dentro de cada correo: cruzado, un enlace de un entorno abre sesion en el otro.'
    )
  }

  return problems
}
