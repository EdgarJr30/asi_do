-- Prueba de corrección de `workspace_dashboard_metrics` (TASK-276).
--
-- El riesgo de este cambio no es que falle: es que devuelva números *creíbles y
-- distintos* a los que la pantalla venía mostrando. La clasificación de etapa
-- vive en tres predicados bilingües (`interview`/`entrevista`, `offer`/`oferta`,
-- `hired`/`contrat`) y un estado terminal que decide quién sigue activo; basta
-- equivocarse en uno para que el dashboard mienta sin que nadie lo note.
--
-- Se siembra un escenario con los nueve casos que separan esos predicados,
-- incluidos los dos que solo un humano distinguiría: una postulación cuyo
-- **estado** no dice entrevista pero cuya **etapa** sí, y una contratada, que
-- cuenta como `hired` y a la vez **deja de estar activa**.
--
-- Se mide por diferencia contra una llamada previa, de modo que la probe no
-- depende de cuántas filas traiga el fixture.
--
-- Termina en RAISE EXCEPTION: la transacción se revierte y no queda ni una fila.
do $probe$
declare
  v_tenant uuid := 'f2000000-0000-4000-a000-000000000001';
  v_user uuid := 'f1000000-0000-4000-a000-000000000006';
  v_otro uuid := 'f1000000-0000-4000-a000-000000000007';
  v_company uuid := 'f3000000-0000-4000-a000-000000000001';
  v_profile uuid;
  v_job uuid;
  v_app_ids uuid[] := '{}';
  v_app uuid;
  v_base jsonb;
  v_after jsonb;
  v_total int;
  v_row jsonb;
  v_count int;
  v_esperado int;
  v_out text := '';
  v_fail int := 0;
  v_denegado boolean := false;
  -- estado, etapa, y lo que cada fila debe aportar a los contadores.
  v_casos text[][] := array[
    array['submitted',    'applied'],
    array['in_review',    'screening'],
    array['interviewing', 'interview'],
    array['submitted',    'interview'],
    array['offer',        'offer'],
    array['submitted',    'offer'],
    array['hired',        'hired'],
    array['rejected',     'rejected'],
    array['withdrawn',    'applied']
  ];
