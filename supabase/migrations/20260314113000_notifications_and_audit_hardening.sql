create schema if not exists private;

alter table public.audit_logs
  add column if not exists source text not null default 'legacy',
  add column if not exists schema_name text,
  add column if not exists record_id uuid,
  add column if not exists actor_membership_id uuid references public.memberships (id) on delete set null,
  add column if not exists changed_fields text[] not null default '{}'::text[],
  add column if not exists old_record jsonb,
  add column if not exists new_record jsonb,
  add column if not exists request_headers jsonb not null default '{}'::jsonb,
  add column if not exists jwt_claims jsonb not null default '{}'::jsonb,
  add column if not exists transaction_id bigint;

update public.audit_logs
set schema_name = coalesce(schema_name, 'public'),
    source = coalesce(source, 'legacy'),
    record_id = coalesce(record_id, nullif(entity_id, '')::uuid)
where schema_name is null
   or source is null
   or (record_id is null and entity_id ~* '^[0-9a-f-]{36}$');

create index if not exists audit_logs_event_lookup_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_record_lookup_idx on public.audit_logs (record_id, created_at desc);
create index if not exists audit_logs_source_lookup_idx on public.audit_logs (source, created_at desc);

create or replace function private.current_user_id()
returns uuid
language sql
stable
set search_path to 'public'
as $$
  select auth.uid()
$$;

create or replace function private.current_request_headers()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function private.current_jwt_claims()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function private.current_membership_id(target_tenant uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select m.id
  from public.memberships m
  where m.tenant_id = target_tenant
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1
$$;

create or replace function private.resolve_audit_tenant_id(table_name text, new_row jsonb, old_row jsonb)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  resolved uuid;
begin
  resolved := coalesce((new_row ->> 'tenant_id')::uuid, (old_row ->> 'tenant_id')::uuid);

  if resolved is not null then
    return resolved;
  end if;

  case table_name
    when 'membership_roles' then
      select m.tenant_id
      into resolved
      from public.memberships m
      where m.id = coalesce((new_row ->> 'membership_id')::uuid, (old_row ->> 'membership_id')::uuid);
    when 'tenant_role_permissions' then
      select tr.tenant_id
      into resolved
      from public.tenant_roles tr
      where tr.id = coalesce((new_row ->> 'role_id')::uuid, (old_row ->> 'role_id')::uuid);
    when 'company_profiles' then
      resolved := coalesce((new_row ->> 'tenant_id')::uuid, (old_row ->> 'tenant_id')::uuid);
    when 'recruiter_requests' then
      resolved := coalesce((new_row ->> 'approved_tenant_id')::uuid, (old_row ->> 'approved_tenant_id')::uuid);
    when 'notification_deliveries' then
      select n.tenant_id
      into resolved
      from public.notifications n
      where n.id = coalesce((new_row ->> 'notification_id')::uuid, (old_row ->> 'notification_id')::uuid);
    when 'notification_delivery_logs' then
      select n.tenant_id
      into resolved
      from public.notification_deliveries nd
      join public.notifications n on n.id = nd.notification_id
      where nd.id = coalesce((new_row ->> 'delivery_id')::uuid, (old_row ->> 'delivery_id')::uuid);
    else
      resolved := null;
  end case;

  return resolved;
end;
$$;

create or replace function private.jsonb_changed_fields(old_row jsonb, new_row jsonb)
returns text[]
language sql
stable
set search_path to 'public'
as $$
  select coalesce(array_agg(keys.key order by keys.key), '{}'::text[])
  from jsonb_object_keys(coalesce(old_row, '{}'::jsonb) || coalesce(new_row, '{}'::jsonb)) as keys(key)
  where coalesce(old_row -> keys.key, 'null'::jsonb) is distinct from coalesce(new_row -> keys.key, 'null'::jsonb)
$$;

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_id uuid := private.current_user_id();
  new_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  old_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  resolved_record_id uuid := coalesce((new_row ->> 'id')::uuid, (old_row ->> 'id')::uuid);
  resolved_tenant_id uuid := private.resolve_audit_tenant_id(tg_table_name, new_row, old_row);
begin
  insert into public.audit_logs (
    actor_user_id,
    actor_membership_id,
    tenant_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    source,
    schema_name,
    record_id,
    changed_fields,
    old_record,
    new_record,
    request_headers,
    jwt_claims,
    transaction_id,
    created_at
  )
  values (
    actor_id,
    private.current_membership_id(resolved_tenant_id),
    resolved_tenant_id,
    lower(tg_op),
    tg_table_name,
    coalesce(resolved_record_id::text, old_row ->> 'id', new_row ->> 'id', 'unknown'),
    jsonb_build_object(
      'schema_name', tg_table_schema,
      'table_name', tg_table_name,
      'changed_fields', private.jsonb_changed_fields(old_row, new_row),
      'old_record', old_row,
      'new_record', new_row
    ),
    'db_trigger',
    tg_table_schema,
    resolved_record_id,
    private.jsonb_changed_fields(old_row, new_row),
    old_row,
    new_row,
    private.current_request_headers(),
    private.current_jwt_claims(),
    txid_current(),
    timezone('utc', now())
  );

  return coalesce(new, old);
end;
$$;

create or replace function private.attach_audit_trigger(target_schema text, target_table text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  qualified_table text := format('%I.%I', target_schema, target_table);
begin
  if target_schema <> 'public' or target_table = 'audit_logs' then
    return;
  end if;

  execute format('drop trigger if exists audit_row_changes on %s', qualified_table);
  execute format(
    'create trigger audit_row_changes after insert or update or delete on %s for each row execute function private.audit_row_change()',
    qualified_table
  );
end;
$$;

create or replace function private.audit_auto_attach()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
      and schema_name = 'public'
  loop
    perform private.attach_audit_trigger('public', split_part(cmd.object_identity, '.', 2));
  end loop;
end;
$$;

drop event trigger if exists audit_auto_attach;
create event trigger audit_auto_attach
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute function private.audit_auto_attach();

do $$
declare
  table_record record;
begin
  for table_record in
    select t.table_name
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and t.table_name <> 'audit_logs'
  loop
    perform private.attach_audit_trigger('public', table_record.table_name);
  end loop;
end
$$;

insert into public.permissions (id, code, resource, action, scope, description, created_at)
select
  extensions.gen_random_uuid(),
  'notification:manage',
  'notification',
  'manage',
  'tenant',
  'Create and manage notifications and push subscriptions',
  timezone('utc', now())
where not exists (
  select 1
  from public.permissions
  where code = 'notification:manage'
);

insert into public.tenant_role_permissions (role_id, permission_id, created_at)
select tr.id, p.id, timezone('utc', now())
from public.tenant_roles tr
join public.permissions p on p.code = 'notification:manage'
where tr.code in ('tenant_owner', 'tenant_admin', 'recruiter')
on conflict do nothing;

create table if not exists public.notification_preferences (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  quiet_hours_json jsonb not null default '{}'::jsonb,
  locale text not null default 'es',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists notification_preferences_global_user_key
  on public.notification_preferences (user_id)
  where tenant_id is null;

create unique index if not exists notification_preferences_tenant_user_key
  on public.notification_preferences (user_id, tenant_id)
  where tenant_id is not null;

create table if not exists public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  recipient_user_id uuid not null references public.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  action_url text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  device_label text,
  device_kind text,
  user_agent text,
  locale text not null default 'es',
  permission_state text not null default 'granted',
  is_active boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, is_active, last_seen_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'push')),
  push_subscription_id uuid references public.push_subscriptions (id) on delete set null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'processing', 'sent', 'failed', 'read', 'clicked')),
  provider_name text not null default 'web_push',
  provider_message_id text,
  response_code integer,
  response_payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists notification_deliveries_notification_idx
  on public.notification_deliveries (notification_id, channel, delivery_status);

