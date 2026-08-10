import { describe, expect, it } from 'vitest'

import { assertSafeMutatingE2ETarget, validateMutatingE2ETarget } from '../e2e/support/target-guard'

const safeTarget = {
  allowedRemoteProjectRefs: ['devprojectref'],
  e2eSupabaseUrl: 'https://devprojectref.supabase.co',
  productionProjectRef: 'prodprojectref',
  targetEnvironment: 'development'
}

describe('mutating E2E target guard', () => {
  it('permite un proyecto remoto no productivo identificado explícitamente', () => {
    expect(validateMutatingE2ETarget(safeTarget)).toEqual([])
    expect(() => assertSafeMutatingE2ETarget(safeTarget)).not.toThrow()
  })

  it('rechaza el project ref productivo aunque las variables E2E lo señalen por error', () => {
    expect(
      validateMutatingE2ETarget({
        ...safeTarget,
        e2eSupabaseUrl: 'https://prodprojectref.supabase.co'
      })
    ).toContain('E2E_SUPABASE_URL apunta al proyecto Supabase de producción (prodprojectref).')
  })

  it('rechaza cualquier suite mutante declarada como producción', () => {
    expect(
      validateMutatingE2ETarget({
        ...safeTarget,
        targetEnvironment: 'production'
      })
    ).toContain('E2E_TARGET_ENV=production prohíbe pruebas que crean, modifican o eliminan datos.')
    expect(() =>
      assertSafeMutatingE2ETarget({ ...safeTarget, targetEnvironment: 'production' })
    ).toThrow('ESCUDO E2E: ejecución bloqueada antes de usar credenciales administrativas.')
  })

  it('falla cerrado si el proyecto remoto no está en la allow-list versionada', () => {
    expect(
      validateMutatingE2ETarget({
        ...safeTarget,
        e2eSupabaseUrl: 'https://unknownproject.supabase.co',
        productionProjectRef: ''
      })
    ).toContain('El proyecto unknownproject no está autorizado para E2E mutantes en la allow-list del repositorio.')
  })

  it('falla cerrado si el entorno remoto no se declara development o staging', () => {
    expect(
      validateMutatingE2ETarget({
        ...safeTarget,
        targetEnvironment: ''
      })
    ).toContain('E2E_TARGET_ENV debe ser development o staging para pruebas que modifican datos.')
  })

  it('permite Supabase local sin una referencia productiva', () => {
    expect(
      validateMutatingE2ETarget({
        allowedRemoteProjectRefs: [],
        e2eSupabaseUrl: 'http://127.0.0.1:54321',
        productionProjectRef: '',
        targetEnvironment: 'development'
      })
    ).toEqual([])

    for (const url of ['http://localhost:54321', 'http://[::1]:54321']) {
      expect(
        validateMutatingE2ETarget({
          allowedRemoteProjectRefs: [],
          e2eSupabaseUrl: url,
          productionProjectRef: '',
          targetEnvironment: 'development'
        })
      ).toEqual([])
    }
  })

  it('rechaza URLs que no identifican un proyecto Supabase remoto válido', () => {
    for (const url of [
      'no-es-una-url',
      'http://devprojectref.supabase.co',
      'https://evil.devprojectref.supabase.co',
      'https://devprojectref.supabase.co.evil.example'
    ]) {
      expect(
        validateMutatingE2ETarget({
          ...safeTarget,
          e2eSupabaseUrl: url
        })
      ).toContain('E2E_SUPABASE_URL debe ser Supabase local o una URL https://<project-ref>.supabase.co.')
    }
  })

  it('normaliza espacios sin debilitar las comparaciones de seguridad', () => {
    expect(
      validateMutatingE2ETarget({
        allowedRemoteProjectRefs: [' devprojectref '],
        e2eSupabaseUrl: ' https://devprojectref.supabase.co ',
        productionProjectRef: '',
        targetEnvironment: ' development '
      })
    ).toEqual([])

    expect(
      validateMutatingE2ETarget({
        ...safeTarget,
        allowedRemoteProjectRefs: ['prodprojectref'],
        e2eSupabaseUrl: 'https://prodprojectref.supabase.co',
        productionProjectRef: ' prodprojectref '
      })
    ).toContain('E2E_SUPABASE_URL apunta al proyecto Supabase de producción (prodprojectref).')
  })
})
