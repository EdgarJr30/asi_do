import { describe, expect, it } from 'vitest'

import {
  applicationMatchesFilter,
  buildApplicationFilterCounts,
  type PublicApplicationStatus
} from '@/features/applications/lib/application-overview-filters'

describe('application overview filters', () => {
  it('groups real public statuses into the compact candidate tabs', () => {
    const statuses: PublicApplicationStatus[] = [
      'submitted',
      'in_review',
      'interviewing',
      'offer',
      'hired',
      'rejected',
      'withdrawn'
    ]

    expect(buildApplicationFilterCounts(statuses)).toEqual({
      all: 7,
      sent: 1,
      review: 3,
      hired: 1
    })
  })

  it('keeps closed statuses visible only in the all filter', () => {
    expect(applicationMatchesFilter('rejected', 'all')).toBe(true)
    expect(applicationMatchesFilter('rejected', 'review')).toBe(false)
    expect(applicationMatchesFilter('withdrawn', 'sent')).toBe(false)
  })
})
