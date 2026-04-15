import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')
const migrationPath = resolve(repoRoot, 'supabase/migrations/20260314070000_initial_identity_access.sql')
const hardeningMigrationPath = resolve(repoRoot, 'supabase/migrations/20260314073000_identity_access_hardening.sql')
const notificationsMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260314113000_notifications_and_audit_hardening.sql'
)
const pushWorkflowMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260314130000_push_delivery_workflow.sql'
)
const storageAlignmentMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260315023000_align_storage_mime_support_and_limits.sql'
)
const candidateFoundationsMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260315031500_candidate_profile_foundations.sql'
)
const employerTalentMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260315043000_employer_workspace_and_talent_search.sql'
)
const jobsDiscoveryMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260315054500_jobs_and_public_discovery.sql'
)
const applicationsMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260315070000_applications_foundations.sql'
)
const atsLiteMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260315083000_ats_lite_pipeline.sql'
)
const atsLiteFixMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260315090000_ats_lite_stage_history_fix.sql'
)
const platformOpsMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260315103000_platform_ops_foundations.sql'
)
const mvpLaunchReadinessMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260315120000_mvp_launch_readiness.sql'
)
const asiAccessOpportunityKindsMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260415021000_asi_access_and_opportunity_kinds.sql'
)
const asiTypeRequirementsMigrationPath = resolve(
  repoRoot,
  'supabase/migrations/20260415031500_asi_type_requirements.sql'
)

