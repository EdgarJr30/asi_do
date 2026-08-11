import { describe, expect, it } from 'vitest'

import {
  NON_PRODUCTION_SUPABASE_PROJECT_REFS,
  validateEdgeDeployTarget
} from '@/shared/config/deploy-target'

/**
 * A qué proyecto Supabase se le despliegan las Edge Functions (TASK-255, D3).
 *
 * El fallo que esto evita es silencioso y del mismo tipo que el del frontend:
 * en GitHub, un job con `environment:` **hereda** los vars del repositorio y el
 * del entorno solo gana si existe. Si el environment `production` no define su
 * propio `SUPABASE_PROJECT_REF`, `main` hereda el de desarrollo y publica ahí
 * las funciones de producción sin que nada falle. Es exactamente B4: el cron de
 * producción terminaría disparando contra las funciones de desarrollo.
 *
 * Comprobar que la variable "no está vacía" no detecta nada de esto, porque la
 * variable heredada tampoco está vacía.
 */

const desarrollo = NON_PRODUCTION_SUPABASE_PROJECT_REFS[0]
const produccion = 'refdeproduccionreal'

const staging = { environment: 'staging', projectRef: desarrollo, appUrl: 'https://dev.asidominicana.do' }
const production = { environment: 'production', projectRef: produccion, appUrl: 'https://asidominicana.do' }

describe('destino de despliegue de Edge Functions', () => {
  it('acepta los dos entornos bien configurados', () => {
    expect(validateEdgeDeployTarget(staging)).toEqual([])
    expect(validateEdgeDeployTarget(production)).toEqual([])
  })

  it('rechaza que produccion despliegue contra un proyecto de desarrollo', () => {
    const problems = validateEdgeDeployTarget({ ...production, projectRef: desarrollo })

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(desarrollo)
    expect(problems[0]).toContain('SUPABASE_PROJECT_REF')
  })

  it('rechaza que staging despliegue contra el proyecto de produccion', () => {
    // La otra dirección importa igual: staging publicando funciones en la base
    // de producción es un cambio no revisado corriendo contra usuarios reales.
    const problems = validateEdgeDeployTarget({ ...staging, projectRef: produccion })

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('SUPABASE_PROJECT_REF')
  })

  it('exige el ref y lo nombra cuando falta', () => {
    for (const projectRef of ['', '   ']) {
      const problems = validateEdgeDeployTarget({ ...staging, projectRef })

      expect(problems).toHaveLength(1)
      expect(problems[0]).toContain('SUPABASE_PROJECT_REF')
    }
  })

  it('no se deja engañar por la caja ni por un ref que contenga al prohibido', () => {
    expect(validateEdgeDeployTarget({
      ...production,
      projectRef: desarrollo.toUpperCase()
    })).toHaveLength(1)

    // Un falso positivo aquí bloquearía el despliegue correcto, y el reflejo
    // ante eso es desactivar la comprobación.
    expect(validateEdgeDeployTarget({ ...production, projectRef: `${desarrollo}xyz` })).toEqual([])
  })

  it('exige que el origen de los enlaces de correo sea el del entorno', () => {
    // `APP_URL` es lo que el procesador incrusta en cada correo. Cruzado, un
    // aviso de staging abriría sesión en la aplicación de producción.
    const cruzado = validateEdgeDeployTarget({ ...staging, appUrl: 'https://asidominicana.do' })
    expect(cruzado).toHaveLength(1)
    expect(cruzado[0]).toContain('VITE_AUTH_SITE_URL')

    expect(validateEdgeDeployTarget({ ...production, appUrl: 'https://dev.asidominicana.do' })).toHaveLength(1)
    expect(validateEdgeDeployTarget({ ...production, appUrl: '' })).toHaveLength(1)
  })

  it('reporta todos los problemas juntos, no solo el primero', () => {
    // Quien configura un entorno nuevo prefiere una lista a tres intentos.
    expect(validateEdgeDeployTarget({
      environment: 'production',
      projectRef: desarrollo,
      appUrl: 'https://dev.asidominicana.do'
    })).toHaveLength(2)
  })

  it('no bloquea un entorno desconocido por el ref', () => {
    // La comprobación de ref es una negativa acotada a los dos entornos
    // conocidos; inventar uno no debe convertirla en un bloqueo sorpresa.
    expect(validateEdgeDeployTarget({
      environment: 'preview',
      projectRef: desarrollo,
      appUrl: ''
    }).some((problem) => problem.includes('SUPABASE_PROJECT_REF'))).toBe(false)
  })
})
