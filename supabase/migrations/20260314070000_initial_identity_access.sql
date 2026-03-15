create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.permission_scope as enum ('platform', 'tenant', 'self');
create type public.user_status as enum ('active', 'suspended', 'blocked');
create type public.tenant_status as enum ('active', 'suspended', 'archived');
create type public.membership_status as enum ('active', 'invited', 'suspended', 'revoked');
create type public.recruiter_request_status as enum (
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'cancelled'
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  phone text,
  full_name text not null default 'New user',
  display_name text not null default 'New user',
  avatar_path text,
  locale text,
  country_code text,
  status public.user_status not null default 'active',
  last_sign_in_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index users_email_unique_idx on public.users (lower(email)) where email is not null;

create table public.permissions (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  resource text not null,
  action text not null,
  scope public.permission_scope not null,
  description text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint permissions_code_format_chk check (code ~ '^[a-z0-9_]+:[a-z0-9_]+$')
);

create table public.platform_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  is_system boolean not null default false,
  is_locked boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint platform_roles_code_format_chk check (code ~ '^[a-z0-9_]+$')
);

create table public.platform_role_permissions (
  role_id uuid not null references public.platform_roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, permission_id)
);

create table public.user_platform_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.platform_roles (id) on delete restrict,
  assigned_by_user_id uuid references public.users (id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.users (id) on delete set null,
  unique (user_id, role_id)
);

create table public.tenants (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null,
  name text not null,
  status public.tenant_status not null default 'active',
  created_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tenants_slug_format_chk check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index tenants_slug_unique_idx on public.tenants (lower(slug));

create table public.company_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  legal_name text not null,
  display_name text not null,
  website_url text,
  company_email text,
  company_phone text,
  country_code text,
  industry text,
  size_range text,
  description text,
  logo_path text,
  cover_image_path text,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index company_profiles_company_email_unique_idx
  on public.company_profiles (lower(company_email))
  where company_email is not null;

create table public.memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status public.membership_status not null default 'active',
  invited_by_user_id uuid references public.users (id) on delete set null,
  joined_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, user_id)
);

create table public.tenant_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  code text not null,
  name text not null,
  description text not null,
  is_system boolean not null default false,
  is_locked boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tenant_roles_code_format_chk check (code ~ '^[a-z0-9_]+$')
);

create unique index tenant_roles_system_code_unique_idx
  on public.tenant_roles (lower(code))
  where tenant_id is null;

create unique index tenant_roles_tenant_code_unique_idx
  on public.tenant_roles (tenant_id, lower(code))
  where tenant_id is not null;

create table public.tenant_role_permissions (
  role_id uuid not null references public.tenant_roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, permission_id)
);

create table public.membership_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  role_id uuid not null references public.tenant_roles (id) on delete restrict,
  assigned_by_user_id uuid references public.users (id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.users (id) on delete set null,
  unique (membership_id, role_id)
);

