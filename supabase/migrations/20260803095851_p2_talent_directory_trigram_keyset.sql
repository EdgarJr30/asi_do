-- ─────────────────────────────────────────────────────────────────────────────
-- P2 TASK-268 — directorio de talento: búsqueda indexable y paginación keyset.
--
-- `search_candidate_profiles` tenía tres problemas que se agravan juntos:
--
--   1. **Cuatro subconsultas correlacionadas por perfil** (último puesto, total
--      de experiencias, habilidades e idiomas) dentro del mismo CTE que lleva
--      `count(*) over ()`. La ventana obliga a materializar **todas** las filas
--      que pasan el filtro, así que esas cuatro subconsultas se ejecutaban para
--      cada candidato del resultado y no solo para los 24 de la página.
--   2. **`ilike '%…%'` sin índice que lo soporte**: cada búsqueda recorría
--      perfiles, experiencias y habilidades de punta a punta.
--   3. **Offset sin desempate único**: el orden terminaba en
--      `completeness_score, updated_at`, que empatan de sobra, así que dos
--      páginas consecutivas podían repetir o saltarse candidatos.
--
-- Se corrigen los tres:
--
--   * **Trigram (`pg_trgm`) en vez de `tsvector`.** El contrato de búsqueda es
--     subcadena en cualquier posición (`ilike '%q%'`); un `tsvector` buscaría por
--     palabra y cambiaría lo que encuentra la caja de búsqueda. GIN trigram
--     acelera exactamente el mismo predicado sin tocar la semántica.
--   * Los campos de una misma tabla se indexan **concatenados con un salto de
--     línea**: un índice por tabla en vez de tres y, como el buscador es de una
--     sola línea, ninguna consulta puede casar a caballo entre dos campos.
--   * **Keyset** con `candidate_profile_id` como desempate final, que es lo que
--     vuelve el orden total y determinista.
--   * Las cuatro subconsultas de detalle se evalúan **después** de recortar la
--     página, sobre los ≤ 24 ids que se devuelven.
--
-- El total filtrado se calcula con `count(*) over ()` solo en la primera página
-- (cursor nulo), igual que en `tenant_applications_page` (TASK-267).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_trgm with schema extensions;

create index if not exists candidate_profiles_search_trgm_idx
  on public.candidate_profiles
  using gin ((
    coalesce(desired_role, '') || E'\n' || coalesce(headline, '') || E'\n' || coalesce(summary, '')
  ) extensions.gin_trgm_ops);

create index if not exists candidate_experiences_search_trgm_idx
  on public.candidate_experiences
  using gin ((
    coalesce(role_title, '') || E'\n' || coalesce(company_name, '') || E'\n' || coalesce(summary, '')
  ) extensions.gin_trgm_ops);

create index if not exists candidate_skills_name_trgm_idx
  on public.candidate_skills using gin (skill_name extensions.gin_trgm_ops);

create index if not exists candidate_languages_name_trgm_idx
  on public.candidate_languages using gin (language_name extensions.gin_trgm_ops);

-- Orden por defecto del directorio (relevancia sin "guardados", y `score`), que
-- es el de la primera pantalla: el keyset baja por este índice sin ordenar.
create index if not exists candidate_profiles_directory_rank_idx
  on public.candidate_profiles (completeness_score desc, updated_at desc, id desc)
  where is_visible_to_recruiters = true;

-- La firma cambia (`p_offset` → `p_cursor`) y el retorno pasa a jsonb, así que la
-- anterior se elimina en vez de quedar como sobrecarga muerta.
drop function if exists public.search_candidate_profiles(uuid, text, text, text, text, integer, integer, text, boolean);