begin
  if not exists (select 1 from public.tenants where id = v_tenant)
     or not exists (select 1 from public.company_profiles where id = v_company) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | faltan los fixtures: carga supabase/tests/fixtures.sql';
  end if;

  if not public.has_active_asi_access(v_user) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | el reclutador % no tiene acceso ASI activo', v_user;
  end if;

  select id into v_profile from public.candidate_profiles order by id limit 1;
  if v_profile is null then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | sin perfiles de candidato: carga supabase/tests/fixtures.sql';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  -- Línea base con el fixture tal cual, antes de sembrar nada.
  v_base := public.workspace_dashboard_metrics(v_tenant, null, null);

  -- Una vacante por caso: `applications` es única por (vacante, perfil) y el
  -- fixture solo trae dos perfiles de candidato. Solo la primera se publica, así
  -- que `openJobs` sigue moviéndose en 1 y la afirmación no se diluye.
  for i in 1 .. array_length(v_casos, 1) loop
    insert into public.job_postings (
      tenant_id, company_profile_id, created_by_user_id, title, slug, summary, description,
      status, published_at
    )
    values (
      v_tenant, v_company, v_user,
      case when i = 1 then 'Probe 276 Vacante' else 'Probe 276 Vacante ' || i end,
      'probe-276-vacante-' || i, 'probe', 'probe',
      case when i = 1 then 'published' else 'draft' end::public.job_posting_status,
      case when i = 1 then timezone('utc', now()) else null end
    )
    returning id into v_job;

    insert into public.applications (
      job_posting_id, candidate_profile_id, candidate_display_name_snapshot,
      candidate_email_snapshot, submitted_at, status_public, current_stage_id
    )
    values (
      v_job, v_profile, 'Probe 276 Candidato ' || i, 'probe276-' || i || '@example.test',
      timezone('utc', now()) - ((i - 1) || ' minutes')::interval,
      v_casos[i][1]::public.application_public_status,
      (select id from public.pipeline_stages where tenant_id is null and code = v_casos[i][2])
    )
    returning id into v_app;
    v_app_ids := v_app_ids || v_app;
  end loop;

  -- Una nota y una calificación sobre la primera, para los eventos de actividad
  -- y para el promedio de la lista de recientes.
  insert into public.application_notes (application_id, author_user_id, body)
  values (v_app_ids[1], v_user, 'Probe 276 nota');
  insert into public.application_ratings (application_id, author_user_id, score)
  values (v_app_ids[1], v_user, 4);

  v_after := public.workspace_dashboard_metrics(v_tenant, null, null);

  -- ── A. Los cinco contadores, medidos por diferencia ───────────────────────
  -- activos: los 6 no terminales. `hired` sale de activos aunque sea el caso que
  -- más se confunde: contratar cierra la postulación.
  v_count := (v_after -> 'stats' ->> 'activeCandidates')::int - (v_base -> 'stats' ->> 'activeCandidates')::int;
  if v_count <> 6 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A1 activeCandidates esperaba +6, dio +%s', v_count);
  else
    v_out := v_out || ' | A1 activos ok';
  end if;

  v_count := (v_after -> 'stats' ->> 'interviews')::int - (v_base -> 'stats' ->> 'interviews')::int;
  if v_count <> 2 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A2 interviews esperaba +2 (uno por estado, uno solo por etapa), dio +%s', v_count);
  else
    v_out := v_out || ' | A2 entrevistas ok';
  end if;

  v_count := (v_after -> 'stats' ->> 'offers')::int - (v_base -> 'stats' ->> 'offers')::int;
  if v_count <> 2 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A3 offers esperaba +2, dio +%s', v_count);
  else
    v_out := v_out || ' | A3 ofertas ok';
  end if;

  v_count := (v_after -> 'stats' ->> 'hired')::int - (v_base -> 'stats' ->> 'hired')::int;
  if v_count <> 1 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A4 hired esperaba +1, dio +%s', v_count);
  else
    v_out := v_out || ' | A4 contratados ok';
  end if;

  v_count := (v_after -> 'stats' ->> 'openJobs')::int - (v_base -> 'stats' ->> 'openJobs')::int;
  if v_count <> 1 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A5 openJobs esperaba +1, dio +%s', v_count);
  else
    v_out := v_out || ' | A5 vacantes abiertas ok';
  end if;

  -- ── B. El embudo cuenta por etapa y su porcentaje es coherente ────────────
  select count(*) into v_total
  from public.applications a
  join public.job_postings j on j.id = a.job_posting_id
  where j.tenant_id = v_tenant;

  v_count := (
    select (e ->> 'count')::int
    from jsonb_array_elements(v_after -> 'funnel') e
    where e ->> 'name' = 'Entrevista'
  ) - coalesce((
    select (e ->> 'count')::int
    from jsonb_array_elements(v_base -> 'funnel') e
    where e ->> 'name' = 'Entrevista'
  ), 0);
  if v_count <> 2 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | B1 embudo Entrevista esperaba +2, dio +%s', v_count);
  else
    v_out := v_out || ' | B1 embudo ok';
  end if;

  -- El porcentaje se recalcula aquí desde el total real, no se copia del payload.
  for v_row in select e from jsonb_array_elements(v_after -> 'funnel') e loop
    v_esperado := case when v_total > 0
      then round((v_row ->> 'count')::numeric * 100.0 / v_total)::int
      else 0 end;
    if (v_row ->> 'percent')::int <> v_esperado then
      v_fail := v_fail + 1;
      v_out := v_out || format(' | B2 %s: percent %s, esperaba %s sobre %s',
        v_row ->> 'name', v_row ->> 'percent', v_esperado, v_total);
    end if;
  end loop;
  if v_fail = 0 then
    v_out := v_out || ' | B2 porcentajes coherentes';
  end if;

  -- ── C. Recientes: orden, identidad y promedio ─────────────────────────────
  v_row := v_after -> 'recentApplications' -> 0;
  if v_row ->> 'applicationId' <> v_app_ids[1]::text then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C1 la más reciente no encabeza la lista';
  else
    v_out := v_out || ' | C1 orden ok';
  end if;

  -- 4/5 promedio → 80 sobre 100. Un score sin escalar daría 4.
  if coalesce((v_row ->> 'score')::int, -1) <> 80 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | C2 score %s, esperaba 80', coalesce(v_row ->> 'score', 'null'));
  else
    v_out := v_out || ' | C2 score ok';
  end if;

  if v_row ->> 'position' <> 'Probe 276 Vacante' then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | C3 position %s', coalesce(v_row ->> 'position', 'null'));
  else
    v_out := v_out || ' | C3 vacante ok';
  end if;

  -- ── D. Actividad: las tres clases de evento aparecen ──────────────────────
  select count(*) into v_count
  from jsonb_array_elements(v_after -> 'recentActivity') e
  where e ->> 'id' in ('app-' || v_app_ids[1]::text, 'note-' || (
    select id::text from public.application_notes where application_id = v_app_ids[1] limit 1
  ), 'rating-' || (
    select id::text from public.application_ratings where application_id = v_app_ids[1] limit 1
  ));
  if v_count <> 3 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | D1 esperaba los 3 eventos de la postulación, encontró %s', v_count);
  else
    v_out := v_out || ' | D1 actividad ok';
  end if;

  -- ── E. Sin permiso sobre el tenant, no se responde ────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
  begin
    perform public.workspace_dashboard_metrics(v_tenant, null, null);
  exception when insufficient_privilege then
    v_denegado := true;
  end;
  if not v_denegado then
    v_fail := v_fail + 1;
    v_out := v_out || ' | E1 un reclutador de otro tenant leyó el dashboard ajeno';
  else
    v_out := v_out || ' | E1 denegación ok';
  end if;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
