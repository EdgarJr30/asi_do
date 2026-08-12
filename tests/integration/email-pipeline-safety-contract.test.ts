import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')
const migrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260810143000_email_pipeline_backpressure.sql'
)
const webhookPath = resolve(repoRoot, 'supabase/functions/resend-webhook/index.ts')
const processorPath = resolve(repoRoot, 'supabase/functions/process-email-deliveries/index.ts')

describe('email pipeline safety contract', () => {
  it('bounds campaigns and the shared queue in PostgreSQL', () => {
    expect(existsSync(migrationPath)).toBe(true)

    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toContain('v_max_broadcast_recipients constant integer := 200')
    expect(migration).toContain('v_queue_capacity constant integer := 500')
    expect(migration).toContain("v_broadcast_cooldown constant interval := interval '10 minutes'")
    expect(migration).toContain("raise exception 'EMAIL_PIPELINE_BACKPRESSURE")
    expect(migration).toContain("raise exception 'EMAIL_BROADCAST_RATE_LIMITED")
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('email_pipeline_enqueue', 0))")
  })

  it('allows only one dispatcher lease and exposes its operational state', () => {
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toContain('create table if not exists private.email_pipeline_control')
    expect(migration).toContain("dispatch_lease_until = v_now + interval '5 minutes'")
    expect(migration).toContain('create or replace function public.release_email_dispatch_lease(')
    expect(migration).toContain('create or replace function public.email_pipeline_guard_status()')
    expect(migration).toContain("'queueCapacity', 500")
    expect(migration).toContain("'maxBroadcastRecipients', 200")
  })

  it('indexes webhook correlation and fails fast at remote boundaries', () => {
    const migration = readFileSync(migrationPath, 'utf8')
    const webhook = readFileSync(webhookPath, 'utf8')
    const processor = readFileSync(processorPath, 'utf8')

    expect(migration).toContain('notification_deliveries_resend_message_idx')
    expect(migration).toContain('(provider_message_id)')
    expect(webhook).toContain('DATABASE_REQUEST_TIMEOUT_MS = 8_000')
    expect(webhook).toContain('fetchWithTimeout(fetch, DATABASE_REQUEST_TIMEOUT_MS)')
    expect(processor).toContain('MAX_DELIVERIES_PER_RUN = 20')
    expect(processor).toContain('DATABASE_REQUEST_TIMEOUT_MS = 8_000')
    expect(processor).toContain("rpc('release_email_dispatch_lease'")
  })
})