describe('supabase schema contract', () => {
  it('keeps the identity, notification, and push workflow migrations in place', () => {
    expect(existsSync(migrationPath)).toBe(true)
    expect(existsSync(hardeningMigrationPath)).toBe(true)
    expect(existsSync(notificationsMigrationPath)).toBe(true)
    expect(existsSync(pushWorkflowMigrationPath)).toBe(true)
    expect(existsSync(storageAlignmentMigrationPath)).toBe(true)
    expect(existsSync(candidateFoundationsMigrationPath)).toBe(true)
    expect(existsSync(employerTalentMigrationPath)).toBe(true)
    expect(existsSync(jobsDiscoveryMigrationPath)).toBe(true)
    expect(existsSync(applicationsMigrationPath)).toBe(true)
    expect(existsSync(atsLiteMigrationPath)).toBe(true)
    expect(existsSync(atsLiteFixMigrationPath)).toBe(true)
    expect(existsSync(platformOpsMigrationPath)).toBe(true)
    expect(existsSync(mvpLaunchReadinessMigrationPath)).toBe(true)
    expect(existsSync(asiAccessOpportunityKindsMigrationPath)).toBe(true)
    expect(existsSync(asiTypeRequirementsMigrationPath)).toBe(true)
  })

  it('defines the core identity, approval, and storage foundations', () => {
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toContain('create table public.users')
    expect(migration).toContain('create table public.recruiter_requests')
    expect(migration).toContain('create table public.tenants')
    expect(migration).toContain("create or replace function public.bootstrap_first_platform_owner()")
    expect(migration).toContain("create or replace function public.review_recruiter_request(")
    expect(migration).toContain("insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)")
    expect(migration).toContain("'verification-documents'")
  })

  it('keeps the hardening migration that closes initial advisor warnings', () => {
    const migration = readFileSync(hardeningMigrationPath, 'utf8')

    expect(migration).toContain('create or replace function public.set_row_updated_at()')
    expect(migration).toContain('drop policy if exists "users_select_self_or_platform_admin"')
    expect(migration).toContain('create index if not exists recruiter_requests_reviewed_by_user_id_idx')
  })

  it('keeps auditable notification storage and delivery primitives', () => {
    const migration = readFileSync(notificationsMigrationPath, 'utf8')

    expect(migration).toContain('create table if not exists public.notification_preferences')
    expect(migration).toContain('create table if not exists public.notifications')
    expect(migration).toContain('create table if not exists public.push_subscriptions')
    expect(migration).toContain('create table if not exists public.notification_deliveries')
    expect(migration).toContain('create table if not exists public.notification_delivery_logs')
    expect(migration).toContain("create or replace function public.register_push_subscription(")
  })

  it('keeps the push workflow secured behind rls and auditable rpc helpers', () => {
    const migration = readFileSync(pushWorkflowMigrationPath, 'utf8')

    expect(migration).toContain('alter table public.notification_preferences enable row level security;')
    expect(migration).toContain("create or replace function public.upsert_notification_preferences(")
    expect(migration).toContain("create or replace function public.queue_push_notification(")
    expect(migration).toContain("create or replace function public.update_push_delivery_status(")
    expect(migration).toContain("create or replace function public.mark_notification_clicked(")
  })

  it('keeps storage bucket limits and mime support aligned with upload rules', () => {
    const migration = readFileSync(storageAlignmentMigrationPath, 'utf8')

    expect(migration).toContain("where id = 'user-media'")
    expect(migration).toContain("where id = 'company-assets'")
    expect(migration).toContain("where id = 'verification-documents'")
    expect(migration).toContain("'image/svg+xml'")
    expect(migration).toContain("'application/pdf'")
    expect(migration).toContain('file_size_limit = 5242880')
  })

  it('keeps the candidate profile foundations migration in place', () => {
    const migration = readFileSync(candidateFoundationsMigrationPath, 'utf8')

    expect(migration).toContain('create table if not exists public.candidate_profiles')
    expect(migration).toContain('create table if not exists public.candidate_resumes')
    expect(migration).toContain("insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)")
    expect(migration).toContain("'candidate-resumes'")
    expect(migration).toContain('create or replace function public.set_candidate_profile_completeness()')
    expect(migration).toContain("select private.attach_audit_trigger('public', 'candidate_profiles')")
  })

  it('keeps employer foundations and talent search opt-in aligned with the schema contract', () => {
    const migration = readFileSync(employerTalentMigrationPath, 'utf8')

    expect(migration).toContain('add column if not exists is_visible_to_recruiters boolean not null default false')
    expect(migration).toContain("'candidate_directory:read'")
    expect(migration).toContain("'candidate_profile:read_full'")
    expect(migration).toContain("create or replace function public.search_candidate_profiles(")
    expect(migration).toContain("create or replace function public.get_candidate_profile_for_tenant(")
    expect(migration).toContain("'candidate_profile_viewed'")
  })

  it('keeps jobs and discovery foundations aligned with the schema contract', () => {
    const migration = readFileSync(jobsDiscoveryMigrationPath, 'utf8')

    expect(migration).toContain('create type public.job_posting_status as enum')
    expect(migration).toContain('create table if not exists public.job_postings')
    expect(migration).toContain('create table if not exists public.job_screening_questions')
    expect(migration).toContain('create table if not exists public.saved_jobs')
    expect(migration).toContain('create table if not exists public.job_alerts')
    expect(migration).toContain('create policy "job_postings_public_or_tenant_read"')
    expect(migration).toContain("select private.attach_audit_trigger('public', 'job_postings')")
  })

  it('keeps ASI access gates and opportunity kinds aligned with the schema contract', () => {
    const migration = readFileSync(asiAccessOpportunityKindsMigrationPath, 'utf8')

    expect(migration).toContain('create type public.tenant_kind as enum')
    expect(migration).toContain('create type public.opportunity_type as enum')
    expect(migration).toContain('create type public.user_approval_status as enum')
    expect(migration).toContain('create type public.asi_membership_status as enum')
    expect(migration).toContain('create type public.user_subscription_status as enum')
    expect(migration).toContain('add column if not exists tenant_kind public.tenant_kind')
    expect(migration).toContain('add column if not exists opportunity_type public.opportunity_type')
    expect(migration).toContain('create table if not exists public.opportunity_stage_templates')
    expect(migration).toContain('create or replace function public.has_active_asi_access')
    expect(migration).toContain('create or replace function public.can_publish_opportunity')
    expect(migration).toContain('create policy "job_postings_protected_or_tenant_read"')
    expect(migration).toContain('revoke all on public.job_postings from anon')
  })

  it('keeps tenant-kind and opportunity-type validation requirements aligned with the schema contract', () => {
    const migration = readFileSync(asiTypeRequirementsMigrationPath, 'utf8')

    expect(migration).toContain('create or replace function public.validate_recruiter_request_requirements()')
    expect(migration).toContain('create trigger recruiter_requests_validate_requirements')
    expect(migration).toContain('Project requests require sponsoring_entity metadata')
    expect(migration).toContain('create or replace function public.validate_job_posting_requirements()')
    expect(migration).toContain('Project opportunities require delivery_timeline metadata')
    expect(migration).toContain('Volunteer opportunities require engagement_model metadata')
    expect(migration).toContain('create trigger job_postings_validate_requirements')
  })

  it('keeps applications foundations aligned with the schema contract', () => {
    const migration = readFileSync(applicationsMigrationPath, 'utf8')

    expect(migration).toContain('create type public.application_public_status as enum')
    expect(migration).toContain('create table if not exists public.applications')
    expect(migration).toContain('create table if not exists public.application_answers')
    expect(migration).toContain("create or replace function public.submit_application(")
    expect(migration).toContain('unique (job_posting_id, candidate_profile_id)')
    expect(migration).toContain("select private.attach_audit_trigger('public', 'applications')")
  })

  it('keeps ats-lite pipeline foundations aligned with the schema contract', () => {
    const migration = readFileSync(atsLiteMigrationPath, 'utf8')

    expect(migration).toContain('create table if not exists public.pipeline_stages')
    expect(migration).toContain('create table if not exists public.application_stage_history')
    expect(migration).toContain('create table if not exists public.application_notes')
    expect(migration).toContain('create table if not exists public.application_ratings')
    expect(migration).toContain('add column if not exists current_stage_id uuid')
    expect(migration).toContain("create or replace function public.move_application_stage(")
    expect(migration).toContain("select private.attach_audit_trigger('public', 'application_stage_history')")
  })

  it('keeps the ats stage-history fix in place so transitions preserve the prior stage', () => {
    const migration = readFileSync(atsLiteFixMigrationPath, 'utf8')

    expect(migration).toContain('v_previous_stage_id uuid;')
    expect(migration).toContain('v_previous_stage_id := v_application.current_stage_id;')
    expect(migration).toContain('from_stage_id,')
    expect(migration).toContain('v_previous_stage_id,')
  })

  it('keeps platform ops, moderation, and plan hook foundations aligned with the schema contract', () => {
    const migration = readFileSync(platformOpsMigrationPath, 'utf8')

    expect(migration).toContain('create table if not exists public.subscription_plans')
    expect(migration).toContain('create table if not exists public.tenant_subscriptions')
    expect(migration).toContain('create table if not exists public.feature_flags')
    expect(migration).toContain('create table if not exists public.moderation_cases')
    expect(migration).toContain('create table if not exists public.moderation_actions')
    expect(migration).toContain('create or replace function public.system_create_notification(')
    expect(migration).toContain('create or replace function public.platform_ops_snapshot()')
    expect(migration).toContain('create or replace function public.open_moderation_case(')
    expect(migration).toContain('create or replace function public.apply_moderation_action(')
    expect(migration).toContain('create trigger job_postings_assert_publish_limit')
  })

  it('keeps the launch-readiness migration for invites and email processing helpers in place', () => {
    const migration = readFileSync(mvpLaunchReadinessMigrationPath, 'utf8')

    expect(migration).toContain('create or replace function public.invite_tenant_member(')
    expect(migration).toContain('create or replace function public.revoke_membership_invite(')
    expect(migration).toContain("'member_invited'")
    expect(migration).toContain("'member_invite_revoked'")
    expect(migration).toContain("grant execute on function public.invite_tenant_member(uuid, text, uuid) to authenticated;")
  })
})
