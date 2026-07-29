import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const rlsMigration = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260729153000_fix_talent_pool_insert_rls.sql'),
  'utf8'
)
const talentPage = readFileSync(
  resolve(import.meta.dirname, '../../src/features/talent/pages/talent-directory-page.tsx'),
  'utf8'
)

describe('talent pool regression contract', () => {
  it('checks recruiter visibility without inheriting candidate profile RLS', () => {
    expect(rlsMigration).toContain('security definer')
    expect(rlsMigration).toContain('public.is_candidate_profile_visible_to_recruiters(candidate_profile_id)')
    expect(rlsMigration).toContain("public.has_tenant_permission(tenant_id, 'candidate_directory:read')")
    expect(rlsMigration).toContain('saved_by_user_id = auth.uid()')
  })

  it('keeps the detail actions inside the narrow side sheet', () => {
    expect(talentPage).toContain('className="grid grid-cols-2 gap-2"')
    expect(talentPage).toContain('className="col-span-2 inline-flex h-11 w-full min-w-0')
    expect(talentPage).toContain('<ExternalLink className="size-4" /> Ver perfil')
  })

  it('opens and closes candidate detail without returning the list to the first row', () => {
    expect(talentPage).toContain('{ replace: true, preventScrollReset: true }')
  })
})
