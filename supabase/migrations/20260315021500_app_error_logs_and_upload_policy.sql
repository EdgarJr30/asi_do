create table if not exists public.app_error_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  route text,
  source text not null,
  severity text not null default 'error' check (severity in ('info', 'warning', 'error', 'fatal')),
  error_code text,
  error_message text not null,
  user_message text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_error_logs_created_idx
  on public.app_error_logs (created_at desc);

create index if not exists app_error_logs_user_idx
  on public.app_error_logs (user_id, created_at desc);

create index if not exists app_error_logs_route_idx
  on public.app_error_logs (route, created_at desc);

create index if not exists app_error_logs_resolved_idx
  on public.app_error_logs (is_resolved, created_at desc);

alter table public.app_error_logs enable row level security;

grant insert on public.app_error_logs to anon, authenticated;
grant select, update on public.app_error_logs to authenticated;

create policy "app_error_logs_insertable_by_clients"
on public.app_error_logs
for insert
to anon, authenticated
with check (
  (auth.uid() is null and user_id is null)
  or auth.uid() = user_id
);

create policy "app_error_logs_readable_by_platform_admins"
on public.app_error_logs
for select
to authenticated
using (public.has_platform_permission('audit_log:read'));

create policy "app_error_logs_updatable_by_platform_admins"
on public.app_error_logs
for update
to authenticated
using (public.has_platform_permission('audit_log:read'))
with check (public.has_platform_permission('audit_log:read'));

drop trigger if exists app_error_logs_set_updated_at on public.app_error_logs;
create trigger app_error_logs_set_updated_at
before update on public.app_error_logs
for each row execute procedure public.set_row_updated_at();

select private.attach_audit_trigger('public', 'app_error_logs');