create table public.recruiter_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_user_id uuid not null references public.users (id) on delete cascade,
  status public.recruiter_request_status not null default 'submitted',
  requested_company_name text not null,
  requested_company_legal_name text,
  requested_tenant_slug text not null,
  company_website_url text,
  company_email text,
  company_phone text,
  company_country_code text,
  company_description text,
  company_logo_path text,
  verification_document_path text,
  review_notes text,
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references public.users (id) on delete set null,
  approved_tenant_id uuid references public.tenants (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recruiter_requests_slug_format_chk check (requested_tenant_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index recruiter_requests_open_request_per_user_unique_idx
  on public.recruiter_requests (requester_user_id)
  where status in ('submitted', 'under_review');

create unique index recruiter_requests_open_slug_unique_idx
  on public.recruiter_requests (lower(requested_tenant_slug))
  where status in ('submitted', 'under_review', 'approved');

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references public.users (id) on delete set null,
  tenant_id uuid references public.tenants (id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index memberships_user_status_idx on public.memberships (user_id, status);
create index memberships_tenant_status_idx on public.memberships (tenant_id, status);
create index membership_roles_membership_active_idx on public.membership_roles (membership_id) where revoked_at is null;
create index user_platform_roles_user_active_idx on public.user_platform_roles (user_id) where revoked_at is null;
create index recruiter_requests_requester_status_idx on public.recruiter_requests (requester_user_id, status);
create index recruiter_requests_status_idx on public.recruiter_requests (status, submitted_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_tenant_idx on public.audit_logs (tenant_id, created_at desc);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.has_platform_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_platform_roles upr
    join public.platform_roles pr
      on pr.id = upr.role_id
    join public.platform_role_permissions prp
      on prp.role_id = pr.id
    join public.permissions p
      on p.id = prp.permission_id
    where upr.user_id = auth.uid()
      and upr.revoked_at is null
      and p.code = permission_code
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_platform_roles upr
    join public.platform_roles pr
      on pr.id = upr.role_id
    where upr.user_id = auth.uid()
      and upr.revoked_at is null
      and pr.code in ('platform_owner', 'platform_admin')
  );
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.my_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.tenant_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'active';
$$;

create or replace function public.has_tenant_permission(p_tenant_id uuid, permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.memberships m
    join public.membership_roles mr
      on mr.membership_id = m.id
     and mr.revoked_at is null
    join public.tenant_roles tr
      on tr.id = mr.role_id
    join public.tenant_role_permissions trp
      on trp.role_id = tr.id
    join public.permissions p
      on p.id = trp.permission_id
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and p.code = permission_code
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'New user'
  );

  insert into public.users (
    id,
    email,
    phone,
    full_name,
    display_name,
    avatar_path,
    last_sign_in_at
  )
  values (
    new.id,
    new.email,
    new.phone,
    v_name,
    v_name,
    new.raw_user_meta_data ->> 'avatar_path',
    new.last_sign_in_at
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_auth_user_contact_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set
    email = new.email,
    phone = new.phone,
    last_sign_in_at = new.last_sign_in_at,
    updated_at = case
      when public.users.email is distinct from new.email
        or public.users.phone is distinct from new.phone
        or public.users.last_sign_in_at is distinct from new.last_sign_in_at
      then timezone('utc', now())
      else public.users.updated_at
    end
  where id = new.id;

  return new;
end;
$$;

create or replace function public.guard_user_profile_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() = old.id and not public.has_platform_permission('user:update') then
    if new.email is distinct from old.email
      or new.status is distinct from old.status
      or new.last_sign_in_at is distinct from old.last_sign_in_at
      or new.created_at is distinct from old.created_at then
      raise exception 'You can only update your editable profile fields';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_recruiter_request_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.has_platform_permission('recruiter_request:review') then
    return new;
  end if;

  if old.requester_user_id <> auth.uid() then
    raise exception 'You can only update your own recruiter request';
  end if;

  if old.status <> 'submitted' then
    raise exception 'This recruiter request can no longer be edited';
  end if;

  if new.reviewed_at is distinct from old.reviewed_at
    or new.reviewed_by_user_id is distinct from old.reviewed_by_user_id
    or new.approved_tenant_id is distinct from old.approved_tenant_id then
    raise exception 'Review metadata can only be changed by platform admins';
  end if;

  if new.status not in (old.status, 'cancelled') then
    raise exception 'Only platform admins can change the recruiter request status';
  end if;

  return new;
end;
$$;

create or replace function public.bootstrap_first_platform_owner()
returns public.user_platform_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform_owner_role_id uuid;
  v_assignment public.user_platform_roles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1
    from public.user_platform_roles upr
    join public.platform_roles pr
      on pr.id = upr.role_id
    where pr.code = 'platform_owner'
      and upr.revoked_at is null
  ) then
    raise exception 'A platform owner already exists';
  end if;

  select id
  into v_platform_owner_role_id
  from public.platform_roles
  where code = 'platform_owner';

  if v_platform_owner_role_id is null then
    raise exception 'Platform owner role not found';
  end if;

  insert into public.user_platform_roles (user_id, role_id, assigned_by_user_id)
  values (auth.uid(), v_platform_owner_role_id, auth.uid())
  on conflict (user_id, role_id) do update
  set
    assigned_at = timezone('utc', now()),
    assigned_by_user_id = excluded.assigned_by_user_id,
    revoked_at = null,
    revoked_by_user_id = null
  returning * into v_assignment;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'platform_owner_bootstrapped',
    'user_platform_roles',
    v_assignment.id::text,
    jsonb_build_object('user_id', auth.uid(), 'role_code', 'platform_owner')
  );

  return v_assignment;
end;
$$;

create or replace function public.review_recruiter_request(
  p_request_id uuid,
  p_decision public.recruiter_request_status,
  p_review_notes text default null
)
returns public.recruiter_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.recruiter_requests;
  v_tenant_id uuid;
  v_membership_id uuid;
  v_owner_role_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_permission('recruiter_request:review') then
    raise exception 'Only platform admins can review recruiter requests';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Recruiter requests can only be approved or rejected';
  end if;

  select *
  into v_request
  from public.recruiter_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Recruiter request not found';
  end if;

  if v_request.status not in ('submitted', 'under_review') then
    raise exception 'Recruiter request is not pending review';
  end if;

  if p_decision = 'approved' then
    insert into public.tenants (slug, name, status, created_by_user_id)
    values (
      v_request.requested_tenant_slug,
      v_request.requested_company_name,
      'active',
      v_request.requester_user_id
    )
    returning id into v_tenant_id;

    insert into public.company_profiles (
      tenant_id,
      legal_name,
      display_name,
      website_url,
      company_email,
      company_phone,
      country_code,
      description,
      logo_path,
      is_public
    )
    values (
      v_tenant_id,
      coalesce(nullif(v_request.requested_company_legal_name, ''), v_request.requested_company_name),
      v_request.requested_company_name,
      v_request.company_website_url,
      v_request.company_email,
      v_request.company_phone,
      v_request.company_country_code,
      v_request.company_description,
      v_request.company_logo_path,
      false
    );

    insert into public.memberships (tenant_id, user_id, status, joined_at)
    values (v_tenant_id, v_request.requester_user_id, 'active', timezone('utc', now()))
    returning id into v_membership_id;

    select id
    into v_owner_role_id
    from public.tenant_roles
    where tenant_id is null
      and code = 'tenant_owner';

    if v_owner_role_id is null then
      raise exception 'Tenant owner role not found';
    end if;

    insert into public.membership_roles (membership_id, role_id, assigned_by_user_id)
    values (v_membership_id, v_owner_role_id, auth.uid())
    on conflict (membership_id, role_id) do update
    set
      assigned_at = timezone('utc', now()),
      assigned_by_user_id = excluded.assigned_by_user_id,
      revoked_at = null,
      revoked_by_user_id = null;

    update public.recruiter_requests
    set
      status = 'approved',
      review_notes = nullif(trim(p_review_notes), ''),
      reviewed_at = timezone('utc', now()),
      reviewed_by_user_id = auth.uid(),
      approved_tenant_id = v_tenant_id,
      updated_at = timezone('utc', now())
    where id = p_request_id
    returning * into v_request;

    insert into public.audit_logs (actor_user_id, tenant_id, event_type, entity_type, entity_id, payload)
    values (
      auth.uid(),
      v_tenant_id,
      'recruiter_request_approved',
      'recruiter_requests',
      v_request.id::text,
      jsonb_build_object(
        'requester_user_id', v_request.requester_user_id,
        'approved_tenant_id', v_tenant_id,
        'membership_id', v_membership_id
      )
    );
  else
    update public.recruiter_requests
    set
      status = 'rejected',
      review_notes = nullif(trim(p_review_notes), ''),
      reviewed_at = timezone('utc', now()),
      reviewed_by_user_id = auth.uid(),
      updated_at = timezone('utc', now())
    where id = p_request_id
    returning * into v_request;

    insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
    values (
      auth.uid(),
      'recruiter_request_rejected',
      'recruiter_requests',
      v_request.id::text,
      jsonb_build_object('requester_user_id', v_request.requester_user_id)
    );
  end if;

  return v_request;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute procedure public.set_row_updated_at();

create trigger platform_roles_set_updated_at
before update on public.platform_roles
for each row execute procedure public.set_row_updated_at();

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute procedure public.set_row_updated_at();

create trigger company_profiles_set_updated_at
before update on public.company_profiles
for each row execute procedure public.set_row_updated_at();

create trigger memberships_set_updated_at
before update on public.memberships
for each row execute procedure public.set_row_updated_at();

create trigger tenant_roles_set_updated_at
before update on public.tenant_roles
for each row execute procedure public.set_row_updated_at();

create trigger recruiter_requests_set_updated_at
before update on public.recruiter_requests
for each row execute procedure public.set_row_updated_at();

create trigger users_guard_profile_update
before update on public.users
for each row execute procedure public.guard_user_profile_update();

create trigger recruiter_requests_guard_update
before update on public.recruiter_requests
for each row execute procedure public.guard_recruiter_request_update();

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create trigger on_auth_user_updated
after update of email, phone, last_sign_in_at on auth.users
for each row execute procedure public.sync_auth_user_contact_fields();

insert into public.permissions (code, resource, action, scope, description)
values
  ('platform_dashboard:read', 'platform_dashboard', 'read', 'platform', 'View the platform operations dashboard'),
  ('user:read', 'user', 'read', 'platform', 'Read platform user accounts'),
  ('user:update', 'user', 'update', 'platform', 'Manage platform user accounts'),
  ('tenant:read', 'tenant', 'read', 'platform', 'Read employer tenants across the platform'),
  ('tenant:create', 'tenant', 'create', 'platform', 'Create employer tenants after approval'),
  ('tenant:suspend', 'tenant', 'suspend', 'platform', 'Suspend employer tenants'),
  ('tenant:restore', 'tenant', 'restore', 'platform', 'Restore suspended employer tenants'),
  ('recruiter_request:read', 'recruiter_request', 'read', 'platform', 'Read recruiter approval requests'),
  ('recruiter_request:review', 'recruiter_request', 'review', 'platform', 'Approve or reject recruiter approval requests'),
  ('moderation:read', 'moderation', 'read', 'platform', 'Read moderation queues and cases'),
  ('moderation:act', 'moderation', 'act', 'platform', 'Act on moderation cases'),
  ('plan:read', 'plan', 'read', 'platform', 'Read subscription plans'),
  ('plan:update', 'plan', 'update', 'platform', 'Update subscription plans'),
  ('billing:read', 'billing', 'read', 'platform', 'Read billing operations'),
  ('feature_flag:read', 'feature_flag', 'read', 'platform', 'Read feature flags'),
  ('feature_flag:update', 'feature_flag', 'update', 'platform', 'Update feature flags'),
  ('audit_log:read', 'audit_log', 'read', 'platform', 'Read audit logs'),
  ('workspace:read', 'workspace', 'read', 'tenant', 'Read tenant workspace data'),
  ('workspace:update', 'workspace', 'update', 'tenant', 'Update tenant workspace settings'),
  ('company_profile:read', 'company_profile', 'read', 'tenant', 'Read company profiles'),
  ('company_profile:update', 'company_profile', 'update', 'tenant', 'Update company profiles'),
  ('job:create', 'job', 'create', 'tenant', 'Create job postings'),
  ('job:read', 'job', 'read', 'tenant', 'Read job postings'),
  ('job:update', 'job', 'update', 'tenant', 'Update draft or live jobs'),
  ('job:publish', 'job', 'publish', 'tenant', 'Publish job postings'),
  ('job:archive', 'job', 'archive', 'tenant', 'Archive job postings'),
  ('job:close', 'job', 'close', 'tenant', 'Close job postings'),
  ('application:read', 'application', 'read', 'tenant', 'Read applications'),
  ('application:move_stage', 'application', 'move_stage', 'tenant', 'Move applications across stages'),
  ('application:add_note', 'application', 'add_note', 'tenant', 'Add notes to applications'),
  ('application:rate', 'application', 'rate', 'tenant', 'Rate candidates'),
  ('application:export', 'application', 'export', 'tenant', 'Export application data'),
  ('candidate_profile:read_limited', 'candidate_profile', 'read_limited', 'tenant', 'Read limited candidate profile data'),
  ('candidate_resume:read', 'candidate_resume', 'read', 'tenant', 'Read candidate resume files'),
  ('member:invite', 'member', 'invite', 'tenant', 'Invite tenant members'),
  ('member:read', 'member', 'read', 'tenant', 'Read tenant members'),
  ('member:update', 'member', 'update', 'tenant', 'Update tenant members'),
  ('member:remove', 'member', 'remove', 'tenant', 'Remove tenant members'),
  ('role:read', 'role', 'read', 'tenant', 'Read tenant roles'),
  ('role:create', 'role', 'create', 'tenant', 'Create tenant roles'),
  ('role:update', 'role', 'update', 'tenant', 'Update tenant roles'),
  ('role:delete', 'role', 'delete', 'tenant', 'Delete tenant roles'),
  ('role:assign', 'role', 'assign', 'tenant', 'Assign tenant roles'),
  ('notification:read', 'notification', 'read', 'tenant', 'Read tenant notifications'),
  ('analytics:read', 'analytics', 'read', 'tenant', 'Read tenant analytics')
on conflict (code) do update
set
  resource = excluded.resource,
  action = excluded.action,
  scope = excluded.scope,
  description = excluded.description;

insert into public.platform_roles (code, name, description, is_system, is_locked)
values
  ('platform_owner', 'Platform Owner', 'Full control across the platform', true, true),
  ('platform_admin', 'Platform Admin', 'Day-to-day platform administration', true, true),
  ('trust_safety_analyst', 'Trust & Safety Analyst', 'Reviews recruiter requests and moderation items', true, true),
  ('support_agent', 'Support Agent', 'Handles account support and basic tenant visibility', true, true),
  ('billing_admin', 'Billing Admin', 'Manages plans and billing visibility', true, true),
  ('readonly_ops_analyst', 'Readonly Ops Analyst', 'Read-only platform operations analyst', true, true)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system,
  is_locked = excluded.is_locked;

insert into public.tenant_roles (tenant_id, code, name, description, is_system, is_locked)
values
  (null, 'tenant_owner', 'Tenant Owner', 'Owns the validated company workspace and all recruiter capabilities', true, true),
  (null, 'tenant_admin', 'Tenant Admin', 'Administers the tenant workspace', true, true),
  (null, 'recruiter', 'Recruiter', 'Manages jobs and applicants', true, true),
  (null, 'hiring_manager', 'Hiring Manager', 'Collaborates on applicant review and pipeline movement', true, true),
  (null, 'reviewer', 'Reviewer', 'Adds notes and ratings without moving stages', true, true),
  (null, 'readonly_analyst', 'Readonly Analyst', 'Read-only analytics and recruiting visibility', true, true)
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_id)
select pr.id, p.id
from public.platform_roles pr
join public.permissions p
  on p.code in (
    'platform_dashboard:read',
    'user:read',
    'user:update',
    'tenant:read',
    'tenant:create',
    'tenant:suspend',
    'tenant:restore',
    'recruiter_request:read',
    'recruiter_request:review',
    'moderation:read',
    'moderation:act',
    'plan:read',
    'plan:update',
    'billing:read',
    'feature_flag:read',
    'feature_flag:update',
    'audit_log:read'
  )
where pr.code = 'platform_owner'
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_id)
select pr.id, p.id
from public.platform_roles pr
join public.permissions p
  on p.code in (
    'platform_dashboard:read',
    'user:read',
    'user:update',
    'tenant:read',
    'tenant:create',
    'tenant:suspend',
    'tenant:restore',
    'recruiter_request:read',
    'recruiter_request:review',
    'moderation:read',
    'moderation:act',
    'plan:read',
    'billing:read',
    'feature_flag:read',
    'audit_log:read'
  )
