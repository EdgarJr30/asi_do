-- ─────────────────────────────────────────────────────────────────────────────
-- P2 TASK-267 — postulaciones del workspace sin límite silencioso.
--
-- El cliente resolvía el scoping por tenant trayendo hasta 2000 vacantes y
-- armando un `in (…)` con sus ids: pasado ese techo, las postulaciones de las
-- vacantes sobrantes **desaparecían del listado sin ningún error**. Además las
-- métricas ejecutaban siete conteos exactos, cada uno con su propio recorrido.
--
-- Se sustituye por dos RPC que hacen el join directo `applications → job_postings`
-- por `tenant_id`:
--
--   * `tenant_applications_page` — paginación keyset (cursor sobre la clave de
--     orden + `id` como desempate). A diferencia de `offset`, el coste no crece
--     con la profundidad del scroll y las páginas no se solapan ni saltan filas
--     cuando entran postulaciones nuevas mientras se navega.
--   * `tenant_applications_stats` — un solo recorrido y un solo `group by` para
--     total, últimos 7 días, en entrevista y el desglose por estado.
--
-- El total filtrado se calcula con `count(*) over ()` **solo en la primera
-- página** (cursor nulo): la ventana se evalúa antes del `limit`, así que da el
-- total real en el mismo recorrido que las filas. En las páginas siguientes la
-- expresión se omite para que el `limit` pueda cortar en cuanto se llena.
--
-- Ambas son `security definer` y replican la política de lectura de
-- `applications`: admin de plataforma, o acceso ASI activo + `application:read`
-- en el tenant.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.tenant_applications_page(
  p_tenant_id uuid,
  p_status text default null,
  p_query text default null,
  p_sort text default 'recent',
  p_limit integer default 12,
  p_cursor jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 100);
  v_sort text := case when p_sort in ('recent', 'oldest', 'name') then p_sort else 'recent' end;
  v_status text := nullif(trim(coalesce(p_status, '')), '');
  v_query text := nullif(trim(coalesce(p_query, '')), '');
  v_cursor_submitted timestamptz := nullif(p_cursor ->> 'submitted_at', '')::timestamptz;
  v_cursor_name text := p_cursor ->> 'name';
  v_cursor_id uuid := nullif(p_cursor ->> 'id', '')::uuid;
  v_order text;
  v_keyset text := '';
  v_total_expr text;
  v_sql text;
  v_rows jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_loaded integer := 0;
  v_next jsonb := null;
  v_last jsonb;
