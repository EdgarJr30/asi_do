import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * TASK-276 — el lado cliente del dashboard del workspace, después de mover la
 * agregación a la base.
 *
 * Lo que queda aquí es una sola decisión, y es la que puede regresar en
 * silencio: **el periodo se resuelve contra la medianoche local del navegador**.
 * Si alguien la mueve a UTC, en República Dominicana (UTC-4) las cuatro primeras
 * horas de cada día caen en el periodo equivocado y el dashboard muestra
 * números creíbles y mal contados, sin error de por medio.
 *
 * Lo demás que se vigila: que un fallo del RPC **lance** en vez de devolver un
 * cero, que es la regla que el propio producto ya aprendió («un fallo no se
 * disfraza de vacío»), y que sin periodo no se inventen fronteras.
 */

const rpc = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({ supabase: { rpc } }))

const { fetchWorkspaceDashboardMetrics } = await import('@/features/dashboard/lib/dashboard-api')

const PAYLOAD = {
  stats: { openJobs: 1, activeCandidates: 6, interviews: 2, offers: 2, hired: 1 },
  deltas: { openJobs: 0, activeCandidates: 0, interviews: 0, offers: 0 },
  funnel: [],
  recentApplications: [],
  recentActivity: []
}

function lastArgs() {
  return rpc.mock.calls[0][1] as {
    p_tenant_id: string
    p_period_start: string | null
    p_previous_period_start: string | null
  }
}

describe('fetchWorkspaceDashboardMetrics', () => {
  beforeEach(() => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: PAYLOAD, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pide el agregado a la base en una sola llamada', async () => {
    const metrics = await fetchWorkspaceDashboardMetrics('tenant-1')

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('workspace_dashboard_metrics', expect.anything())
    expect(lastArgs().p_tenant_id).toBe('tenant-1')
    expect(metrics.stats.activeCandidates).toBe(6)
  })

  it('sin periodo no inventa fronteras: las manda nulas', async () => {
    await fetchWorkspaceDashboardMetrics('tenant-1')

    expect(lastArgs().p_period_start).toBeNull()
    expect(lastArgs().p_previous_period_start).toBeNull()
  })

  it('ancla el periodo en la medianoche local, no en la de UTC', async () => {
    // 02:30 local. Con medianoche UTC el inicio del periodo se iría al día
    // anterior y arrastraría postulaciones que no son de este periodo.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 10, 2, 30, 0))

    await fetchWorkspaceDashboardMetrics('tenant-1', { periodDays: 7 })

    const inicio = new Date(lastArgs().p_period_start as string)
    expect(inicio.getHours()).toBe(0)
    expect(inicio.getMinutes()).toBe(0)
    expect(inicio.getSeconds()).toBe(0)
    // 7 días contando hoy: del 4 al 10.
    expect(inicio.getDate()).toBe(4)
    expect(inicio.getMonth()).toBe(7)
  })

  it('el periodo anterior es el mismo tramo, inmediatamente antes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 10, 2, 30, 0))

    await fetchWorkspaceDashboardMetrics('tenant-1', { periodDays: 7 })

    const inicio = new Date(lastArgs().p_period_start as string)
    const anterior = new Date(lastArgs().p_previous_period_start as string)
    const dias = (inicio.getTime() - anterior.getTime()) / (1000 * 60 * 60 * 24)
    expect(dias).toBe(7)
  })

  it('un fallo del RPC lanza en vez de devolver un dashboard en cero', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'insufficient_privilege' } })

    await expect(fetchWorkspaceDashboardMetrics('tenant-1')).rejects.toMatchObject({
      message: 'insufficient_privilege'
    })
  })
})
