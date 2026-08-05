import { describe, expect, it } from 'vitest'

import {
  REQUIRED_PRODUCTION_ENV,
  formatEnvValidationError,
  validateProductionEnv
} from '@/shared/config/required-env'

const completeEnv: Record<string, string> = {
  VITE_SUPABASE_URL: 'https://proyecto.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key-de-ejemplo',
  VITE_AZUL_PAYMENTS_URL: 'https://pagos.example.com',
  VITE_AUTH_SITE_URL: 'https://asi-do.netlify.app'
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
    // Netlify devuelve cadena vacia para una variable declarada sin valor, que es
    // el caso que mas facil se cuela: la variable "existe" en el panel.
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
