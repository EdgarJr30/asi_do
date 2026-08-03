-- ─────────────────────────────────────────────────────────────────────────────
-- P1 TASK-270 — Access log: filtros indexables y sin ventana sobre toda la tabla.
--
-- El problema no era la paginación, era el orden de las operaciones. La versión
-- anterior empezaba así:
--
--   with access_rows as (
--     select ..., row_number() over (partition by l.user_id
--                                    order by l.signed_in_at desc) = 1
--     from user_access_logs l join users u on u.id = l.user_id
--   ),
--   filtered_rows as (select * from access_rows where p_since ... or ilike ...)
--
-- La ventana se calculaba **sobre la tabla entera antes de filtrar**. De ahí que
-- `p_since` y la búsqueda no redujeran el trabajo y que ningún índice pudiera
-- ayudar: el coste dependía del total de filas, no del tamaño de la página.
--
-- Medido con 50 000 accesos sintéticos (sembrados y revertidos en la misma
-- transacción, sin dejar rastro):
--
--   página 1        5 llamadas → 1086 ms   (~217 ms por llamada)
--   offset 9000     5 llamadas → 1081 ms   (~216 ms)  ← idéntico a la página 1
--   rango 24 h      5 llamadas →  639 ms
--   búsqueda        5 llamadas → 2104 ms   (~421 ms)
--
-- Que la página 1 y el offset 9000 costaran lo mismo es la prueba: el trabajo no
-- dependía de dónde estuvieras en el listado.
--
-- Cambios:
--   1. Los filtros se aplican directamente sobre `user_access_logs`, de modo que
--      `p_since` puede usar `user_access_logs_signed_in_idx`.
--   2. Desaparece la ventana. `is_latest_for_user` se calcula con un `not exists`
--      apoyado en `user_access_logs_user_signed_in_idx`, y **solo para las filas
--      que se devuelven** — 30 búsquedas por índice en vez de ordenar la tabla.
--      La semántica se conserva: sigue significando «es el acceso más reciente de
--      ese usuario en toda la tabla», no dentro del conjunto filtrado.
--   3. Las métricas globales se extraen a `admin_user_access_log_stats()`, que el
--      cliente puede pedir una sola vez en lugar de recalcularlas en cada página.
--      La RPC de página las sigue devolviendo para no romper el contrato, pero
--      solo en la primera página; en las siguientes viajan en null y el cliente
--      conserva las que ya tenía.
--
-- El contrato JSON (`stats` / `page` / `rows`) no cambia de forma.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Métricas globales, ahora invocables por separado ─────────────────────────
create or replace function public.admin_user_access_log_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not (
    ( select public.is_platform_admin() )
    or ( select public.has_platform_permission('audit_log:read') )
  ) then
    raise exception 'Insufficient permission to inspect user access logs'
      using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'total_accesses', count(*)::integer,
    'users_with_access', count(distinct user_id)::integer,
    'accesses_last_24_hours', count(*) filter (
      where signed_in_at >= timezone('utc', now()) - interval '24 hours'
    )::integer,
    'unique_ip_count', count(distinct ip_address) filter (
      where ip_address is not null
    )::integer
  )
  into v_result
  from public.user_access_logs;

  return v_result;
end;
$$;

revoke all on function public.admin_user_access_log_stats() from public, anon;
grant execute on function public.admin_user_access_log_stats() to authenticated;

-- ── Página del listado ───────────────────────────────────────────────────────
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
  v_total integer;
  v_stats jsonb;
begin
  if not (
    ( select public.is_platform_admin() )
    or ( select public.has_platform_permission('audit_log:read') )
  ) then
    raise exception 'Insufficient permission to inspect user access logs'
      using errcode = 'insufficient_privilege';
  end if;

  -- La lectura del registro de accesos se sigue auditando.
  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, entity_id, payload,
    source, schema_name, created_at
  )
  values (
    auth.uid(), 'user_access_log.viewed', 'user_access_logs', 'page',
    jsonb_build_object(
      'has_search', v_query is not null,
      'since', p_since,
      'limit', v_limit,
      'offset', v_offset
    ),
    'access_log_review', 'public', timezone('utc', now())
  );

  -- Las métricas globales solo se calculan en la primera página. En las
  -- siguientes el cliente conserva las que ya recibió.
  if v_offset = 0 then
    v_stats := public.admin_user_access_log_stats();
  else
    v_stats := null;
  end if;

  with base as (
    select
      l.id,
      l.user_id,
      l.auth_session_id,
      l.signed_in_at,
      l.last_seen_at,
      l.ip_address,
      l.user_agent,
      l.authentication_method,
      l.client_timezone,
      l.client_language,
      u.email,
      u.full_name,
      u.display_name,
      u.last_sign_in_at
    from public.user_access_logs l
    join public.users u on u.id = l.user_id
    where (p_since is null or l.signed_in_at >= p_since)
      and (
        v_query is null
        or coalesce(u.email, '') ilike '%' || v_query || '%'
        or coalesce(u.full_name, '') ilike '%' || v_query || '%'
        or coalesce(u.display_name, '') ilike '%' || v_query || '%'
        or coalesce(l.ip_address::text, '') ilike '%' || v_query || '%'
      )
  ),
  page_rows as (
    select *
    from base
    order by signed_in_at desc, id desc
    limit v_limit
    offset v_offset
  )
  select
    (select count(*)::integer from base),
    jsonb_build_object(
      'stats', v_stats,
      'page', jsonb_build_object(
        'limit', v_limit,
        'offset', v_offset,
        'total_count', (select count(*)::integer from base),
        'loaded_count', (select count(*)::integer from page_rows),
        'next_offset', case
          when v_offset + (select count(*) from page_rows) < (select count(*) from base)
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
              -- Solo para las filas devueltas: búsqueda por índice
              -- (user_id, signed_in_at desc), no una ventana sobre la tabla.
              'is_latest_for_user', not exists (
                select 1
                from public.user_access_logs l2
                where l2.user_id = pr.user_id
                  and (l2.signed_in_at, l2.id) > (pr.signed_in_at, pr.id)
              )
            )
            order by pr.signed_in_at desc, pr.id desc
          )
          from page_rows pr
        ),
        '[]'::jsonb
      )
    )
  into v_total, v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_user_access_log_page(text, timestamptz, integer, integer)
  from public, anon;
grant execute on function public.admin_user_access_log_page(text, timestamptz, integer, integer)
  to authenticated;
