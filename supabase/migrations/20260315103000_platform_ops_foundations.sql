begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'moderation_case_status') then
    create type public.moderation_case_status as enum ('open', 'under_review', 'resolved', 'dismissed');
  end if;

  if not exists (select 1 from pg_type where typname = 'moderation_action_type') then
    create type public.moderation_action_type as enum ('note', 'warn', 'close_job', 'suspend_tenant', 'restore_tenant', 'dismiss_case');
  end if;

  if not exists (select 1 from pg_type where typname = 'subscription_plan_status') then
    create type public.subscription_plan_status as enum ('draft', 'active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'tenant_subscription_status') then
    create type public.tenant_subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'ended');
  end if;

  if not exists (select 1 from pg_type where typname = 'feature_scope_type') then
    create type public.feature_scope_type as enum ('global', 'plan', 'tenant');
  end if;
end
$$;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  status public.subscription_plan_status not null default 'draft',
  monthly_price_amount numeric(10, 2) not null default 0,
  currency_code text not null default 'USD',
  limits_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status public.tenant_subscription_status not null default 'trialing',
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz,
  seat_count integer not null default 1 check (seat_count > 0),
  usage_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists tenant_subscriptions_active_unique
  on public.tenant_subscriptions (tenant_id)
  where status in ('trialing', 'active', 'past_due');

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  scope_type public.feature_scope_type not null default 'global',
  scope_id uuid,
  is_enabled boolean not null default true,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists feature_flags_scope_key
  on public.feature_flags (code, scope_type, scope_id);

create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  status public.moderation_case_status not null default 'open',
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  reason text not null,
  opened_by_user_id uuid not null references public.users(id) on delete restrict,
  assigned_to_user_id uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists moderation_cases_status_created_idx
  on public.moderation_cases (status, created_at desc);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderation_case_id uuid not null references public.moderation_cases(id) on delete cascade,
  action_type public.moderation_action_type not null,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists moderation_actions_case_created_idx
  on public.moderation_actions (moderation_case_id, created_at desc);