create table if not exists public.notification_delivery_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  delivery_id uuid not null references public.notification_deliveries (id) on delete cascade,
  log_level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists notification_delivery_logs_delivery_idx
  on public.notification_delivery_logs (delivery_id, created_at desc);

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row
execute function public.set_row_updated_at();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
before update on public.notifications
for each row
execute function public.set_row_updated_at();

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_row_updated_at();

drop trigger if exists notification_deliveries_set_updated_at on public.notification_deliveries;
create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row
execute function public.set_row_updated_at();

drop trigger if exists notification_delivery_logs_set_updated_at on public.notification_delivery_logs;
create trigger notification_delivery_logs_set_updated_at
before update on public.notification_delivery_logs
for each row
execute function public.set_row_updated_at();

select private.attach_audit_trigger('public', 'notification_preferences');
select private.attach_audit_trigger('public', 'notifications');
select private.attach_audit_trigger('public', 'push_subscriptions');
select private.attach_audit_trigger('public', 'notification_deliveries');
select private.attach_audit_trigger('public', 'notification_delivery_logs');

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh_key text,
  p_auth_key text,
  p_device_label text default null,
  p_device_kind text default null,
  p_locale text default 'es',
  p_user_agent text default null,
  p_tenant_id uuid default null
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  current_user uuid := auth.uid();
  subscription_row public.push_subscriptions;
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  insert into public.push_subscriptions (
    user_id,
    tenant_id,
    endpoint,
    p256dh_key,
    auth_key,
    device_label,
    device_kind,
    user_agent,
    locale,
    permission_state,
    is_active,
    last_seen_at
  )
  values (
    current_user,
    p_tenant_id,
    p_endpoint,
    p_p256dh_key,
    p_auth_key,
    p_device_label,
    p_device_kind,
    p_user_agent,
    p_locale,
    'granted',
    true,
    timezone('utc', now())
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        tenant_id = excluded.tenant_id,
        p256dh_key = excluded.p256dh_key,
        auth_key = excluded.auth_key,
        device_label = excluded.device_label,
        device_kind = excluded.device_kind,
        user_agent = excluded.user_agent,
        locale = excluded.locale,
        permission_state = 'granted',
        is_active = true,
        last_seen_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
  returning * into subscription_row;

  return subscription_row;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  current_user uuid := auth.uid();
  notification_row public.notifications;
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_notification_id
    and recipient_user_id = current_user
  returning * into notification_row;

  if notification_row.id is null then
    raise exception 'Notification not found or not accessible';
  end if;

  return notification_row;
end;
$$;

grant execute on function public.register_push_subscription(text, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create policy "notification_preferences_select_own_or_managers"
on public.notification_preferences
for select
to authenticated
using (
  user_id = auth.uid()
  or is_platform_admin()
  or (tenant_id is not null and has_tenant_permission(tenant_id, 'notification:manage'))
);

create policy "notification_preferences_insert_own_or_platform_admin"
on public.notification_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
  or is_platform_admin()
);

create policy "notification_preferences_update_own_or_platform_admin"
on public.notification_preferences
for update
to authenticated
using (
  user_id = auth.uid()
  or is_platform_admin()
)
with check (
  user_id = auth.uid()
  or is_platform_admin()
);

create policy "notification_preferences_delete_own_or_platform_admin"
on public.notification_preferences
for delete
to authenticated
using (
  user_id = auth.uid()
  or is_platform_admin()
);

create policy "notifications_select_recipient_or_managers"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or is_platform_admin()
  or (tenant_id is not null and has_tenant_permission(tenant_id, 'notification:manage'))
);

