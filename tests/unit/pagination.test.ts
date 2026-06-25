import { describe, expect, it } from 'vitest'

import { getPaginationItems } from '@/components/ui/pagination-items'

describe('getPaginationItems', () => {
  it('keeps pagination compact near the first page', () => {
    expect(getPaginationItems(0, 10)).toEqual([0, 1, 'ellipsis', 9])
  })

  it('keeps first, last, current siblings, and ellipses for long pagination', () => {
    expect(getPaginationItems(4, 10)).toEqual([0, 'ellipsis', 3, 4, 5, 'ellipsis', 9])
  })

  it('keeps pagination compact near the last page', () => {
    expect(getPaginationItems(9, 10)).toEqual([0, 'ellipsis', 8, 9])
  })

  it('clamps out-of-range pages', () => {
    expect(getPaginationItems(99, 10)).toEqual([0, 'ellipsis', 8, 9])
  })
})
