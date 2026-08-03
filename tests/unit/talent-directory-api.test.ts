import { beforeEach, describe, expect, it, vi } from 'vitest'

// Regresión de TASK-268: el directorio pagina por cursor keyset, no por offset,
// y el detalle agregado llega ya resuelto por la RPC en cada fila.
const rpcCalls = vi.hoisted(() => [] as Array<{ fn: string; args: Record<string, unknown> }>)
const rpcResult = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => {
      throw new Error('El directorio no debe consultar tablas directamente')
    }),
    rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args })
      return Promise.resolve({ data: rpcResult.current, error: null })
    })
  }
}))

const cursor = {
  id: 'profile-1',
  score: 80,
  updated_at: '2026-08-01T10:00:00+00:00',
  name: 'ana',
  experiences: 3,
  saved_at: null
}

describe('directorio de talento', () => {
  beforeEach(() => {
    rpcCalls.length = 0
    rpcResult.current = null
  })

  it('pide la primera página sin cursor y devuelve el total', async () => {
    const { searchCandidateDirectoryPage } = await import('@/features/talent/lib/talent-api')
    rpcResult.current = {
      rows: [{ candidate_profile_id: 'profile-1', skill_names: ['SQL'], language_names: ['Español'] }],
      next_cursor: cursor,
      page: { limit: 24, loaded_count: 1, total_count: 1500 }
    }

    const page = await searchCandidateDirectoryPage({ tenantId: 'tenant-1', limit: 24 })

    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0].fn).toBe('search_candidate_profiles')
    expect(rpcCalls[0].args).toMatchObject({
      p_tenant_id: 'tenant-1',
      p_limit: 24,
      p_sort: 'relevance',
      p_saved_only: false
    })
    // Sin cursor la RPC aplica su valor por defecto: primera página.
    expect(rpcCalls[0].args.p_cursor).toBeUndefined()
    expect(page.totalCount).toBe(1500)
    expect(page.nextCursor).toEqual(cursor)
    expect(page.rows[0].skill_names).toEqual(['SQL'])
  })

  it('reenvía el cursor y los filtros, y acepta páginas sin total', async () => {
    const { searchCandidateDirectoryPage } = await import('@/features/talent/lib/talent-api')
    rpcResult.current = { rows: [], next_cursor: null, page: { limit: 24, loaded_count: 0, total_count: null } }

    const page = await searchCandidateDirectoryPage({
      tenantId: 'tenant-1',
      limit: 24,
      cursor,
      query: '  ingeniero  ',
      countryCode: 'DO',
      skill: 'SQL',
      language: 'Español',
      sort: 'name',
      savedOnly: true
    })

    expect(rpcCalls[0].args).toMatchObject({
      p_cursor: cursor,
      p_query: 'ingeniero',
      p_country_code: 'DO',
      p_skill: 'SQL',
      p_language: 'Español',
      p_sort: 'name',
      p_saved_only: true
    })
    expect(page.totalCount).toBeNull()
    expect(page.nextCursor).toBeNull()
    expect(page.rows).toEqual([])
  })
})
