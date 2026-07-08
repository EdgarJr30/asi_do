import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderCalls = vi.hoisted(
  () => [] as Array<{ table: string; column: string; options: { ascending?: boolean } | undefined }>
)

vi.mock('@/lib/supabase/client', () => {
  function createBuilder(table: string) {
    const builder = {
      select: vi.fn(() => builder),
      in: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      not: vi.fn(() => builder),
      range: vi.fn(() => builder),
      order: vi.fn((column: string, options?: { ascending?: boolean }) => {
        orderCalls.push({ table, column, options })
        return builder
      }),
      then: (resolve: (value: { data: unknown[]; error: null; count: number }) => unknown) =>
        Promise.resolve({ data: [], error: null, count: 0 }).then(resolve)
    }
    return builder
  }

  return {
    supabase: {
      from: vi.fn((table: string) => createBuilder(table))
    }
  }
})

describe('membership admin ordering', () => {
  beforeEach(() => {
    orderCalls.length = 0
  })

  it('loads admin membership rows newest first', async () => {
    const { fetchAdminMembershipApplications } = await import('@/features/membership/lib/membership-api')

    await fetchAdminMembershipApplications()

    expect(orderCalls).toContainEqual({
      table: 'institutional_membership_applications',
      column: 'submitted_at',
      options: { ascending: false }
    })
  })

  it('loads paginated admin membership rows newest first', async () => {
    const { fetchAdminMembershipPage } = await import('@/features/membership/lib/membership-api')

    await fetchAdminMembershipPage({ filter: 'all', limit: 10, offset: 0 })

    expect(orderCalls).toContainEqual({
      table: 'institutional_membership_applications',
      column: 'submitted_at',
      options: { ascending: false }
    })
  })

  it('loads pastor membership queue rows newest first', async () => {
    const { fetchPastorMembershipQueue } = await import('@/features/membership/lib/membership-api')

    await fetchPastorMembershipQueue()

    expect(orderCalls).toContainEqual({
      table: 'institutional_membership_applications',
      column: 'submitted_at',
      options: { ascending: false }
    })
  })
})
