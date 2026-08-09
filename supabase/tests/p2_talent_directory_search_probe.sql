-- Prueba de corrección del directorio de talento (TASK-268).
--
-- Siembra 1500 candidatos sintéticos con experiencias, habilidades e idiomas,
-- recorre el keyset completo en los tres órdenes, comprueba cada filtro contra
-- un conteo equivalente y verifica que el banco de talento de un tenant no se
-- filtra al otro. Termina en RAISE EXCEPTION: la transacción se revierte y no
-- queda ni una fila de prueba.
do $probe$
declare
  v_tenant uuid;
  v_user uuid;
  v_otro_tenant uuid;
  v_out text := '';
  v_res jsonb;
  v_cursor jsonb;
  v_total int;
  v_real int;
  v_ids uuid[] := '{}';
  v_loaded int;
  v_paginas int;
  v_unicos int;
  v_ajenos int;
  v_prev text;
  v_rupturas int;
  v_fila jsonb;
  v_fail int := 0;
begin
  -- Tenant, reclutador y tenant vecino fijos del fixture. El bloque G afirma que
  -- el banco de talento de uno no se filtra al otro: con `limit 1` los dos
  -- extremos de esa afirmacion cambiaban en cada corrida, y sobre base vacia
  -- `v_otro_tenant` quedaba null — es decir, "no se filtra al otro" se cumplia
  -- porque no habia otro.
  v_tenant := 'f2000000-0000-4000-a000-000000000001';
  v_user := 'f1000000-0000-4000-a000-000000000006';
  v_otro_tenant := 'f2000000-0000-4000-a000-000000000002';

  if not exists (select 1 from public.tenants where id = v_tenant)
     or not exists (select 1 from public.tenants where id = v_otro_tenant) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | faltan los dos tenants del fixture: carga supabase/tests/fixtures.sql';
  end if;

  if not exists (
    select 1 from public.memberships m
    join public.membership_roles mr on mr.membership_id = m.id and mr.revoked_at is null
    join public.tenant_role_permissions trp on trp.role_id = mr.role_id
    join public.permissions p on p.id = trp.permission_id
    where m.tenant_id = v_tenant and m.user_id = v_user and m.status = 'active'
      and p.code = 'candidate_directory:read'
  ) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | el fixture % no puede leer el directorio de %', v_user, v_tenant;
  end if;

  -- 1500 candidatos sintéticos. `auth.users` dispara el alta en `public.users`.
  insert into auth.users (id, email, raw_user_meta_data)
  select
    ('00000268-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    'probe268-' || i || '@example.test',
    jsonb_build_object('full_name', 'Probe Talento ' || lpad(i::text, 4, '0'))
  from generate_series(1, 1500) as i;

  insert into public.candidate_profiles (
    user_id, headline, summary, city_name, country_code, desired_role,
    visibility, completeness_score, is_visible_to_recruiters, updated_at
  )
  select
    ('00000268-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    'Titular sintetico ' || i,
    case when i % 7 = 0 then 'Resumen con la palabra rara zoltarium ' || i else 'Resumen sintetico ' || i end,
    'Santo Domingo',
    (array['DO', 'US', 'ES'])[1 + (i % 3)],
    (array['Ingeniero de datos', 'Disenador de producto', 'Contador'])[1 + (i % 3)],
    'public', (i % 100), true,
    timezone('utc', now()) - (i || ' minutes')::interval
  from generate_series(1, 1500) as i;

  insert into public.candidate_experiences (
    candidate_profile_id, company_name, role_title, start_date, is_current, sort_order, summary
  )
  select cp.id, 'Empresa sintetica ' || j, 'Puesto sintetico ' || i,
         current_date - (400 * j), j = 1, j, 'Experiencia sintetica'
  from generate_series(1, 1500) as i
  join lateral (
    select id from public.candidate_profiles
    where user_id = ('00000268-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
  ) cp on true
  cross join generate_series(1, 1 + (i % 3)) as j;

  insert into public.candidate_skills (candidate_profile_id, skill_name, sort_order)
  select cp.id, (array['PostgreSQL', 'TypeScript', 'Contabilidad'])[1 + (i % 3)], 1
  from generate_series(1, 1500) as i
  join lateral (
    select id from public.candidate_profiles
    where user_id = ('00000268-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
  ) cp on true;

  insert into public.candidate_languages (candidate_profile_id, language_name, proficiency_label, sort_order)
  select cp.id, (array['Espanol', 'Ingles'])[1 + (i % 2)], 'Nativo', 1
  from generate_series(1, 1500) as i
  join lateral (
    select id from public.candidate_profiles
    where user_id = ('00000268-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
  ) cp on true;

  -- Banco de talento: 40 guardados para el tenant y 40 distintos para el otro.
  insert into public.talent_pool_entries (tenant_id, candidate_profile_id, saved_by_user_id, created_at)
  select v_tenant, cp.id, v_user, timezone('utc', now()) - (i || ' hours')::interval
  from generate_series(1, 40) as i
  join lateral (
    select id from public.candidate_profiles
    where user_id = ('00000268-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
  ) cp on true;

  if v_otro_tenant is not null then
    insert into public.talent_pool_entries (tenant_id, candidate_profile_id, saved_by_user_id)
    select v_otro_tenant, cp.id, v_user
    from generate_series(100, 139) as i
    join lateral (
      select id from public.candidate_profiles
      where user_id = ('00000268-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
    ) cp on true;
  end if;

  analyze public.candidate_profiles;
  analyze public.candidate_experiences;
  analyze public.candidate_skills;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  -- A) Primera página: total contra el conteo real de visibles.
  select count(*)::int into v_real
  from public.candidate_profiles where is_visible_to_recruiters = true;

  v_res := public.search_candidate_profiles(v_tenant, null, null, null, null, 50, 'relevance', false, null);
  v_total := (v_res -> 'page' ->> 'total_count')::int;
  if v_total <> v_real then v_fail := v_fail + 1; end if;
  v_out := format('A) total %s vs real %s -> %s', v_total, v_real,
    case when v_total = v_real then 'OK' else 'DESCUADRA' end);

  -- B) Recorrido keyset completo en el orden por defecto.
  v_ids := '{}'; v_cursor := null; v_paginas := 0;
  loop
    v_res := public.search_candidate_profiles(v_tenant, null, null, null, null, 50, 'relevance', false, v_cursor);
    v_paginas := v_paginas + 1;
    select v_ids || coalesce(array_agg((r ->> 'candidate_profile_id')::uuid), '{}'::uuid[])
    into v_ids from jsonb_array_elements(v_res -> 'rows') r;
    v_cursor := case when v_res -> 'next_cursor' = 'null'::jsonb then null else v_res -> 'next_cursor' end;
    exit when v_cursor is null or v_paginas > 60;
  end loop;
  select count(distinct id)::int into v_unicos from unnest(v_ids) as id;
  if v_unicos <> v_real or coalesce(array_length(v_ids, 1), 0) <> v_real then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | B) relevancia: %s paginas, %s filas, %s unicas vs %s -> %s',
    v_paginas, coalesce(array_length(v_ids, 1), 0), v_unicos, v_real,
    case when v_unicos = v_real and coalesce(array_length(v_ids, 1), 0) = v_real
      then 'OK' else 'OMITE O REPITE' end);

  -- C) Orden por nombre: recorrido completo y sin rupturas alfabéticas.
  v_ids := '{}'; v_cursor := null; v_paginas := 0; v_prev := null; v_rupturas := 0;
  loop
    v_res := public.search_candidate_profiles(v_tenant, null, null, null, null, 50, 'name', false, v_cursor);
    v_paginas := v_paginas + 1;
    for v_fila in select r from jsonb_array_elements(v_res -> 'rows') r loop
      if v_prev is not null and lower(v_fila ->> 'display_name') < v_prev then
        v_rupturas := v_rupturas + 1;
      end if;
      v_prev := lower(v_fila ->> 'display_name');
    end loop;
    select v_ids || coalesce(array_agg((r ->> 'candidate_profile_id')::uuid), '{}'::uuid[])
    into v_ids from jsonb_array_elements(v_res -> 'rows') r;
    v_cursor := case when v_res -> 'next_cursor' = 'null'::jsonb then null else v_res -> 'next_cursor' end;
    exit when v_cursor is null or v_paginas > 60;
  end loop;
  select count(distinct id)::int into v_unicos from unnest(v_ids) as id;
  if v_unicos <> v_real or v_rupturas <> 0 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | C) nombre: %s unicas vs %s, rupturas de orden %s -> %s',
    v_unicos, v_real, v_rupturas,
    case when v_unicos = v_real and v_rupturas = 0 then 'OK' else 'FALLA' end);

  -- D) Orden por experiencia: recorrido completo sin duplicados.
  v_ids := '{}'; v_cursor := null; v_paginas := 0;
  loop
    v_res := public.search_candidate_profiles(v_tenant, null, null, null, null, 50, 'experience', false, v_cursor);
    v_paginas := v_paginas + 1;
    select v_ids || coalesce(array_agg((r ->> 'candidate_profile_id')::uuid), '{}'::uuid[])
    into v_ids from jsonb_array_elements(v_res -> 'rows') r;
    v_cursor := case when v_res -> 'next_cursor' = 'null'::jsonb then null else v_res -> 'next_cursor' end;
    exit when v_cursor is null or v_paginas > 60;
  end loop;
  select count(distinct id)::int into v_unicos from unnest(v_ids) as id;
  if v_unicos <> v_real then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | D) experiencia: %s unicas vs %s -> %s',
    v_unicos, v_real, case when v_unicos = v_real then 'OK' else 'OMITE O REPITE' end);

  -- E) Búsqueda por texto: palabra rara sembrada en 1 de cada 7 resúmenes.
  v_res := public.search_candidate_profiles(v_tenant, 'zoltarium', null, null, null, 24, 'relevance', false, null);
  select count(*)::int into v_real
  from public.candidate_profiles cp
  where cp.is_visible_to_recruiters = true and coalesce(cp.summary, '') ilike '%zoltarium%';
  if (v_res -> 'page' ->> 'total_count')::int <> v_real then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | E) busqueda texto %s vs real %s -> %s',
    (v_res -> 'page' ->> 'total_count')::int, v_real,
    case when (v_res -> 'page' ->> 'total_count')::int = v_real then 'OK' else 'DESCUADRA' end);

  -- F) Filtros: país, habilidad e idioma contra sus conteos equivalentes.
  v_res := public.search_candidate_profiles(v_tenant, null, 'US', null, null, 24, 'relevance', false, null);
  select count(*)::int into v_real
  from public.candidate_profiles where is_visible_to_recruiters = true and country_code = 'US';
  if (v_res -> 'page' ->> 'total_count')::int <> v_real then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | F) pais %s vs %s -> %s',
    (v_res -> 'page' ->> 'total_count')::int, v_real,
    case when (v_res -> 'page' ->> 'total_count')::int = v_real then 'OK' else 'DESCUADRA' end);

  v_res := public.search_candidate_profiles(v_tenant, null, null, null, 'PostgreSQL', 24, 'relevance', false, null);
  select count(distinct cp.id)::int into v_real
  from public.candidate_profiles cp
  join public.candidate_skills cs on cs.candidate_profile_id = cp.id
  where cp.is_visible_to_recruiters = true and cs.skill_name ilike '%PostgreSQL%';
  if (v_res -> 'page' ->> 'total_count')::int <> v_real then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' + habilidad %s vs %s -> %s',
    (v_res -> 'page' ->> 'total_count')::int, v_real,
    case when (v_res -> 'page' ->> 'total_count')::int = v_real then 'OK' else 'DESCUADRA' end);

  v_res := public.search_candidate_profiles(v_tenant, null, null, 'Ingles', null, 24, 'relevance', false, null);
  select count(distinct cp.id)::int into v_real
  from public.candidate_profiles cp
  join public.candidate_languages cl on cl.candidate_profile_id = cp.id
  where cp.is_visible_to_recruiters = true and cl.language_name ilike '%Ingles%';
  if (v_res -> 'page' ->> 'total_count')::int <> v_real then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' + idioma %s vs %s -> %s',
    (v_res -> 'page' ->> 'total_count')::int, v_real,
    case when (v_res -> 'page' ->> 'total_count')::int = v_real then 'OK' else 'DESCUADRA' end);

  -- G) Guardados: solo los del tenant, y ninguno del otro tenant.
  v_ids := '{}'; v_cursor := null; v_paginas := 0;
  loop
    v_res := public.search_candidate_profiles(v_tenant, null, null, null, null, 25, 'relevance', true, v_cursor);
    v_paginas := v_paginas + 1;
    select v_ids || coalesce(array_agg((r ->> 'candidate_profile_id')::uuid), '{}'::uuid[])
    into v_ids from jsonb_array_elements(v_res -> 'rows') r;
    v_cursor := case when v_res -> 'next_cursor' = 'null'::jsonb then null else v_res -> 'next_cursor' end;
    exit when v_cursor is null or v_paginas > 20;
  end loop;
  select count(distinct id)::int into v_unicos from unnest(v_ids) as id;
  select count(*)::int into v_real from public.talent_pool_entries where tenant_id = v_tenant;
  -- El alias de columna va explícito: `as id` a secas lo sombrea `tpe.id`
  -- dentro del `exists` y la comprobación se vuelve trivialmente cierta.
  select count(*)::int into v_ajenos
  from unnest(v_ids) as u(candidate_id)
  where not exists (
    select 1 from public.talent_pool_entries tpe
    where tpe.tenant_id = v_tenant and tpe.candidate_profile_id = u.candidate_id
  );
  -- La fuga entre tenants es el fallo sin botón de deshacer: el banco de
  -- talento de una organizacion visible desde otra.
  if v_unicos <> v_real or v_ajenos <> 0 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | G) guardados %s vs %s, ajenos %s -> %s',
    v_unicos, v_real, v_ajenos,
    case when v_unicos = v_real and v_ajenos = 0 then 'OK' else 'FUGA ENTRE TENANTS' end);

  -- H) El detalle agregado llega completo en las filas de la página.
  v_res := public.search_candidate_profiles(v_tenant, null, null, null, null, 5, 'relevance', false, null);
  v_fila := v_res -> 'rows' -> 0;
  if v_fila is null
     or coalesce((v_fila ->> 'total_experiences')::int, 0) = 0
     or coalesce(jsonb_array_length(v_fila -> 'skill_names'), 0) = 0
     or coalesce(jsonb_array_length(v_fila -> 'language_names'), 0) = 0
     or v_fila ->> 'latest_role_title' is null then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format(' | H) detalle: experiencias %s, habilidades %s, idiomas %s, ultimo puesto %s',
    v_fila ->> 'total_experiences',
    jsonb_array_length(v_fila -> 'skill_names'),
    jsonb_array_length(v_fila -> 'language_names'),
    case when v_fila ->> 'latest_role_title' is not null then 'presente' else 'AUSENTE' end);

  -- I) Sin permiso debe rechazar.
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  begin
    perform public.search_candidate_profiles(v_tenant, null, null, null, null, 5, 'relevance', false, null);
    v_fail := v_fail + 1;
    v_out := v_out || ' | I) sin permiso -> PERMITIDO (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | I) sin permiso -> BLOQUEADO';
  end;

  perform set_config('request.jwt.claims', '', true);
  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
