-- Historial de accesos de usuarios.
--
-- Supabase Auth conserva IP y user-agent en auth.sessions. Este módulo copia
-- únicamente los datos necesarios a una tabla de aplicación con retención
-- limitada, acceso administrativo explícito y auditoría de cada consulta.

create extension if not exists pg_cron;

create table if not exists public.user_access_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  auth_session_id uuid not null unique,
  signed_in_at timestamptz not null,
  last_seen_at timestamptz not null,
  ip_address inet,
  user_agent text,
  authentication_method text,
  client_timezone text,
  client_language text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_access_logs_timezone_length_chk
    check (client_timezone is null or char_length(client_timezone) between 1 and 100),
  constraint user_access_logs_language_length_chk
    check (client_language is null or char_length(client_language) between 1 and 35)
);

create index if not exists user_access_logs_signed_in_idx
  on public.user_access_logs (signed_in_at desc);

create index if not exists user_access_logs_user_signed_in_idx
  on public.user_access_logs (user_id, signed_in_at desc);

alter table public.user_access_logs enable row level security;

revoke all on table public.user_access_logs from anon, authenticated;

-- La migración de auditoría agrega automáticamente un trigger genérico a toda
-- tabla public. Aquí no se usa porque duplicaría IP/user-agent sin respetar la
-- retención de este registro. La tabla ya es, por sí misma, el evento de
-- auditoría y las lecturas administrativas se registran semánticamente abajo.
drop trigger if exists audit_row_changes on public.user_access_logs;