where pr.code = 'platform_admin'
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_id)
select pr.id, p.id
from public.platform_roles pr
join public.permissions p
  on p.code in (
    'platform_dashboard:read',
    'tenant:read',
    'recruiter_request:read',
    'recruiter_request:review',
    'moderation:read',
    'moderation:act',
    'audit_log:read'
  )
where pr.code = 'trust_safety_analyst'
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_id)
select pr.id, p.id
from public.platform_roles pr
join public.permissions p
  on p.code in (
    'platform_dashboard:read',
    'user:read',
    'tenant:read',
    'recruiter_request:read'
  )
where pr.code = 'support_agent'
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_id)
select pr.id, p.id
from public.platform_roles pr
join public.permissions p
  on p.code in (
    'platform_dashboard:read',
    'plan:read',
    'plan:update',
    'billing:read',
    'feature_flag:read'
  )
where pr.code = 'billing_admin'
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_id)
select pr.id, p.id
from public.platform_roles pr
join public.permissions p
  on p.code in (
    'platform_dashboard:read',
    'tenant:read',
    'recruiter_request:read',
    'moderation:read',
    'billing:read',
    'audit_log:read'
  )
where pr.code = 'readonly_ops_analyst'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.scope = 'tenant'
where tr.tenant_id is null
  and tr.code = 'tenant_owner'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'workspace:update',
    'company_profile:read',
    'company_profile:update',
    'job:create',
    'job:read',
    'job:update',
    'job:publish',
    'job:archive',
    'job:close',
    'application:read',
    'application:move_stage',
    'application:add_note',
    'application:rate',
    'application:export',
    'candidate_profile:read_limited',
    'candidate_resume:read',
    'member:invite',
    'member:read',
    'member:update',
    'member:remove',
    'role:read',
    'role:create',
    'role:update',
    'role:delete',
    'role:assign',
    'notification:read',
    'analytics:read'
  )