create or replace function public.search_candidate_profiles(
  p_tenant_id uuid,
  p_query text default null,
  p_country_code text default null,
  p_language text default null,
  p_skill text default null,
  p_limit integer default 24,
  p_sort text default 'relevance',
  p_saved_only boolean default false,
  p_cursor jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(coalesce(p_query, '')), '');
  v_skill text := nullif(trim(coalesce(p_skill, '')), '');
  v_language text := nullif(trim(coalesce(p_language, '')), '');
  v_country text := nullif(upper(trim(coalesce(p_country_code, ''))), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 50));
  v_sort text := lower(coalesce(nullif(trim(coalesce(p_sort, '')), ''), 'relevance'));
  v_saved_only boolean := coalesce(p_saved_only, false);
  v_cursor_name text := p_cursor ->> 'name';
  v_cursor_score integer := nullif(p_cursor ->> 'score', '')::integer;
  v_cursor_updated timestamptz := nullif(p_cursor ->> 'updated_at', '')::timestamptz;
  v_cursor_id uuid := nullif(p_cursor ->> 'id', '')::uuid;
  v_cursor_saved timestamptz := nullif(p_cursor ->> 'saved_at', '')::timestamptz;
  v_cursor_experiences bigint := nullif(p_cursor ->> 'experiences', '')::bigint;
  v_order text;
  v_keyset text := '';
  v_experiences_join text := '';
  v_experiences_column text := 'null::bigint';
  v_total_expr text;
  v_sql text;
  v_rows jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_loaded integer := 0;
  v_next jsonb := null;
  v_last jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not (select public.has_tenant_permission(p_tenant_id, 'candidate_directory:read')) then
    raise exception 'Permission denied to search the candidate directory'
      using errcode = 'insufficient_privilege';
  end if;

  if v_sort not in ('relevance', 'score', 'name', 'experience') then
    v_sort := 'relevance';
  end if;

  if v_sort = 'name' then
    -- Único orden ascendente: los desempates lo acompañan para que la
    -- comparación de tuplas del keyset sea válida (todo en el mismo sentido).
    v_order := 'sort_name asc, candidate_profile_id asc';
    if v_cursor_id is not null and v_cursor_name is not null then
      v_keyset := 'and (lower(coalesce(u.display_name, u.full_name)), cp.id) > ($8, $11)';
    end if;
  elsif v_sort = 'experience' then
    v_experiences_join := 'left join lateral ('
      || 'select count(*) as total from public.candidate_experiences ce '
      || 'where ce.candidate_profile_id = cp.id) exp on true';
    v_experiences_column := 'exp.total';
    v_order := 'sort_experiences desc, completeness_score desc, updated_at desc, candidate_profile_id desc';
    if v_cursor_id is not null and v_cursor_experiences is not null then
      v_keyset := 'and (exp.total, cp.completeness_score, cp.updated_at, cp.id) < ($13, $9, $10, $11)';
    end if;
  elsif v_sort = 'relevance' and v_saved_only then
    -- En "Guardados" manda el orden de guardado más reciente.
    v_order := 'saved_at desc, completeness_score desc, updated_at desc, candidate_profile_id desc';
    if v_cursor_id is not null and v_cursor_saved is not null then
      v_keyset := 'and (tpe.created_at, cp.completeness_score, cp.updated_at, cp.id) < ($12, $9, $10, $11)';
    end if;
  else
    v_order := 'completeness_score desc, updated_at desc, candidate_profile_id desc';
    if v_cursor_id is not null and v_cursor_score is not null then
      v_keyset := 'and (cp.completeness_score, cp.updated_at, cp.id) < ($9, $10, $11)';
    end if;
  end if;

  v_total_expr := case when p_cursor is null then 'count(*) over ()' else '0' end;

  -- SQL dinámico solo para el orden, el keyset y el join de conteo (fragmentos de
  -- una lista cerrada); los valores viajan como parámetros del `using`.
  v_sql := format($q$
    with filtered as (
      select
        cp.id as candidate_profile_id,
        cp.completeness_score,
        cp.updated_at,
        tpe.created_at as saved_at,
        lower(coalesce(u.display_name, u.full_name)) as sort_name,
        %s as sort_experiences,
        %s as total_count
      from public.candidate_profiles cp
      join public.users u on u.id = cp.user_id
      left join public.talent_pool_entries tpe
        on tpe.candidate_profile_id = cp.id
       and tpe.tenant_id = $1
      %s
      where cp.is_visible_to_recruiters = true
        and ($6 = false or tpe.id is not null)
        and (
          $2 is null
          or (
            coalesce(cp.desired_role, '') || E'\n' ||
            coalesce(cp.headline, '') || E'\n' ||
            coalesce(cp.summary, '')
          ) ilike '%%' || $2 || '%%'
          or exists (
            select 1 from public.candidate_experiences ce
            where ce.candidate_profile_id = cp.id
              and (
                coalesce(ce.role_title, '') || E'\n' ||
                coalesce(ce.company_name, '') || E'\n' ||
                coalesce(ce.summary, '')
              ) ilike '%%' || $2 || '%%'
          )
          or exists (
            select 1 from public.candidate_skills cs
            where cs.candidate_profile_id = cp.id
              and cs.skill_name ilike '%%' || $2 || '%%'
          )
        )
        and ($3 is null or cp.country_code = $3)
        and (
          $5 is null
          or exists (
            select 1 from public.candidate_skills cs
            where cs.candidate_profile_id = cp.id
              and cs.skill_name ilike '%%' || $5 || '%%'
          )
        )
        and (
          $4 is null
          or exists (
            select 1 from public.candidate_languages cl
            where cl.candidate_profile_id = cp.id
              and cl.language_name ilike '%%' || $4 || '%%'
          )
        )
        %s
      order by %s
      limit $7
    )
    select
      coalesce(max(d.total_count), 0)::integer,
      count(*)::integer,
      coalesce(jsonb_agg(d.row_json order by %s), '[]'::jsonb),
      (array_agg(jsonb_build_object(
        'id', d.candidate_profile_id,
        'score', d.completeness_score,
        'updated_at', d.updated_at,
        'name', d.sort_name,
        'experiences', d.sort_experiences,
        'saved_at', d.saved_at
      ) order by %s))[count(*)]
    from (
      select
        f.*,
        jsonb_build_object(
          'candidate_profile_id', cp.id,
          'user_id', cp.user_id,
          'full_name', u.full_name,
          'display_name', coalesce(u.display_name, u.full_name),
          'avatar_path', u.avatar_path,
          'headline', cp.headline,
          'desired_role', cp.desired_role,
          'city_name', cp.city_name,
          'country_code', cp.country_code,
          'summary', cp.summary,
          'completeness_score', cp.completeness_score,
          'latest_role_title', (
            select ce.role_title from public.candidate_experiences ce
            where ce.candidate_profile_id = cp.id
            order by ce.is_current desc, ce.start_date desc, ce.sort_order asc
            limit 1
          ),
          'total_experiences', (
            select count(*) from public.candidate_experiences ce
            where ce.candidate_profile_id = cp.id
          ),
          'skill_names', coalesce((
            select jsonb_agg(cs.skill_name order by cs.sort_order asc)
            from public.candidate_skills cs
            where cs.candidate_profile_id = cp.id
          ), '[]'::jsonb),
          'language_names', coalesce((
            select jsonb_agg(cl.language_name order by cl.sort_order asc)
            from public.candidate_languages cl
            where cl.candidate_profile_id = cp.id
          ), '[]'::jsonb)
        ) as row_json
      from filtered f
      join public.candidate_profiles cp on cp.id = f.candidate_profile_id
      join public.users u on u.id = cp.user_id
    ) d
  $q$, v_experiences_column, v_total_expr, v_experiences_join, v_keyset, v_order, v_order, v_order);

  execute v_sql
    into v_total, v_loaded, v_rows, v_last
    using p_tenant_id, v_query, v_country, v_language, v_skill, v_saved_only, v_limit,
          v_cursor_name, v_cursor_score, v_cursor_updated, v_cursor_id,
          v_cursor_saved, v_cursor_experiences;

  -- Cursor de la última fila servida. Una página incompleta cierra el recorrido;
  -- en la primera, el total conocido permite cortar exacto.
  if v_loaded = v_limit and (p_cursor is not null or v_loaded < v_total) then
    v_next := v_last;
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

revoke all on function public.search_candidate_profiles(uuid, text, text, text, text, integer, text, boolean, jsonb)
  from public, anon;
grant execute on function public.search_candidate_profiles(uuid, text, text, text, text, integer, text, boolean, jsonb)
  to authenticated;
