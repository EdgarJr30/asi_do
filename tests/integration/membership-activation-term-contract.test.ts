import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')
const migrationsRoot = resolve(repoRoot, 'supabase/migrations')

function latestMigrationContaining(fragment: string): string {
  const migrationName = readdirSync(migrationsRoot)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .reverse()
    .find((name) => readFileSync(resolve(migrationsRoot, name), 'utf8').includes(fragment))

  if (!migrationName) {
    throw new Error(`No se encontró una migración que contenga: ${fragment}`)
  }

  return readFileSync(resolve(migrationsRoot, migrationName), 'utf8')
}

describe('membership activation term contract', () => {
  it('keeps an initial payment without a membership term until final activation', () => {
    const migration = latestMigrationContaining('enforce_initial_membership_period_after_activation')

    expect(migration).toContain("if new.intent = 'initial'")
    expect(migration).toContain("v_membership_status is distinct from 'active'")
    expect(migration).toContain('new.period_start := null')
    expect(migration).toContain('new.period_end := null')
  })

  it('starts the paid term when the approver activates the membership', () => {
    const migration = latestMigrationContaining('create or replace function public.activate_member')

    expect(migration).toContain('membership_activated_at = v_now')
    expect(migration).toContain('period_start = v_now::date')
    expect(migration).toContain('period_end = v_expires::date')
  })

  it('does not present payment dates as active membership dates while access is pending', () => {
    const page = readFileSync(
      resolve(repoRoot, 'src/features/membership/pages/membership-status-page.tsx'),
      'utf8'
    )

    expect(page).toContain("const membershipActivatedAt = session.hasActiveAsiAccess")
    expect(page).toContain("const remainingMembership = session.hasActiveAsiAccess")
    expect(page).toContain('La vigencia comenzará cuando un administrador active tu membresía.')
  })
})