where tr.tenant_id is null
  and tr.code = 'tenant_admin'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'company_profile:read',
    'job:create',
    'job:read',
    'job:update',
    'job:publish',
    'job:archive',
    'job:close',
    'application:read',
    'application:move_stage',
    'application:add_note',
    'application:rate',
    'application:export',
    'candidate_profile:read_limited',
    'candidate_resume:read',
    'notification:read'
  )
where tr.tenant_id is null
  and tr.code = 'recruiter'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'company_profile:read',
    'job:read',
    'application:read',
    'application:move_stage',
    'application:add_note',
    'application:rate',
    'candidate_profile:read_limited',
    'candidate_resume:read',
    'notification:read'
  )
where tr.tenant_id is null
  and tr.code = 'hiring_manager'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'company_profile:read',
    'job:read',
    'application:read',
    'application:add_note',
    'application:rate',
    'candidate_profile:read_limited',
    'candidate_resume:read',
    'notification:read'
  )
where tr.tenant_id is null
  and tr.code = 'reviewer'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'company_profile:read',
    'job:read',
    'application:read',
    'analytics:read',
    'notification:read'
  )
where tr.tenant_id is null
  and tr.code = 'readonly_analyst'
on conflict do nothing;

alter table public.users enable row level security;
alter table public.permissions enable row level security;
alter table public.platform_roles enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.user_platform_roles enable row level security;
alter table public.tenants enable row level security;
alter table public.company_profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.tenant_roles enable row level security;
alter table public.tenant_role_permissions enable row level security;
alter table public.membership_roles enable row level security;
alter table public.recruiter_requests enable row level security;
alter table public.audit_logs enable row level security;

