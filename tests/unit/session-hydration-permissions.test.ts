import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Hidratación de sesión: los permisos de plataforma salen de UNA consulta.
 *
 * Este test existe porque ningún otro cubría el cambio. Los tests de
 * integración de superficies mockean `@/features/auth/lib/auth-api` entero, así
 * que `fetchSessionSnapshot` —el sitio donde vivían las 29 llamadas— nunca se
 * ejecuta en ellos: pasaban en verde tanto con la versión vieja como con la
 * nueva, y con una rota también.
 *
 * Lo que se fija aquí es el contrato que motivó el cambio (R-153):
 *   · una sola llamada, no una por permiso;
 *   · el conjunto que devuelve la base es el que acaba en la sesión;
 *   · un código que este cliente no conoce se descarta en vez de colarse.
 */

const rpc = vi.fn()

vi.mock('@/lib/supabase/client', () => {
  const tabla = (filas: unknown) => {
    const constructor = {
      select: () => constructor,
      eq: () => constructor,
      maybeSingle: () => Promise.resolve({ data: filas, error: null }),
      then: (resolve: (valor: { data: unknown; error: null }) => unknown) =>
        resolve({ data: filas, error: null })
    }
    return constructor
  }

  return {
    supabase: {
      rpc,
      from: (nombre: string) => {
        if (nombre === 'users') return tabla({ id: 'u1', email: 'quien@example.test' })
        // `memberships` y `user_authority_scopes` se resuelven vacíos: aquí solo
        // se mide el camino de los permisos de plataforma.
        return tabla([])
      }
    }
  }
})

const usuario = { id: 'u1' } as Parameters<
  typeof import('@/features/auth/lib/auth-api').fetchSessionSnapshot
>[0]

describe('fetchSessionSnapshot · permisos de plataforma', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  function responderCon(permisos: string[]) {
    rpc.mockImplementation((nombre: string) => {
      if (nombre === 'my_platform_permissions') return Promise.resolve({ data: permisos, error: null })
      if (nombre === 'is_platform_admin') return Promise.resolve({ data: false, error: null })
      if (nombre === 'is_platform_owner') return Promise.resolve({ data: false, error: null })
      return Promise.resolve({ data: null, error: null })
    })
  }

  it('pide los permisos una sola vez, no uno por uno', async () => {
    const { fetchSessionSnapshot } = await import('@/features/auth/lib/auth-api')
    responderCon(['user:read', 'audit_log:read'])

    await fetchSessionSnapshot(usuario)

    const llamadas = rpc.mock.calls.map(([nombre]) => nombre as string)

    expect(llamadas.filter((nombre) => nombre === 'my_platform_permissions')).toHaveLength(1)
    // La regresión que este test previene: volver al abanico de una RPC por
    // permiso, que es lo que llenó los logs del 2026-08-11.
    expect(llamadas).not.toContain('has_platform_permission')
  })

  it('lleva a la sesión el conjunto que devolvió la base', async () => {
    const { fetchSessionSnapshot } = await import('@/features/auth/lib/auth-api')
    responderCon(['user:read', 'audit_log:read'])

    const snapshot = await fetchSessionSnapshot(usuario)

    expect(snapshot.platformPermissions).toEqual(['user:read', 'audit_log:read'])
    expect(snapshot.permissions).toEqual(expect.arrayContaining(['user:read', 'audit_log:read']))
  })

  it('descarta un código que este cliente no conoce', async () => {
    const { fetchSessionSnapshot } = await import('@/features/auth/lib/auth-api')
    // El catálogo de la base puede adelantarse al cliente desplegado: un permiso
    // nuevo no debe entrar sin que el cliente sepa qué significa.
    responderCon(['user:read', 'permiso:que_no_existe_todavia'])

    const snapshot = await fetchSessionSnapshot(usuario)

    expect(snapshot.platformPermissions).toEqual(['user:read'])
  })

  it('sin permisos devuelve una lista vacía, no revienta', async () => {
    const { fetchSessionSnapshot } = await import('@/features/auth/lib/auth-api')
    responderCon([])

    const snapshot = await fetchSessionSnapshot(usuario)

    expect(snapshot.platformPermissions).toEqual([])
  })
})
