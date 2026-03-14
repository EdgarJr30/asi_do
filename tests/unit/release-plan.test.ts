import { describe, expect, it } from 'vitest'

import {
  buildReleasePlan,
  getHighestReleaseType,
  parseChangesetEntries
} from '../../scripts/release-plan.mjs'

describe('release plan', () => {
  it('parses package entries from a changeset frontmatter block', () => {
    const entries = parseChangesetEntries(`---
"talent-marketplace-saas": minor
---

Add release planning
`)

    expect(entries).toEqual([
      {
        packageName: 'talent-marketplace-saas',
        releaseType: 'minor'
      }
    ])
  })

  it('uses the highest pending release type to calculate the next version', () => {
    const plan = buildReleasePlan({
      currentVersion: '0.0.1',
      releaseTypes: ['patch', 'minor', 'patch']
    })

    expect(plan).toEqual({
      currentVersion: '0.0.1',
      releaseType: 'minor',
      nextVersion: '0.1.0'
    })
  })

  it('keeps the current version when there are no pending changesets', () => {
    const plan = buildReleasePlan({
      currentVersion: '0.1.0',
      releaseTypes: []
    })

    expect(plan).toEqual({
      currentVersion: '0.1.0',
      releaseType: null,
      nextVersion: '0.1.0'
    })
  })

  it('treats major as the strongest bump type', () => {
    expect(getHighestReleaseType(['patch', 'minor', 'major'])).toBe('major')
  })
})