create policy "users_select_self_or_platform_admin"
on public.users
for select
to authenticated
using (auth.uid() = id or public.has_platform_permission('user:read'));

create policy "users_insert_self_only"
on public.users
for insert
to authenticated
with check (auth.uid() = id);

create policy "users_update_self_or_platform_admin"
on public.users
for update
to authenticated
using (auth.uid() = id or public.has_platform_permission('user:update'))
with check (auth.uid() = id or public.has_platform_permission('user:update'));

create policy "permissions_readable_by_authenticated_users"
on public.permissions
for select
to authenticated
using (true);

create policy "platform_roles_readable_by_platform_admins"
on public.platform_roles
for select
to authenticated
using (public.has_platform_permission('recruiter_request:read') or public.is_platform_admin());

create policy "platform_role_permissions_readable_by_platform_admins"
on public.platform_role_permissions
for select
to authenticated
using (public.has_platform_permission('recruiter_request:read') or public.is_platform_admin());

create policy "user_platform_roles_read_own_or_platform_admin"
on public.user_platform_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

create policy "tenants_select_for_members_or_platform_admins"
on public.tenants
for select
to authenticated
using (public.is_tenant_member(id) or public.has_platform_permission('tenant:read'));

create policy "company_profiles_select_for_public_members_or_platform_admins"
on public.company_profiles
for select
to authenticated
using (
  is_public
  or public.is_tenant_member(tenant_id)
  or public.has_platform_permission('tenant:read')
);

