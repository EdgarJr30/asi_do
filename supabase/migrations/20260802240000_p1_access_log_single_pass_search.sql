-- ─────────────────────────────────────────────────────────────────────────────
-- P1 TASK-270 (tercera iteración) — un solo recorrido cuando hay búsqueda.
--
-- La iteración anterior arregló la primera página (1086 → 368 ms por 5 llamadas)
-- pero **empeoró la búsqueda** (2104 → 3435 ms): al separar el conteo de la
-- página, el camino con texto recorría y unía la tabla **dos veces**, una para
-- contar y otra para traer las filas.
--
-- Los dos casos quieren planes distintos y por eso se separan explícitamente:
--
--   * **Sin búsqueda** — ni el conteo ni la página necesitan `users` para
--     filtrar. El conteo se resuelve sobre `user_access_logs` con el filtro de
--     fecha (`user_access_logs_signed_in_idx`) y la página baja por el mismo
--     índice. Es el caso habitual al abrir el listado.
--
--   * **Con búsqueda** — el filtro sí necesita `users` (email, nombre) y no es
--     indexable (`ilike '%…%'`), así que el recorrido es inevitable. Lo que sí
--     se puede evitar es hacerlo dos veces: `count(*) over ()` obtiene el total
--     en el mismo paso que las filas.
--
-- El contrato JSON no cambia.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_rows jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_loaded integer := 0;
  v_stats jsonb := null;
begin
  if not (
    ( select public.is_platform_admin() )
    or ( select public.has_platform_permission('audit_log:read') )
  ) then
    raise exception 'Insufficient permission to inspect user access logs'
      using errcode = 'insufficient_privilege';
  end if;

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

  if v_offset = 0 then
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
    into v_stats
    from public.user_access_logs;
  end if;

  if v_query is null then
    -- ── Camino sin búsqueda: todo por índice ─────────────────────────────────
    select count(*)::integer into v_total
    from public.user_access_logs l
    where (p_since is null or l.signed_in_at >= p_since);

    with page_rows as (
      select l.id, l.user_id, l.auth_session_id, l.signed_in_at, l.last_seen_at,
             l.ip_address, l.user_agent, l.authentication_method,
             l.client_timezone, l.client_language,
             u.email, u.full_name, u.display_name, u.last_sign_in_at
      from public.user_access_logs l
      join public.users u on u.id = l.user_id
      where (p_since is null or l.signed_in_at >= p_since)
      order by l.signed_in_at desc, l.id desc
      limit v_limit offset v_offset
    )
    select count(*)::integer,
           coalesce(jsonb_agg(jsonb_build_object(
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
            'is_latest_for_user', not exists (
              select 1 from public.user_access_logs l2
              where l2.user_id = pr.user_id
                and (l2.signed_in_at, l2.id) > (pr.signed_in_at, pr.id)
            )
          ) order by pr.signed_in_at desc, pr.id desc), '[]'::jsonb)
    into v_loaded, v_rows
    from page_rows pr;
  else
    -- ── Camino con búsqueda: un solo recorrido, total incluido ───────────────
    with filtered as (
      select l.id, l.user_id, l.auth_session_id, l.signed_in_at, l.last_seen_at,
             l.ip_address, l.user_agent, l.authentication_method,
             l.client_timezone, l.client_language,
             u.email, u.full_name, u.display_name, u.last_sign_in_at,
             count(*) over () as total_count
      from public.user_access_logs l
      join public.users u on u.id = l.user_id
      where (p_since is null or l.signed_in_at >= p_since)
        and (
          coalesce(u.email, '') ilike '%' || v_query || '%'
          or coalesce(u.full_name, '') ilike '%' || v_query || '%'
          or coalesce(u.display_name, '') ilike '%' || v_query || '%'
          or coalesce(l.ip_address::text, '') ilike '%' || v_query || '%'
        )
    ),
    page_rows as (
      select * from filtered
      order by signed_in_at desc, id desc
      limit v_limit offset v_offset
    )
    -- El JSON se repite en las dos ramas a proposito: extraerlo a una funcion
    -- exigiria pasar un record de 14 columnas, y la duplicacion se lee mejor.
    select coalesce(max(pr.total_count), 0)::integer,
           count(*)::integer,
           coalesce(jsonb_agg(jsonb_build_object(
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
            'is_latest_for_user', not exists (
              select 1 from public.user_access_logs l2
              where l2.user_id = pr.user_id
                and (l2.signed_in_at, l2.id) > (pr.signed_in_at, pr.id)
            )
          ) order by pr.signed_in_at desc, pr.id desc), '[]'::jsonb)
    into v_total, v_loaded, v_rows
    from page_rows pr;
  end if;

  return jsonb_build_object(
    'stats', v_stats,
    'page', jsonb_build_object(
      'limit', v_limit,
      'offset', v_offset,
      'total_count', v_total,
      'loaded_count', v_loaded,
      'next_offset', case
        when v_offset + v_loaded < v_total then v_offset + v_loaded
        else null
      end
    ),
    'rows', v_rows
  );
end;
$$;

revoke all on function public.admin_user_access_log_page(text, timestamptz, integer, integer)
  from public, anon;
grant execute on function public.admin_user_access_log_page(text, timestamptz, integer, integer)
  to authenticated;
