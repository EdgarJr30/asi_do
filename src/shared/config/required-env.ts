/**
 * Contrato de variables de entorno que un build de produccion no puede omitir.
 *
 * El fallo que esto evita es silencioso, que es lo que lo hace caro:
 * `getSupabaseConfig()` devuelve `null` cuando faltan `VITE_SUPABASE_URL` o
 * `VITE_SUPABASE_ANON_KEY`, y la app arranca igual. Un despliegue con las
 * variables mal puestas no rompe el build ni tira un error visible: publica una
 * aplicacion que no puede autenticar a nadie y que parece "cargando" para
 * siempre. Para cuando alguien lo nota, el artefacto ya esta en produccion.
 *
 * Por eso la validacion corre **en el build**, no en runtime: en runtime ya es
 * tarde, el artefacto esta publicado. Vive en su propio modulo para que la
 * puedan usar el plugin de Vite y las pruebas sin arrastrar `import.meta.env`.
 */

export interface RequiredEnvVar {
  key: string
  why: string
  /** Valida el formato ademas de la presencia, cuando el formato importa. */
  validate?: (value: string) => string | null
}

function mustBeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return `debe ser una URL http(s), no "${url.protocol}"`
    }

    return null
  } catch {
    return 'no es una URL valida'
  }
}

export const REQUIRED_PRODUCTION_ENV: RequiredEnvVar[] = [
  {
    key: 'VITE_SUPABASE_URL',
    why: 'sin ella el cliente de Supabase no se crea y nadie puede iniciar sesion',
    validate: mustBeHttpUrl
  },
  {
    key: 'VITE_SUPABASE_ANON_KEY',
    why: 'sin ella el cliente de Supabase no se crea y nadie puede iniciar sesion'
  },
  {
    key: 'VITE_AZUL_PAYMENTS_URL',
    why: 'sin ella el pago de membresia y las donaciones fallan al enviarse',
    validate: mustBeHttpUrl
  },
  {
    key: 'VITE_AUTH_SITE_URL',
    why: 'sin ella los correos de confirmacion y de recuperacion apuntan al origen del navegador, que en produccion puede no ser el dominio publico',
    validate: mustBeHttpUrl
  }
]

export interface EnvValidationProblem {
  key: string
  problem: string
  why: string
}

/**
 * Devuelve los problemas encontrados. **Nunca incluye el valor de la variable**:
 * este mensaje termina en logs de CI, que no son sitio para una clave.
 */
export function validateProductionEnv(
  source: Record<string, string | undefined>,
  required: RequiredEnvVar[] = REQUIRED_PRODUCTION_ENV
): EnvValidationProblem[] {
  const problems: EnvValidationProblem[] = []

  for (const variable of required) {
    const value = source[variable.key]?.trim()

    if (!value) {
      problems.push({ key: variable.key, problem: 'ausente o vacia', why: variable.why })
      continue
    }

    const formatProblem = variable.validate?.(value)
    if (formatProblem) {
      problems.push({ key: variable.key, problem: formatProblem, why: variable.why })
    }
  }

  return problems
}

/** Mensaje de error listo para abortar el build. Sin valores, solo nombres. */
export function formatEnvValidationError(problems: EnvValidationProblem[]): string {
  const lines = problems.map(
    (problem) => `  · ${problem.key}: ${problem.problem}\n      ${problem.why}`
  )

  return (
    `Build de produccion abortado: ${problems.length} variable(s) de entorno sin configurar.\n\n` +
    `${lines.join('\n')}\n\n` +
    'Configuralas en el entorno del build (Netlify, CI o .env.production) y vuelve a intentar.\n' +
    'Se aborta aqui a proposito: sin estas variables el build termina igual, pero publica una\n' +
    'aplicacion que no puede autenticar ni cobrar, y el fallo no se ve hasta que un usuario lo sufre.'
  )
}