create policy "company_profiles_update_for_authorized_members"
on public.company_profiles
for update
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_permission(tenant_id, 'company_profile:update')
)
with check (
  public.is_platform_admin()
  or public.has_tenant_permission(tenant_id, 'company_profile:update')
);

create policy "memberships_read_own_or_tenant_authority"
on public.memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_platform_permission('tenant:read')
  or public.has_tenant_permission(tenant_id, 'member:read')
);

create policy "memberships_update_for_tenant_authority"
on public.memberships
for update
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_permission(tenant_id, 'member:update')
)
with check (
  public.is_platform_admin()
  or public.has_tenant_permission(tenant_id, 'member:update')
);

create policy "tenant_roles_select_for_members_or_platform_admins"
on public.tenant_roles
for select
to authenticated
using (
  tenant_id is null
  or public.has_platform_permission('tenant:read')
  or public.has_tenant_permission(tenant_id, 'role:read')
);

create policy "tenant_roles_insert_for_authorized_members"
on public.tenant_roles
for insert
to authenticated
with check (
  public.is_platform_admin()
  or (tenant_id is not null and public.has_tenant_permission(tenant_id, 'role:create'))
);

create policy "tenant_roles_update_for_authorized_members"
on public.tenant_roles
for update
to authenticated
using (
  public.is_platform_admin()
  or (tenant_id is not null and public.has_tenant_permission(tenant_id, 'role:update'))
)
with check (
  public.is_platform_admin()
  or (tenant_id is not null and public.has_tenant_permission(tenant_id, 'role:update'))
);