create or replace function private.capture_auth_session_access_log()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.user_access_logs (
    user_id,
    auth_session_id,
    signed_in_at,
    last_seen_at,
    ip_address,
    user_agent,
    created_at,
    updated_at
  )
  values (
    new.user_id,
    new.id,
    new.created_at,
    greatest(
      new.created_at,
      coalesce(new.updated_at, new.created_at),
      coalesce(new.refreshed_at, new.created_at)
    ),
    new.ip,
    nullif(left(new.user_agent, 1000), ''),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (auth_session_id) do update
  set last_seen_at = greatest(public.user_access_logs.last_seen_at, excluded.last_seen_at),
      ip_address = coalesce(excluded.ip_address, public.user_access_logs.ip_address),
      user_agent = coalesce(excluded.user_agent, public.user_access_logs.user_agent),
      updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists capture_user_access_log on auth.sessions;
create trigger capture_user_access_log
after insert or update of refreshed_at, user_agent, ip on auth.sessions
for each row execute function private.capture_auth_session_access_log();

-- Recupera las sesiones que Supabase todavía conserva al momento de desplegar
-- la migración para no iniciar el módulo completamente vacío.
insert into public.user_access_logs (
  user_id,
  auth_session_id,
  signed_in_at,
  last_seen_at,
  ip_address,
  user_agent,
  created_at,
  updated_at
)
select
  s.user_id,
  s.id,
  s.created_at,
  greatest(
    s.created_at,
    coalesce(s.updated_at, s.created_at),
    coalesce(s.refreshed_at, s.created_at)
  ),
  s.ip,
  nullif(left(s.user_agent, 1000), ''),
  timezone('utc', now()),
  timezone('utc', now())
from auth.sessions s
join public.users u on u.id = s.user_id
where s.created_at >= timezone('utc', now()) - interval '180 days'
on conflict (auth_session_id) do nothing;

create or replace function public.enrich_current_access_log(
  p_timezone text default null,
  p_language text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_authentication_method text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      v_session_id := null;
  end;

  if v_session_id is null then
    return;
  end if;

  v_authentication_method := coalesce(
    auth.jwt() -> 'amr' -> 0 ->> 'method',
    auth.jwt() -> 'app_metadata' ->> 'provider'
  );

  update public.user_access_logs
  set client_timezone = case
        when nullif(trim(p_timezone), '') is null then client_timezone
        else left(trim(p_timezone), 100)
      end,
      client_language = case
        when nullif(trim(p_language), '') is null then client_language
        else left(trim(p_language), 35)
      end,
      authentication_method = coalesce(
        nullif(left(v_authentication_method, 50), ''),
        authentication_method
      ),
      updated_at = timezone('utc', now())
  where auth_session_id = v_session_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.enrich_current_access_log(text, text) from public;
grant execute on function public.enrich_current_access_log(text, text) to authenticated;

create or replace function public.admin_user_access_log_page(
  p_query text default null,
  p_since timestamptz default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_query text := nullif(trim(coalesce(p_query, '')), '');
  v_result jsonb;
begin
  if not (
    public.is_platform_admin()
    or public.has_platform_permission('audit_log:read')
  ) then
    raise exception 'Insufficient permission to inspect user access logs';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    source,
    schema_name,
    created_at
  )
  values (
    auth.uid(),
    'user_access_log.viewed',
    'user_access_logs',
    'page',
    jsonb_build_object(
      'has_search', v_query is not null,
      'since', p_since,
      'limit', v_limit,
      'offset', v_offset
    ),
    'access_log_review',
    'public',
    timezone('utc', now())
  );

  with access_rows as (
    select
      l.id,
      l.user_id,
      l.auth_session_id,
      u.email,
      u.full_name,
      u.display_name,
      u.last_sign_in_at,
      l.signed_in_at,
      l.last_seen_at,
      l.ip_address,
      l.user_agent,
      l.authentication_method,
      l.client_timezone,
      l.client_language,
      row_number() over (
        partition by l.user_id
        order by l.signed_in_at desc, l.id desc
      ) = 1 as is_latest_for_user
    from public.user_access_logs l
    join public.users u on u.id = l.user_id
  ),
  filtered_rows as (
    select *
    from access_rows r
    where (p_since is null or r.signed_in_at >= p_since)
      and (
        v_query is null
        or coalesce(r.email, '') ilike '%' || v_query || '%'
        or coalesce(r.full_name, '') ilike '%' || v_query || '%'
        or coalesce(r.display_name, '') ilike '%' || v_query || '%'
        or coalesce(r.ip_address::text, '') ilike '%' || v_query || '%'
      )
  ),
  page_rows as (
    select *
    from filtered_rows
    order by signed_in_at desc, id desc
    limit v_limit
    offset v_offset
  ),
  global_stats as (
    select
      count(*)::integer as total_accesses,
      count(distinct user_id)::integer as users_with_access,
      count(*) filter (
        where signed_in_at >= timezone('utc', now()) - interval '24 hours'
      )::integer as accesses_last_24_hours,
      count(distinct ip_address) filter (
        where ip_address is not null
      )::integer as unique_ip_count
    from public.user_access_logs
  )
  select jsonb_build_object(
    'stats', jsonb_build_object(
      'total_accesses', gs.total_accesses,
      'users_with_access', gs.users_with_access,
      'accesses_last_24_hours', gs.accesses_last_24_hours,
      'unique_ip_count', gs.unique_ip_count
    ),
    'page', jsonb_build_object(
      'limit', v_limit,
      'offset', v_offset,
      'total_count', (select count(*) from filtered_rows),
      'loaded_count', (select count(*) from page_rows),
      'next_offset', case
        when v_offset + (select count(*) from page_rows) < (select count(*) from filtered_rows)
          then v_offset + (select count(*) from page_rows)
        else null
      end
    ),
    'rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pr.id,
            'user_id', pr.user_id,
            'auth_session_id', pr.auth_session_id,
            'email', pr.email,
            'full_name', pr.full_name,
            'display_name', pr.display_name,
            'last_sign_in_at', pr.last_sign_in_at,
            'signed_in_at', pr.signed_in_at,
            'last_seen_at', pr.last_seen_at,
            'ip_address', pr.ip_address::text,
            'user_agent', pr.user_agent,
            'authentication_method', pr.authentication_method,
            'client_timezone', pr.client_timezone,
            'client_language', pr.client_language,
            'is_latest_for_user', pr.is_latest_for_user
          )
          order by pr.signed_in_at desc, pr.id desc
        )
        from page_rows pr
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from global_stats gs;

  return v_result;
end;
$$;

revoke all on function public.admin_user_access_log_page(text, timestamptz, integer, integer) from public;
grant execute on function public.admin_user_access_log_page(text, timestamptz, integer, integer) to authenticated;

create or replace function private.purge_expired_user_access_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.user_access_logs
  where signed_in_at < timezone('utc', now()) - interval '180 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

do $$
begin
  perform cron.unschedule('purge-user-access-logs');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'purge-user-access-logs',
  '17 3 * * *',
  $cron$select private.purge_expired_user_access_logs();$cron$
);