insert into public.subscription_plans (code, name, description, status, monthly_price_amount, currency_code, limits_json)
values
  (
    'free',
    'Free',
    'Foundational plan for early employer tenants.',
    'active',
    0,
    'USD',
    jsonb_build_object(
      'published_jobs_limit', 3,
      'member_seats_limit', 3,
      'candidate_exports_limit', 0
    )
  ),
  (
    'growth',
    'Growth',
    'Higher operating limits for active hiring teams.',
    'active',
    99,
    'USD',
    jsonb_build_object(
      'published_jobs_limit', 25,
      'member_seats_limit', 15,
      'candidate_exports_limit', 200
    )
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  monthly_price_amount = excluded.monthly_price_amount,
  currency_code = excluded.currency_code,
  limits_json = excluded.limits_json,
  updated_at = timezone('utc', now());

insert into public.feature_flags (code, scope_type, scope_id, is_enabled, description, metadata)
values
  ('notifications_center', 'global', null, true, 'Enable in-app notification center.', '{}'::jsonb),
  ('email_event_hooks', 'global', null, true, 'Enable pending email delivery hooks for workflow notifications.', '{}'::jsonb),
  ('moderation_ops', 'global', null, true, 'Enable platform moderation tools.', '{}'::jsonb),
  ('ats_pipeline', 'global', null, true, 'Enable ATS-lite module.', '{}'::jsonb)
on conflict (code, scope_type, scope_id) do update
set
  is_enabled = excluded.is_enabled,
  description = excluded.description,
  metadata = excluded.metadata,
  updated_at = timezone('utc', now());

create or replace function public.get_plan_limit_json(p_tenant_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(sp.limits_json, '{}'::jsonb)
  from public.tenant_subscriptions ts
  join public.subscription_plans sp on sp.id = ts.plan_id
  where ts.tenant_id = p_tenant_id
    and ts.status in ('trialing', 'active', 'past_due')
  order by ts.created_at desc
  limit 1
$$;

create or replace function public.assign_default_subscription_to_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  free_plan_id uuid;
begin
  select id into free_plan_id
  from public.subscription_plans
  where code = 'free'
  limit 1;

  if free_plan_id is null then
    return new;
  end if;

  insert into public.tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    starts_at,
    usage_snapshot
  )
  values (
    new.id,
    free_plan_id,
    'trialing',
    timezone('utc', now()),
    jsonb_build_object('seeded_by', 'assign_default_subscription_to_tenant')
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists tenants_assign_default_subscription on public.tenants;
create trigger tenants_assign_default_subscription
after insert on public.tenants
for each row
execute function public.assign_default_subscription_to_tenant();

insert into public.tenant_subscriptions (
  tenant_id,
  plan_id,
  status,
  starts_at,
  usage_snapshot
)
select
  t.id,
  sp.id,
  'trialing',
  timezone('utc', now()),
  jsonb_build_object('seeded_by', 'platform_ops_backfill')
from public.tenants t
cross join lateral (
  select id
  from public.subscription_plans
  where code = 'free'
  limit 1
) sp
where not exists (
  select 1
  from public.tenant_subscriptions ts
  where ts.tenant_id = t.id
    and ts.status in ('trialing', 'active', 'past_due')
);

create or replace function public.assert_job_publish_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  limits_json jsonb;
  published_limit integer;
  published_count integer;
begin
  if new.status <> 'published' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;
  end if;

  limits_json := public.get_plan_limit_json(new.tenant_id);
  published_limit := (limits_json ->> 'published_jobs_limit')::integer;

  if published_limit is null then
    return new;
  end if;

  select count(*)
  into published_count
  from public.job_postings jp
  where jp.tenant_id = new.tenant_id
    and jp.status = 'published'
    and jp.id <> new.id;

  if published_count >= published_limit then
    raise exception 'Plan limit reached: this tenant can only keep % published jobs at the same time', published_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists job_postings_assert_publish_limit on public.job_postings;
create trigger job_postings_assert_publish_limit
before insert or update on public.job_postings
for each row
execute function public.assert_job_publish_limit();

create or replace function public.system_create_notification(
  p_recipient_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_action_url text default null,
  p_payload jsonb default '{}'::jsonb,
  p_tenant_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_row public.notifications;
  in_app_delivery_id uuid;
  email_delivery_id uuid;
begin
  insert into public.notifications (
    recipient_user_id,
    tenant_id,
    type,
    title,
    body,
    action_url,
    payload
  )
  values (
    p_recipient_user_id,
    p_tenant_id,
    trim(p_type),
    trim(p_title),
    trim(p_body),
    nullif(trim(coalesce(p_action_url, '')), ''),
    coalesce(p_payload, '{}'::jsonb)
  )
  returning * into notification_row;

  insert into public.notification_deliveries (
    notification_id,
    channel,
    delivery_status,
    provider_name,
    attempt_count,
    last_attempt_at,
    delivered_at,
    response_payload
  )
  values (
    notification_row.id,
    'in_app',
    'sent',
    'system',
    1,
    timezone('utc', now()),
    timezone('utc', now()),
    jsonb_build_object('source', 'system_create_notification')
  )
  returning id into in_app_delivery_id;

  insert into public.notification_delivery_logs (
    delivery_id,
    log_level,
    message,
    metadata
  )
  values (
    in_app_delivery_id,
    'info',
    'Notification stored in in-app inbox by system trigger',
    jsonb_build_object('notification_id', notification_row.id)
  );

  if exists (
    select 1
    from public.notification_preferences np
    where np.user_id = p_recipient_user_id
      and np.tenant_id is null
      and np.email_enabled = true
  ) then
    insert into public.notification_deliveries (
      notification_id,
      channel,
      delivery_status,
      provider_name,
      response_payload
    )
    values (
      notification_row.id,
      'email',
      'pending',
      'email_hook',
      jsonb_build_object('source', 'system_create_notification')
    )
    returning id into email_delivery_id;

    insert into public.notification_delivery_logs (
      delivery_id,
      log_level,
      message,
      metadata
    )
    values (
      email_delivery_id,
      'info',
      'Email hook queued for workflow notification',
      jsonb_build_object('notification_id', notification_row.id)
    );
  end if;

  insert into public.notification_deliveries (
    notification_id,
    channel,
    push_subscription_id,
    delivery_status,
    provider_name,
    response_payload
  )
  select
    notification_row.id,
    'push',
    ps.id,
    'pending',
    'web_push',
    jsonb_build_object('source', 'system_create_notification')
  from public.push_subscriptions ps
  where ps.user_id = p_recipient_user_id
    and ps.is_active = true
    and ps.permission_state = 'granted';

  insert into public.notification_delivery_logs (
    delivery_id,
    log_level,
    message,
    metadata
  )
  select
    nd.id,
    'info',
    'Push delivery queued by workflow notification',
    jsonb_build_object('notification_id', notification_row.id, 'push_subscription_id', nd.push_subscription_id)
  from public.notification_deliveries nd
  where nd.notification_id = notification_row.id
    and nd.channel = 'push';

  return notification_row.id;
end;
$$;

create or replace function public.notify_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.job_postings%rowtype;
begin
  select * into job_row
  from public.job_postings
  where id = new.job_posting_id;

  if job_row.created_by_user_id is not null and job_row.created_by_user_id <> auth.uid() then
    perform public.system_create_notification(
      job_row.created_by_user_id,
      'application.submitted',
      'Nuevo applicant recibido',
      format('%s aplico a %s.', new.candidate_display_name_snapshot, job_row.title),
      format('/applications'),
      jsonb_build_object(
        'application_id', new.id,
        'job_posting_id', new.job_posting_id,
        'tenant_id', job_row.tenant_id
      ),
      job_row.tenant_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists applications_notify_submitted on public.applications;
create trigger applications_notify_submitted
after insert on public.applications
for each row
execute function public.notify_application_submitted();

create or replace function public.notify_candidate_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_user_id uuid;
  job_title text;
begin
  if new.status_public is not distinct from old.status_public then
    return new;
  end if;

  select cp.user_id, jp.title
  into candidate_user_id, job_title
  from public.candidate_profiles cp
  join public.job_postings jp on jp.id = new.job_posting_id
  where cp.id = new.candidate_profile_id;

  if candidate_user_id is not null then
    perform public.system_create_notification(
      candidate_user_id,
      'application.status_updated',
      'Actualizamos tu proceso',
      format('Tu aplicacion a %s ahora esta en estado %s.', coalesce(job_title, 'esta vacante'), new.status_public),
      '/applications',
      jsonb_build_object(
        'application_id', new.id,
        'job_posting_id', new.job_posting_id,
        'status_public', new.status_public
      ),
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists applications_notify_status_change on public.applications;
create trigger applications_notify_status_change
after update on public.applications
for each row
execute function public.notify_candidate_status_change();

create or replace function public.notify_recruiter_request_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('approved', 'rejected') then
    perform public.system_create_notification(
      new.requester_user_id,
      'recruiter_request.reviewed',
      case when new.status = 'approved' then 'Solicitud recruiter aprobada' else 'Solicitud recruiter revisada' end,
      case
        when new.status = 'approved' then 'Tu empresa fue validada y ya puedes continuar con el workspace employer.'
        else 'Tu solicitud recruiter fue revisada. Consulta las notas del equipo si necesitas reenviarla.'
      end,
      '/recruiter-request',
      jsonb_build_object(
        'request_id', new.id,
        'status', new.status,
        'approved_tenant_id', new.approved_tenant_id
      ),
      new.approved_tenant_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists recruiter_requests_notify_review on public.recruiter_requests;
create trigger recruiter_requests_notify_review
after update on public.recruiter_requests
for each row
execute function public.notify_recruiter_request_review();

create or replace function public.platform_ops_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user uuid := auth.uid();
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_platform_permission('platform_dashboard:read')
    or public.has_platform_permission('plan:read')
  ) then
    raise exception 'Not enough permissions to read platform operations';
  end if;

  return jsonb_build_object(
    'activeTenants', (select count(*) from public.tenants where status = 'active'),
    'openModerationCases', (select count(*) from public.moderation_cases where status in ('open', 'under_review')),
    'pendingRecruiterRequests', (select count(*) from public.recruiter_requests where status in ('submitted', 'under_review')),
    'activeSubscriptions', (select count(*) from public.tenant_subscriptions where status in ('trialing', 'active', 'past_due')),
    'pendingEmailHooks', (select count(*) from public.notification_deliveries where channel = 'email' and delivery_status = 'pending'),
    'featureFlagsEnabled', (select count(*) from public.feature_flags where is_enabled = true)
  );
end;
$$;

create or replace function public.get_tenant_plan_snapshot(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user uuid := auth.uid();
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_platform_permission('plan:read')
    or public.is_tenant_member(p_tenant_id)
  ) then
    raise exception 'Not enough permissions to read this plan snapshot';
  end if;

  return (
    select jsonb_build_object(
      'tenantId', ts.tenant_id,
      'planCode', sp.code,
      'planName', sp.name,
      'subscriptionStatus', ts.status,
      'seatCount', ts.seat_count,
      'limits', sp.limits_json,
      'usage', jsonb_build_object(
        'publishedJobs', (select count(*) from public.job_postings jp where jp.tenant_id = ts.tenant_id and jp.status = 'published'),
        'members', (select count(*) from public.memberships m where m.tenant_id = ts.tenant_id and m.status = 'active')
      )
    )
    from public.tenant_subscriptions ts
    join public.subscription_plans sp on sp.id = ts.plan_id
    where ts.tenant_id = p_tenant_id
      and ts.status in ('trialing', 'active', 'past_due')
    order by ts.created_at desc
    limit 1
  );
end;
$$;

create or replace function public.open_moderation_case(
  p_entity_type text,
  p_entity_id uuid,
  p_tenant_id uuid default null,
  p_reason text default '',
  p_severity text default 'medium',
  p_metadata jsonb default '{}'::jsonb
)
returns public.moderation_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user uuid := auth.uid();
  case_row public.moderation_cases;
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_platform_permission('moderation:act')
  ) then
    raise exception 'Not enough permissions to open moderation cases';
  end if;

  insert into public.moderation_cases (
    entity_type,
    entity_id,
    tenant_id,
    status,
    severity,
    reason,
    opened_by_user_id,
    metadata
  )
  values (
    trim(p_entity_type),
    p_entity_id,
    p_tenant_id,
    'open',
    p_severity,
    trim(coalesce(p_reason, '')),
    current_user,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into case_row;

  insert into public.moderation_actions (
    moderation_case_id,
    action_type,
    actor_user_id,
    note,
    payload
  )
  values (
    case_row.id,
    'note',
    current_user,
    'Case opened',
    jsonb_build_object('source', 'open_moderation_case')
  );

  return case_row;
end;
$$;

create or replace function public.apply_moderation_action(
  p_case_id uuid,
  p_action_type public.moderation_action_type,
  p_note text default null
)
returns public.moderation_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user uuid := auth.uid();
  case_row public.moderation_cases;
  updated_case public.moderation_cases;
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_platform_permission('moderation:act')
  ) then
    raise exception 'Not enough permissions to act on moderation cases';
  end if;

  select *
  into case_row
  from public.moderation_cases
  where id = p_case_id;

  if not found then
    raise exception 'Moderation case not found';
  end if;

  if p_action_type = 'close_job' and case_row.entity_type = 'job_posting' then
    update public.job_postings
    set status = 'closed',
        closed_at = coalesce(closed_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
    where id = case_row.entity_id;
  elsif p_action_type = 'suspend_tenant' and case_row.entity_type = 'tenant' then
    update public.tenants
    set status = 'suspended',
        updated_at = timezone('utc', now())
    where id = case_row.entity_id;
  elsif p_action_type = 'restore_tenant' and case_row.entity_type = 'tenant' then
    update public.tenants
    set status = 'active',
        updated_at = timezone('utc', now())
    where id = case_row.entity_id;
  end if;

  update public.moderation_cases
  set
    status = case
      when p_action_type = 'dismiss_case' then 'dismissed'
      when p_action_type in ('close_job', 'suspend_tenant', 'restore_tenant', 'warn') then 'resolved'
      else 'under_review'
    end,
    resolved_at = case
      when p_action_type in ('close_job', 'suspend_tenant', 'restore_tenant', 'warn', 'dismiss_case')
        then timezone('utc', now())
      else resolved_at
    end,
    resolved_by_user_id = case
      when p_action_type in ('close_job', 'suspend_tenant', 'restore_tenant', 'warn', 'dismiss_case')
        then current_user
      else resolved_by_user_id
    end,
    updated_at = timezone('utc', now())
  where id = case_row.id
  returning * into updated_case;

  insert into public.moderation_actions (
    moderation_case_id,
    action_type,
    actor_user_id,
    note,
    payload
  )
  values (
    updated_case.id,
    p_action_type,
    current_user,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object('entity_type', updated_case.entity_type, 'entity_id', updated_case.entity_id)
  );

  return updated_case;
end;
$$;

grant execute on function public.platform_ops_snapshot() to authenticated;
grant execute on function public.get_tenant_plan_snapshot(uuid) to authenticated;
grant execute on function public.open_moderation_case(text, uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.apply_moderation_action(uuid, public.moderation_action_type, text) to authenticated;

alter table public.subscription_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.feature_flags enable row level security;
alter table public.moderation_cases enable row level security;
alter table public.moderation_actions enable row level security;

grant select, insert, update on public.subscription_plans to authenticated;
grant select, insert, update on public.tenant_subscriptions to authenticated;
grant select, insert, update on public.feature_flags to authenticated;
grant select on public.moderation_cases to authenticated;
grant select on public.moderation_actions to authenticated;

drop policy if exists "subscription_plans_select_platform_readers" on public.subscription_plans;
create policy "subscription_plans_select_platform_readers"
on public.subscription_plans
for select
using (public.is_platform_admin() or public.has_platform_permission('plan:read'));

drop policy if exists "subscription_plans_manage_platform_admins" on public.subscription_plans;
create policy "subscription_plans_manage_platform_admins"
on public.subscription_plans
for all
using (public.is_platform_admin() or public.has_platform_permission('plan:update'))
with check (public.is_platform_admin() or public.has_platform_permission('plan:update'));

drop policy if exists "tenant_subscriptions_select_platform_or_tenant" on public.tenant_subscriptions;
create policy "tenant_subscriptions_select_platform_or_tenant"
on public.tenant_subscriptions
for select
using (
  public.is_platform_admin()
  or public.has_platform_permission('plan:read')
  or public.is_tenant_member(tenant_id)
);

drop policy if exists "tenant_subscriptions_manage_platform_admins" on public.tenant_subscriptions;
create policy "tenant_subscriptions_manage_platform_admins"
on public.tenant_subscriptions
for all
using (public.is_platform_admin() or public.has_platform_permission('plan:update'))
with check (public.is_platform_admin() or public.has_platform_permission('plan:update'));

drop policy if exists "feature_flags_select_platform_readers" on public.feature_flags;
create policy "feature_flags_select_platform_readers"
on public.feature_flags
for select
using (
  public.is_platform_admin()
  or public.has_platform_permission('feature_flag:read')
  or public.has_platform_permission('plan:read')
);

drop policy if exists "feature_flags_manage_platform_admins" on public.feature_flags;
create policy "feature_flags_manage_platform_admins"
on public.feature_flags
for all
using (public.is_platform_admin() or public.has_platform_permission('feature_flag:update'))
with check (public.is_platform_admin() or public.has_platform_permission('feature_flag:update'));

drop policy if exists "moderation_cases_select_platform_reviewers" on public.moderation_cases;
create policy "moderation_cases_select_platform_reviewers"
on public.moderation_cases
for select
using (public.is_platform_admin() or public.has_platform_permission('moderation:read'));

drop policy if exists "moderation_actions_select_platform_reviewers" on public.moderation_actions;
create policy "moderation_actions_select_platform_reviewers"
on public.moderation_actions
for select
using (
  public.is_platform_admin()
  or public.has_platform_permission('moderation:read')
);

drop trigger if exists subscription_plans_set_updated_at on public.subscription_plans;
create trigger subscription_plans_set_updated_at
before update on public.subscription_plans
for each row
execute function public.set_row_updated_at();

drop trigger if exists tenant_subscriptions_set_updated_at on public.tenant_subscriptions;
create trigger tenant_subscriptions_set_updated_at
before update on public.tenant_subscriptions
for each row
execute function public.set_row_updated_at();

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at
before update on public.feature_flags
for each row
execute function public.set_row_updated_at();

drop trigger if exists moderation_cases_set_updated_at on public.moderation_cases;
create trigger moderation_cases_set_updated_at
before update on public.moderation_cases
for each row
execute function public.set_row_updated_at();

drop trigger if exists moderation_actions_set_updated_at on public.moderation_actions;
create trigger moderation_actions_set_updated_at
before update on public.moderation_actions
for each row
execute function public.set_row_updated_at();

select private.attach_audit_trigger('public', 'subscription_plans');
select private.attach_audit_trigger('public', 'tenant_subscriptions');
select private.attach_audit_trigger('public', 'feature_flags');
select private.attach_audit_trigger('public', 'moderation_cases');
select private.attach_audit_trigger('public', 'moderation_actions');

commit;