create policy "tenant_roles_delete_for_authorized_members"
on public.tenant_roles
for delete
to authenticated
using (
  public.is_platform_admin()
  or (tenant_id is not null and public.has_tenant_permission(tenant_id, 'role:delete'))
);

create policy "tenant_role_permissions_select_for_role_readers"
on public.tenant_role_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_roles tr
    where tr.id = role_id
      and (
        tr.tenant_id is null
        or public.has_platform_permission('tenant:read')
        or public.has_tenant_permission(tr.tenant_id, 'role:read')
      )
  )
);

create policy "tenant_role_permissions_insert_for_role_managers"
on public.tenant_role_permissions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tenant_roles tr
    where tr.id = role_id
      and (
        public.is_platform_admin()
        or (tr.tenant_id is not null and public.has_tenant_permission(tr.tenant_id, 'role:update'))
      )
  )
);

create policy "tenant_role_permissions_delete_for_role_managers"
on public.tenant_role_permissions
for delete
to authenticated
using (
  exists (
    select 1
    from public.tenant_roles tr
    where tr.id = role_id
      and (
        public.is_platform_admin()
        or (tr.tenant_id is not null and public.has_tenant_permission(tr.tenant_id, 'role:update'))
      )
  )
);

create policy "membership_roles_select_for_members_or_role_readers"
on public.membership_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (
        m.user_id = auth.uid()
        or public.has_platform_permission('tenant:read')
        or public.has_tenant_permission(m.tenant_id, 'role:read')
      )
  )
);

