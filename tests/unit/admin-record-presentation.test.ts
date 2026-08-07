import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')

describe('admin record presentation', () => {
  it('shows when each membership application was created', () => {
    const source = readFileSync(
      resolve(repoRoot, 'src/features/membership/pages/membership-console-page.tsx'),
      'utf8'
    )

    expect(source).toContain('Solicitud creada')
    expect(source).toContain('application.created_at')
  })

  it('shows when each platform user was created', () => {
    const source = readFileSync(
      resolve(repoRoot, 'src/features/platform-ops/pages/platform-access-control-page.tsx'),
      'utf8'
    )

    expect(source).toContain('Usuario creado')
    expect(source).toContain('formatDateTime(user.created_at)')
  })
})