begin
  if not (
    ( select public.is_platform_admin() )
    or (
      ( select public.has_active_asi_access((select auth.uid())) )
      and ( select public.has_tenant_permission(p_tenant_id, 'application:read') )
    )
  ) then
    raise exception 'Insufficient permission to read tenant applications'
      using errcode = 'insufficient_privilege';
  end if;

  -- Un estado manipulado en la URL no debe romper la vista: se ignora el filtro.
  if v_status is not null and not exists (
    select 1 from unnest(enum_range(null::public.application_public_status)) as e
    where e::text = v_status
  ) then
    v_status := null;
  end if;

  if v_sort = 'name' then
    v_order := 'lower(candidate_display_name_snapshot) asc, id asc';
    if v_cursor_id is not null and v_cursor_name is not null then
      v_keyset := 'and (lower(a.candidate_display_name_snapshot), a.id) > (lower($5), $6)';
    end if;
  elsif v_sort = 'oldest' then
    v_order := 'submitted_at asc, id asc';
    if v_cursor_id is not null and v_cursor_submitted is not null then
      v_keyset := 'and (a.submitted_at, a.id) > ($4, $6)';
    end if;
  else
    v_order := 'submitted_at desc, id desc';
    if v_cursor_id is not null and v_cursor_submitted is not null then
      v_keyset := 'and (a.submitted_at, a.id) < ($4, $6)';
    end if;
  end if;

  v_total_expr := case when p_cursor is null then 'count(*) over ()' else '0' end;

  -- SQL dinámico solo para el orden y el keyset (fragmentos de una lista
  -- cerrada); todos los valores viajan como parámetros del `using`.
  v_sql := format($q$
    with filtered as (
      select
        a.id,
        a.candidate_display_name_snapshot,
        a.candidate_email_snapshot,
        a.candidate_profile_id,
        a.current_stage_id,
        a.status_public,
        a.submitted_at,
        jp.id as job_id,
        jp.title as job_title,
        jp.slug as job_slug,
        jp.tenant_id as job_tenant_id,
        u.id as user_id,
        u.full_name as user_full_name,
        u.display_name as user_display_name,
        u.email as user_email,
        u.avatar_path as user_avatar_path,
        %s as total_count
      from public.applications a
      join public.job_postings jp on jp.id = a.job_posting_id
      left join public.candidate_profiles cp on cp.id = a.candidate_profile_id
      left join public.users u on u.id = cp.user_id
      where jp.tenant_id = $1
        and ($2 is null or a.status_public = $2::public.application_public_status)
        and (
          $3 is null
          or a.candidate_display_name_snapshot ilike '%%' || $3 || '%%'
          or coalesce(a.candidate_email_snapshot, '') ilike '%%' || $3 || '%%'
          or jp.title ilike '%%' || $3 || '%%'
        )
        %s
      order by %s
      limit $7
    )
    select
      coalesce(max(f.total_count), 0)::integer,
      count(*)::integer,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', f.id,
        'candidate_display_name_snapshot', f.candidate_display_name_snapshot,
        'candidate_email_snapshot', f.candidate_email_snapshot,
        'candidate_profile_id', f.candidate_profile_id,
        'current_stage_id', f.current_stage_id,
        'status_public', f.status_public,
        'submitted_at', f.submitted_at,
        'job_posting', jsonb_build_object(
          'id', f.job_id,
          'title', f.job_title,
          'slug', f.job_slug,
          'tenant_id', f.job_tenant_id
        ),
        'candidate_profile', jsonb_build_object(
          'id', f.candidate_profile_id,
          'user', case when f.user_id is null then null else jsonb_build_object(
            'id', f.user_id,
            'full_name', f.user_full_name,
            'display_name', f.user_display_name,
            'email', f.user_email,
            'avatar_path', f.user_avatar_path
          ) end
        )
      ) order by %s), '[]'::jsonb)
    from filtered f
  $q$, v_total_expr, v_keyset, v_order, v_order);

  execute v_sql
    into v_total, v_loaded, v_rows
    using p_tenant_id, v_status, v_query, v_cursor_submitted, v_cursor_name, v_cursor_id, v_limit;

  -- Cursor de la última fila servida. Si la página no se llenó, no hay más.
  -- En la primera página el total conocido permite cortar exacto; en las
  -- siguientes, una página llena pide otra que puede volver vacía y terminar.
  if v_loaded = v_limit and (p_cursor is not null or v_loaded < v_total) then
    v_last := v_rows -> (v_loaded - 1);
    v_next := jsonb_build_object(
      'submitted_at', v_last -> 'submitted_at',
      'name', v_last -> 'candidate_display_name_snapshot',
      'id', v_last -> 'id'
    );
  end if;

  return jsonb_build_object(
    'rows', v_rows,
    'next_cursor', v_next,
    'page', jsonb_build_object(
      'limit', v_limit,
      'loaded_count', v_loaded,
      -- Solo en la primera página; después la vista conserva el de `pages[0]`.
      'total_count', case when p_cursor is null then v_total else null end
    )
  );
end;
$$;

create or replace function public.tenant_applications_stats(p_tenant_id uuid)
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
    or (
      ( select public.has_active_asi_access((select auth.uid())) )
      and ( select public.has_tenant_permission(p_tenant_id, 'application:read') )
    )
  ) then
    raise exception 'Insufficient permission to read tenant applications'
      using errcode = 'insufficient_privilege';
  end if;

  -- Un recorrido y un `group by`: el resto se deriva del agregado por estado.
  with scoped as (
    select
      a.status_public,
      a.submitted_at >= timezone('utc', now()) - interval '7 days' as is_recent
    from public.applications a
    join public.job_postings jp on jp.id = a.job_posting_id
    where jp.tenant_id = p_tenant_id
  ),
  grouped as (
    select
      status_public,
      count(*)::integer as status_total,
      count(*) filter (where is_recent)::integer as recent_total
    from scoped
    group by status_public
  )
  select jsonb_build_object(
    'total', coalesce(sum(status_total), 0)::integer,
    'recent7d', coalesce(sum(recent_total), 0)::integer,
    'interviewing', coalesce(sum(status_total) filter (where status_public = 'interviewing'), 0)::integer,
    'by_status', coalesce(jsonb_object_agg(status_public, status_total), '{}'::jsonb)
  )
  into v_result
  from grouped;

  return coalesce(v_result, jsonb_build_object(
    'total', 0, 'recent7d', 0, 'interviewing', 0, 'by_status', '{}'::jsonb
  ));
end;
$$;

revoke all on function public.tenant_applications_page(uuid, text, text, text, integer, jsonb)
  from public, anon;
grant execute on function public.tenant_applications_page(uuid, text, text, text, integer, jsonb)
  to authenticated;

revoke all on function public.tenant_applications_stats(uuid) from public, anon;
grant execute on function public.tenant_applications_stats(uuid) to authenticated;