create policy "membership_roles_insert_for_role_assigners"
on public.membership_roles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (
        public.is_platform_admin()
        or public.has_tenant_permission(m.tenant_id, 'role:assign')
      )
  )
);

create policy "membership_roles_update_for_role_assigners"
on public.membership_roles
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (
        public.is_platform_admin()
        or public.has_tenant_permission(m.tenant_id, 'role:assign')
      )
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (
        public.is_platform_admin()
        or public.has_tenant_permission(m.tenant_id, 'role:assign')
      )
  )
);

create policy "recruiter_requests_select_self_or_platform_admin"
on public.recruiter_requests
for select
to authenticated
using (
  requester_user_id = auth.uid()
  or public.has_platform_permission('recruiter_request:read')
  or public.has_platform_permission('recruiter_request:review')
);

create policy "recruiter_requests_insert_self_only"
on public.recruiter_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and status = 'submitted'
  and reviewed_by_user_id is null
  and reviewed_at is null
  and approved_tenant_id is null
);

create policy "recruiter_requests_update_self_or_platform_admin"
on public.recruiter_requests
for update
to authenticated
using (
  requester_user_id = auth.uid()
  or public.has_platform_permission('recruiter_request:review')
)
with check (
  requester_user_id = auth.uid()
  or public.has_platform_permission('recruiter_request:review')
);

create policy "audit_logs_readable_by_platform_admins"
on public.audit_logs
for select
to authenticated
using (public.has_platform_permission('audit_log:read'));

grant usage on schema public to authenticated;
grant select, insert, update on public.users to authenticated;
grant select on public.permissions to authenticated;
grant select on public.platform_roles to authenticated;
grant select on public.platform_role_permissions to authenticated;
grant select on public.user_platform_roles to authenticated;
grant select on public.tenants to authenticated;
grant select, update on public.company_profiles to authenticated;
grant select, update on public.memberships to authenticated;
grant select, insert, update, delete on public.tenant_roles to authenticated;
grant select, insert, delete on public.tenant_role_permissions to authenticated;
grant select, insert, update on public.membership_roles to authenticated;
grant select, insert, update on public.recruiter_requests to authenticated;
grant select on public.audit_logs to authenticated;

grant execute on function public.has_platform_permission(text) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.my_tenant_ids() to authenticated;
grant execute on function public.has_tenant_permission(uuid, text) to authenticated;
grant execute on function public.bootstrap_first_platform_owner() to authenticated;
grant execute on function public.review_recruiter_request(uuid, public.recruiter_request_status, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('user-media', 'user-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  (
    'company-assets',
    'company-assets',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  ),
  (
    'verification-documents',
    'verification-documents',
    false,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "user_media_select_own_files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "user_media_insert_own_files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "user_media_update_own_files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'user-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "user_media_delete_own_files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "company_assets_select_for_members_or_platform_admins"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'company-assets'
  and (
    public.has_platform_permission('tenant:read')
    or public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  )
);

create policy "company_assets_insert_for_company_managers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-assets'
  and owner = auth.uid()
  and public.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'company_profile:update')
);

create policy "company_assets_update_for_company_managers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'company-assets'
  and owner = auth.uid()
  and public.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'company_profile:update')
)
with check (
  bucket_id = 'company-assets'
  and owner = auth.uid()
  and public.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'company_profile:update')
);

create policy "company_assets_delete_for_company_managers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-assets'
  and owner = auth.uid()
  and public.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'company_profile:update')
);

create policy "verification_documents_select_for_requester_or_reviewers"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_platform_permission('recruiter_request:review')
  )
);

create policy "verification_documents_insert_for_requester"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'verification-documents'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "verification_documents_update_for_requester"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'verification-documents'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'verification-documents'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "verification_documents_delete_for_requester_or_reviewers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'verification-documents'
  and (
    (
      owner = auth.uid()
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    or public.has_platform_permission('recruiter_request:review')
  )
);
