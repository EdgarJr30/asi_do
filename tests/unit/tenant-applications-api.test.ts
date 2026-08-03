import { beforeEach, describe, expect, it, vi } from 'vitest'

// Regresión de TASK-267: el listado del workspace ya no acota por una lista de
// ids de vacantes (que se cortaba en 2000 y omitía postulaciones en silencio),
// sino que delega el scoping por tenant y la paginación keyset en la RPC.
const rpcCalls = vi.hoisted(() => [] as Array<{ fn: string; args: Record<string, unknown> }>)
const rpcResult = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => {
      throw new Error('El listado del workspace no debe consultar tablas directamente')
    }),
    rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args })
      return Promise.resolve({ data: rpcResult.current, error: null })
    })
  }
}))

const cursor = { submitted_at: '2026-08-01T10:00:00+00:00', name: 'Ana', id: 'app-1' }

describe('postulaciones del workspace', () => {
  beforeEach(() => {
    rpcCalls.length = 0
    rpcResult.current = null
  })

  it('pide la primera página sin cursor y devuelve el total', async () => {
    const { listTenantApplicationsPage } = await import('@/features/applications/lib/applications-api')
    rpcResult.current = {
      rows: [{ id: 'app-1' }],
      next_cursor: cursor,
      page: { limit: 12, loaded_count: 1, total_count: 2500 }
    }

    const page = await listTenantApplicationsPage({ tenantId: 'tenant-1', limit: 12 })

    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0].fn).toBe('tenant_applications_page')
    expect(rpcCalls[0].args).toMatchObject({ p_tenant_id: 'tenant-1', p_limit: 12, p_sort: 'recent' })
    // Sin cursor la RPC aplica su valor por defecto: primera página.
    expect(rpcCalls[0].args.p_cursor).toBeUndefined()
    expect(page.totalCount).toBe(2500)
    expect(page.nextCursor).toEqual(cursor)
    expect(page.applications).toHaveLength(1)
  })

  it('reenvía el cursor tal cual y acepta páginas sin total', async () => {
    const { listTenantApplicationsPage } = await import('@/features/applications/lib/applications-api')
    rpcResult.current = { rows: [], next_cursor: null, page: { limit: 12, loaded_count: 0, total_count: null } }

    const page = await listTenantApplicationsPage({
      tenantId: 'tenant-1',
      limit: 12,
      cursor,
      status: 'interviewing',
      query: '  Ana  ',
      sort: 'name'
    })

    expect(rpcCalls[0].args).toMatchObject({
      p_cursor: cursor,
      p_status: 'interviewing',
      p_query: 'Ana',
      p_sort: 'name'
    })
    expect(page.totalCount).toBeNull()
    expect(page.nextCursor).toBeNull()
  })

  it('resuelve las métricas con una sola llamada agregada', async () => {
    const { countTenantApplications } = await import('@/features/applications/lib/applications-api')
    rpcResult.current = {
      total: 2500,
      recent7d: 40,
      interviewing: 500,
      by_status: { submitted: 500, interviewing: 500 }
    }

    const stats = await countTenantApplications('tenant-1')

    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0].fn).toBe('tenant_applications_stats')
    expect(stats).toEqual({
      total: 2500,
      recent7d: 40,
      interviewing: 500,
      byStatus: { submitted: 500, interviewing: 500 }
    })
  })
})
