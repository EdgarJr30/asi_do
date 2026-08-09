import { describe, expect, it } from 'vitest'

import { validateAuthTemplateTarget } from '../../scripts/sync-auth-email-template'

const production = {
  deployEnvironment: 'production',
  targetProjectRef: 'prod-project',
  remoteSiteUrl: 'https://asidominicana.do',
  expectedSiteUrl: 'https://asidominicana.do',
  productionProjectRef: 'prod-project',
  productionSiteUrl: 'https://asidominicana.do'
} as const

describe('auth email template synchronization guard', () => {
  it('accepts the production project only when its identity and Site URL match', () => {
    expect(validateAuthTemplateTarget(production)).toEqual([])
  })

  it('rejects a development deployment pointed at production', () => {
    expect(
      validateAuthTemplateTarget({
        ...production,
        deployEnvironment: 'development'
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('project ref de producción'),
        expect.stringContaining('Site URL de producción')
      ])
    )
  })

  it('rejects production when the remote project has a different Site URL', () => {
    expect(
      validateAuthTemplateTarget({
        ...production,
        remoteSiteUrl: 'http://localhost:5173'
      })
    ).toEqual(expect.arrayContaining([expect.stringContaining('Site URL remoto')]))
  })
})