create policy "notifications_insert_for_managers"
on public.notifications
for insert
to authenticated
with check (
  is_platform_admin()
  or (tenant_id is not null and has_tenant_permission(tenant_id, 'notification:manage'))
);

create policy "notifications_update_for_recipient_or_managers"
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  or is_platform_admin()
  or (tenant_id is not null and has_tenant_permission(tenant_id, 'notification:manage'))
)
with check (
  recipient_user_id = auth.uid()
  or is_platform_admin()
  or (tenant_id is not null and has_tenant_permission(tenant_id, 'notification:manage'))
);

create policy "push_subscriptions_select_own_or_platform_admin"
on public.push_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
  or is_platform_admin()
);

create policy "push_subscriptions_insert_own_or_platform_admin"
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  or is_platform_admin()
);

create policy "push_subscriptions_update_own_or_platform_admin"
on public.push_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
  or is_platform_admin()
)
with check (
  user_id = auth.uid()
  or is_platform_admin()
);

create policy "push_subscriptions_delete_own_or_platform_admin"
on public.push_subscriptions
for delete
to authenticated
using (
  user_id = auth.uid()
  or is_platform_admin()
);

create policy "notification_deliveries_select_managers"
on public.notification_deliveries
for select
to authenticated
using (
  is_platform_admin()
  or exists(
    select 1
    from public.notifications n
    where n.id = notification_id
      and n.tenant_id is not null
      and has_tenant_permission(n.tenant_id, 'notification:manage')
  )
);

create policy "notification_deliveries_insert_managers"
on public.notification_deliveries
for insert
to authenticated
with check (
  is_platform_admin()
  or exists(
    select 1
    from public.notifications n
    where n.id = notification_id
      and n.tenant_id is not null
      and has_tenant_permission(n.tenant_id, 'notification:manage')
  )
);

create policy "notification_deliveries_update_managers"
on public.notification_deliveries
for update
to authenticated
using (
  is_platform_admin()
  or exists(
    select 1
    from public.notifications n
    where n.id = notification_id
      and n.tenant_id is not null
      and has_tenant_permission(n.tenant_id, 'notification:manage')
  )
)
with check (
  is_platform_admin()
  or exists(
    select 1
    from public.notifications n
    where n.id = notification_id
      and n.tenant_id is not null
      and has_tenant_permission(n.tenant_id, 'notification:manage')
  )
);

create policy "notification_delivery_logs_select_managers"
on public.notification_delivery_logs
for select
to authenticated
using (
  is_platform_admin()
  or exists(
    select 1
    from public.notification_deliveries nd
    join public.notifications n on n.id = nd.notification_id
    where nd.id = delivery_id
      and n.tenant_id is not null
      and has_tenant_permission(n.tenant_id, 'notification:manage')
  )
);

create policy "notification_delivery_logs_insert_managers"
on public.notification_delivery_logs
for insert
to authenticated
with check (
  is_platform_admin()
  or exists(
    select 1
    from public.notification_deliveries nd
    join public.notifications n on n.id = nd.notification_id
    where nd.id = delivery_id
      and n.tenant_id is not null
      and has_tenant_permission(n.tenant_id, 'notification:manage')
  )
);

create policy "notification_delivery_logs_update_managers"
on public.notification_delivery_logs
for update
to authenticated
using (
  is_platform_admin()
  or exists(
    select 1
    from public.notification_deliveries nd
    join public.notifications n on n.id = nd.notification_id
    where nd.id = delivery_id
      and n.tenant_id is not null
      and has_tenant_permission(n.tenant_id, 'notification:manage')
  )
)
with check (
  is_platform_admin()
  or exists(
    select 1
    from public.notification_deliveries nd
    join public.notifications n on n.id = nd.notification_id
    where nd.id = delivery_id
      and n.tenant_id is not null
      and has_tenant_permission(n.tenant_id, 'notification:manage')
  )
);
