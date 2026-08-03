-- Prueba de corrección de las RPC de postulaciones del workspace (TASK-267).
--
-- Siembra 2500 vacantes sintéticas en un tenant real —por encima del viejo tope
-- de 2000 que el cliente aplicaba en silencio— con una postulación cada una, y
-- comprueba que ninguna se pierde. Termina en RAISE EXCEPTION: la transacción se
-- revierte y no queda ni una fila de prueba.
do $probe$
declare
  v_tenant uuid;
  v_user uuid;
  v_company uuid;
  v_profiles uuid[];
  v_out text := '';
  v_res jsonb;
  v_cursor jsonb;
  v_total int;
  v_real int;
  v_ids uuid[] := '{}';
  v_loaded int;
  v_paginas int := 0;
  v_unicos int;
  v_prev text;
  v_desordenadas int := 0;
begin
  -- Un tenant real con un miembro que pueda leer postulaciones.
  select m.tenant_id, m.user_id
  into v_tenant, v_user
  from public.memberships m
  join public.membership_roles mr on mr.membership_id = m.id and mr.revoked_at is null
  join public.tenant_role_permissions trp on trp.role_id = mr.role_id
  join public.permissions p on p.id = trp.permission_id
  where m.status = 'active'
    and p.code = 'application:read'
    and public.has_active_asi_access(m.user_id)
  limit 1;

  if v_tenant is null then
    raise exception 'PROBE_RESULT: no hay tenant con un miembro que tenga application:read';
  end if;

  select company_profile_id into v_company
  from public.job_postings where tenant_id = v_tenant limit 1;

  if v_company is null then
    select id into v_company from public.company_profiles limit 1;
  end if;

  select array_agg(id) into v_profiles from public.candidate_profiles;

  insert into public.job_postings (tenant_id, company_profile_id, title, slug, summary, description)
  select v_tenant, v_company, 'Probe vacante ' || i, 'probe-267-' || i, 'probe', 'probe'
  from generate_series(1, 2500) as i;

  insert into public.applications (
    job_posting_id, candidate_profile_id, candidate_display_name_snapshot,
    candidate_email_snapshot, submitted_at, status_public
  )
  select
    jp.id,
    v_profiles[1 + (i % array_length(v_profiles, 1))],
    'Probe Candidato ' || lpad(i::text, 4, '0'),
    'probe' || i || '@example.test',
    timezone('utc', now()) - (i || ' minutes')::interval,
    (array['submitted', 'in_review', 'interviewing', 'hired', 'rejected'])[1 + (i % 5)]::public.application_public_status
  from generate_series(1, 2500) as i
  join lateral (select id from public.job_postings where slug = 'probe-267-' || i) jp on true;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  -- A) El total de la primera página coincide con el conteo real del tenant.
  select count(*)::int into v_real
  from public.applications a
  join public.job_postings jp on jp.id = a.job_posting_id
  where jp.tenant_id = v_tenant;

  v_res := public.tenant_applications_page(v_tenant, null, null, 'recent', 100, null);
  v_total := (v_res -> 'page' ->> 'total_count')::int;
  v_out := format('A) total %s vs real %s -> %s', v_total, v_real,
    case when v_total = v_real then 'OK' else 'DESCUADRA' end);

  -- B) Recorrido keyset completo: ni filas omitidas ni repetidas.
  v_cursor := null;
  loop
    v_res := public.tenant_applications_page(v_tenant, null, null, 'recent', 100, v_cursor);
    v_loaded := (v_res -> 'page' ->> 'loaded_count')::int;
    v_paginas := v_paginas + 1;

    select v_ids || coalesce(array_agg((r ->> 'id')::uuid), '{}'::uuid[])
    into v_ids
    from jsonb_array_elements(v_res -> 'rows') r;

    v_cursor := case when v_res -> 'next_cursor' = 'null'::jsonb then null else v_res -> 'next_cursor' end;
    exit when v_cursor is null or v_paginas > 60;
  end loop;

  select count(distinct id)::int into v_unicos from unnest(v_ids) as id;
  v_out := v_out || format(' | B) keyset: %s paginas, %s filas, %s unicas vs %s reales -> %s',
    v_paginas, array_length(v_ids, 1), v_unicos, v_real,
    case when v_unicos = v_real and array_length(v_ids, 1) = v_real then 'OK'
         else 'OMITE O REPITE' end);

  -- C) Orden estable descendente en todo el recorrido.
  v_prev := null;
  for v_res in
    select jsonb_build_object('sa', a.submitted_at, 'id', a.id)
    from unnest(v_ids) with ordinality as u(id, pos)
    join public.applications a on a.id = u.id
    order by u.pos
  loop
    if v_prev is not null and (v_res ->> 'sa') > v_prev then
      v_desordenadas := v_desordenadas + 1;
    end if;
    v_prev := v_res ->> 'sa';
  end loop;
  v_out := v_out || format(' | C) rupturas de orden: %s (esperado 0)', v_desordenadas);

  -- D) Búsqueda más allá del viejo tope: la vacante 2400 debe aparecer.
  v_res := public.tenant_applications_page(v_tenant, null, 'Probe vacante 2400', 'recent', 20, null);
  v_out := v_out || format(' | D) busqueda vacante 2400: %s resultados -> %s',
    (v_res -> 'page' ->> 'total_count')::int,
    case when (v_res -> 'page' ->> 'total_count')::int >= 1 then 'OK' else 'OMITIDA' end);

  -- E) Filtro por estado contra el conteo real.
  v_res := public.tenant_applications_page(v_tenant, 'interviewing', null, 'recent', 20, null);
  select count(*)::int into v_real
  from public.applications a
  join public.job_postings jp on jp.id = a.job_posting_id
  where jp.tenant_id = v_tenant and a.status_public = 'interviewing';
  v_out := v_out || format(' | E) filtro interviewing %s vs real %s -> %s',
    (v_res -> 'page' ->> 'total_count')::int, v_real,
    case when (v_res -> 'page' ->> 'total_count')::int = v_real then 'OK' else 'DESCUADRA' end);

  -- F) Estado manipulado: se ignora el filtro en vez de romper la vista.
  begin
    v_res := public.tenant_applications_page(v_tenant, 'no-existe', null, 'recent', 5, null);
    v_out := v_out || ' | F) estado invalido -> ignorado (correcto)';
  exception when others then
    v_out := v_out || ' | F) estado invalido -> ERROR (regresion)';
  end;

  -- G) Métricas: un solo agregado que debe cuadrar con los datos.
  v_res := public.tenant_applications_stats(v_tenant);
  select count(*)::int into v_real
  from public.applications a
  join public.job_postings jp on jp.id = a.job_posting_id
  where jp.tenant_id = v_tenant;
  v_out := v_out || format(' | G) stats total %s vs real %s -> %s, interviewing %s vs by_status %s',
    (v_res ->> 'total')::int, v_real,
    case when (v_res ->> 'total')::int = v_real then 'OK' else 'DESCUADRA' end,
    (v_res ->> 'interviewing')::int,
    coalesce((v_res -> 'by_status' ->> 'interviewing')::int, 0));

  -- H) Orden por nombre: keyset alfabético sin repeticiones en dos páginas.
  v_res := public.tenant_applications_page(v_tenant, null, null, 'name', 50, null);
  v_cursor := v_res -> 'next_cursor';
  declare
    v_primera text := (v_res -> 'rows' -> 49 ->> 'candidate_display_name_snapshot');
    v_segunda text;
  begin
    v_res := public.tenant_applications_page(v_tenant, null, null, 'name', 50, v_cursor);
    v_segunda := (v_res -> 'rows' -> 0 ->> 'candidate_display_name_snapshot');
    v_out := v_out || format(' | H) nombre: corte %s -> siguiente %s -> %s',
      v_primera, v_segunda,
      case when lower(v_segunda) > lower(v_primera) then 'OK' else 'SOLAPA' end);
  end;

  -- I) Sin permiso debe rechazar.
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  begin
    perform public.tenant_applications_page(v_tenant, null, null, 'recent', 5, null);
    v_out := v_out || ' | I) sin permiso -> PERMITIDO (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | I) sin permiso -> BLOQUEADO';
  end;

  begin
    perform public.tenant_applications_stats(v_tenant);
    v_out := v_out || ' + stats PERMITIDO (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' + stats BLOQUEADO';
  end;

  perform set_config('request.jwt.claims', '', true);
  raise exception 'PROBE_RESULT: %', v_out;
end;
$probe$;
