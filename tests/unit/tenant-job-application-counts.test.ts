import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * TASK-277 — el contador de postulaciones por vacante, después de sacarlo del
 * recorrido del tablero completo.
 *
 * Lo que se vigila es la costura: el RPC devuelve un objeto JSON y la pantalla
 * consume un `Map<string, number>`. Hoy `count(*)` viaja como número JSON, así
 * que la normalización es defensiva; pero si alguna vez llega como cadena —un
 * `::text` de más en el agregado, un bigint serializado— y se guarda sin
 * convertir, la lista ordenada por postulaciones se rompe **en silencio**:
 * `"10" < "9"`. Por eso se prueba con la cadena, que es el caso que el
 * `Number()` existe para atajar; con un número la prueba no diría nada.
 *
 * Y que una vacante ausente signifique cero, que es lo que la pantalla asume.
 */

const rpc = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({ supabase: { rpc } }))

const { fetchTenantJobApplicationCounts } = await import('@/features/jobs/lib/jobs-api')

describe('fetchTenantJobApplicationCounts', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('pide el agregado a la base en una sola llamada', async () => {
    rpc.mockResolvedValue({ data: {}, error: null })

    await fetchTenantJobApplicationCounts('tenant-1')

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('tenant_job_application_counts', { p_tenant_id: 'tenant-1' })
  })

  it('convierte los totales a número, no los deja como cadena', async () => {
    rpc.mockResolvedValue({
      data: { 'job-a': '10', 'job-b': '9' } as unknown as Record<string, number>,
      error: null
    })

    const counts = await fetchTenantJobApplicationCounts('tenant-1')

    expect(counts.get('job-a')).toBe(10)
    expect(counts.get('job-b')).toBe(9)
    expect(typeof counts.get('job-a')).toBe('number')
    // El orden por postulaciones depende de esto: como cadenas, "10" < "9".
    expect((counts.get('job-a') ?? 0) > (counts.get('job-b') ?? 0)).toBe(true)
  })

  it('una vacante ausente es cero, no un hueco', async () => {
    rpc.mockResolvedValue({ data: { 'job-a': 2 }, error: null })

    const counts = await fetchTenantJobApplicationCounts('tenant-1')

    expect(counts.has('job-sin-postulantes')).toBe(false)
    expect(counts.get('job-sin-postulantes') ?? 0).toBe(0)
  })

  it('un tenant sin postulaciones da un mapa vacío, no revienta', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(fetchTenantJobApplicationCounts('tenant-1')).resolves.toEqual(new Map())
  })

  it('un fallo del RPC lanza en vez de devolver contadores en cero', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'insufficient_privilege' } })

    await expect(fetchTenantJobApplicationCounts('tenant-1')).rejects.toMatchObject({
      message: 'insufficient_privilege'
    })
  })
})
