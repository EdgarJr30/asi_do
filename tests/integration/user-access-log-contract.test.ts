import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260729130000_user_access_logs.sql'),
  'utf8'
)

describe('user access log database contract', () => {
  it('captures successful Auth sessions without exposing the table directly', () => {
    expect(migration).toContain('create table if not exists public.user_access_logs')
    expect(migration).toContain('after insert or update of refreshed_at, user_agent, ip on auth.sessions')
    expect(migration).toContain('alter table public.user_access_logs enable row level security')
    expect(migration).toContain('revoke all on table public.user_access_logs from anon, authenticated')
  })

  it('keeps admin reads permission-gated and audited', () => {
    expect(migration).toContain('public.has_platform_permission(\'audit_log:read\')')
    expect(migration).toContain('user_access_log.viewed')
    expect(migration).toContain('access_log_review')
    expect(migration).toContain('grant execute on function public.admin_user_access_log_page')
  })

  it('purges access records after the documented retention window', () => {
    expect(migration).toContain("interval '180 days'")
    expect(migration).toContain("'purge-user-access-logs'")
    expect(migration).toContain('private.purge_expired_user_access_logs()')
  })
})
