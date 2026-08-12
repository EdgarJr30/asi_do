import { describe, expect, it } from 'vitest'

import {
  REQUIRED_PRODUCTION_ENV,
  formatEnvValidationError,
  validateProductionEnv
} from '@/shared/config/required-env'

const completeEnv: Record<string, string> = {
  VITE_DEPLOY_ENV: 'production',
  VITE_SUPABASE_URL: 'https://proyecto.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key-de-ejemplo',
  VITE_AZUL_PAYMENTS_URL: 'https://pagos.example.com',
  VITE_AUTH_SITE_URL: 'https://app.production.example.com',
  VITE_PRODUCTION_SITE_URL: 'https://app.production.example.com'
}

describe('contrato de variables de produccion', () => {
  it('acepta un entorno completo', () => {
    expect(validateProductionEnv(completeEnv)).toEqual([])
  })

  it.each(REQUIRED_PRODUCTION_ENV.map((variable) => variable.key))(
    'rechaza el build cuando falta %s',
    (key) => {
      const incomplete = { ...completeEnv }
      delete incomplete[key]

      const problems = validateProductionEnv(incomplete)

      expect(problems).toHaveLength(1)
      expect(problems[0].key).toBe(key)
    }
  )

  it('trata una variable vacia o de solo espacios como ausente', () => {
    // Un panel de hosting o CI devuelve cadena vacia para una variable declarada
    // sin valor, que es el caso que mas facil se cuela: la variable "existe".
    expect(validateProductionEnv({ ...completeEnv, VITE_SUPABASE_URL: '' })).toHaveLength(1)
    expect(validateProductionEnv({ ...completeEnv, VITE_SUPABASE_URL: '   ' })).toHaveLength(1)
  })

  it('rechaza una URL mal formada aunque este presente', () => {
    const problems = validateProductionEnv({
      ...completeEnv,
      VITE_AZUL_PAYMENTS_URL: 'pagos.example.com'
    })

    expect(problems).toHaveLength(1)
    expect(problems[0].problem).toContain('no es una URL valida')
  })

  it('rechaza un protocolo que no sea http(s)', () => {
    const problems = validateProductionEnv({
      ...completeEnv,
      VITE_SUPABASE_URL: 'ftp://proyecto.supabase.co'
    })

    expect(problems).toHaveLength(1)
    expect(problems[0].problem).toContain('http(s)')
  })

  it('rechaza una URL local en un build de produccion', () => {
    const problems = validateProductionEnv({
      ...completeEnv,
      VITE_AUTH_SITE_URL: 'http://localhost:5173'
    })

    const authProblem = problems.find((problem) => problem.key === 'VITE_AUTH_SITE_URL')
    expect(authProblem?.problem).toContain('local')
  })

  it('rechaza produccion cuando el origen de Auth no coincide con el origen canonico', () => {
    const problems = validateProductionEnv({
      ...completeEnv,
      VITE_AUTH_SITE_URL: 'https://staging.example.com'
    })

    const authProblem = problems.find((problem) => problem.key === 'VITE_AUTH_SITE_URL')
    expect(authProblem?.problem).toContain('produccion')
  })

  it('rechaza staging cuando intenta emitir enlaces hacia produccion', () => {
    const problems = validateProductionEnv({
      ...completeEnv,
      VITE_DEPLOY_ENV: 'staging',
      VITE_AUTH_SITE_URL: completeEnv.VITE_PRODUCTION_SITE_URL
    })

    const authProblem = problems.find((problem) => problem.key === 'VITE_AUTH_SITE_URL')
    expect(authProblem?.problem).toContain('staging')
  })

  it('acepta staging con un origen HTTPS distinto de produccion', () => {
    expect(validateProductionEnv({
      ...completeEnv,
      VITE_DEPLOY_ENV: 'staging',
      VITE_AUTH_SITE_URL: 'https://staging.example.com'
    })).toEqual([])
  })

  it('rechaza un nombre de entorno ambiguo', () => {
    const problems = validateProductionEnv({ ...completeEnv, VITE_DEPLOY_ENV: 'preview' })

    const deployProblem = problems.find((problem) => problem.key === 'VITE_DEPLOY_ENV')
    expect(deployProblem?.problem).toContain('staging')
  })

  // El incidente que motiva estos cuatro: `asidominicana.do` sirvió durante tres
  // días un artefacto subido a mano cuyo bundle apuntaba al proyecto Supabase de
  // **desarrollo**. Quien se registrara ahí quedaba en la base equivocada y sus
  // pagos iban al merchant de pruebas. El build terminaba en verde, porque
  // ninguna de las variables faltaba: estaban todas, y una estaba mal.
  it('rechaza un build de produccion que apunta al proyecto Supabase de desarrollo', () => {
    const problems = validateProductionEnv({
      ...completeEnv,
      VITE_SUPABASE_URL: 'https://jgmojkzthfogynqixkob.supabase.co'
    })

    const supabaseProblem = problems.find((problem) => problem.key === 'VITE_SUPABASE_URL')
    expect(supabaseProblem?.problem).toContain('desarrollo')
  })

  it('no estorba a un build de produccion contra un origen inalcanzable', () => {
    // `verify` construye en modo produccion tambien en CI y en cada laptop, y
    // ahi `VITE_SUPABASE_URL` es la de desarrollo. Si esto fallara, la puerta de
    // calidad quedaria en rojo permanente para todo el mundo — y el reflejo ante
    // eso es quitar la guarda, no arreglar el despliegue.
    for (const origen of ['https://app-de-ci.invalid', 'http://localhost:5173']) {
      expect(validateProductionEnv({
        ...completeEnv,
        VITE_AUTH_SITE_URL: origen,
        VITE_PRODUCTION_SITE_URL: origen,
        VITE_SUPABASE_URL: 'https://jgmojkzthfogynqixkob.supabase.co'
      // `localhost` incumple el requisito de HTTPS, que se comprueba aparte: lo
      // que se afirma aqui es que ninguno de los dos se queja del proyecto.
      }).some((problem) => problem.key === 'VITE_SUPABASE_URL')).toBe(false)
    }
  })

  it('deja a staging usar el proyecto de desarrollo', () => {
    // Staging contra la base de desarrollo es la topología de hoy y es legítima:
    // la prohibición es sobre producción, no sobre cualquier build desplegable.
    expect(validateProductionEnv({
      ...completeEnv,
      VITE_DEPLOY_ENV: 'staging',
      VITE_AUTH_SITE_URL: 'https://staging.example.com',
      VITE_SUPABASE_URL: 'https://jgmojkzthfogynqixkob.supabase.co'
    })).toEqual([])
  })

  it('no se deja engañar por la caja ni por un ref que contenga al prohibido', () => {
    // La caja la resuelve el propio parser —`new URL()` normaliza el host— pero
    // se fija igualmente: si algún día se compara contra el texto crudo en vez
    // de contra el host, esto lo dice.
    const mayusculas = validateProductionEnv({
      ...completeEnv,
      VITE_SUPABASE_URL: 'https://JGMOJKZTHFOGYNQIXKOB.supabase.co'
    })
    expect(mayusculas.some((problem) => problem.key === 'VITE_SUPABASE_URL')).toBe(true)

    // Y no bloquea a un proyecto distinto cuyo ref contenga al prohibido: la
    // comparación es contra el ref completo, no una subcadena. Un falso positivo
    // aquí bloquearía el despliegue de producción que sí es correcto — y el
    // reflejo ante eso es desactivar la guarda.
    const otroProyecto = validateProductionEnv({
      ...completeEnv,
      VITE_SUPABASE_URL: 'https://jgmojkzthfogynqixkobxyz.supabase.co'
    })
    expect(otroProyecto).toEqual([])
  })

  it('reporta todas las que faltan, no solo la primera', () => {
    expect(validateProductionEnv({})).toHaveLength(REQUIRED_PRODUCTION_ENV.length)
  })

  it('nunca filtra el valor de la variable en el mensaje', () => {
    // Este mensaje termina en los logs de CI, que son legibles por mas gente que
    // el panel de variables. Un anon key ahi seria una filtracion nueva creada
    // por la propia validacion.
    const secret = 'clave-super-secreta-que-no-debe-aparecer'
    const problems = validateProductionEnv({
      ...completeEnv,
      VITE_AZUL_PAYMENTS_URL: secret
    })

    const message = formatEnvValidationError(problems)

    expect(message).not.toContain(secret)
    expect(message).toContain('VITE_AZUL_PAYMENTS_URL')
  })
})
