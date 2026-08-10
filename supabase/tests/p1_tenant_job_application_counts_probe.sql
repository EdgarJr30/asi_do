-- Prueba de corrección de `tenant_job_application_counts` (TASK-277).
--
-- El contador es un agregado que la pantalla muestra junto al título de cada
-- vacante, así que un error aquí no se ve como fallo: se ve como una vacante con
-- menos postulantes de los que tiene, y nadie la abre.
--
-- Lo que se vigila: que cuente lo que hay, que **no** cuente lo del tenant
-- vecino, que un tenant sin postulaciones devuelva objeto vacío y no ausencia de
-- dato, y que un reclutador ajeno no lo pueda leer.
--
-- Termina en RAISE EXCEPTION: la transacción se revierte y no queda ni una fila.
do $probe$
declare
  v_tenant uuid := 'f2000000-0000-4000-a000-000000000001';
  v_tenant_b uuid := 'f2000000-0000-4000-a000-000000000002';
  v_user uuid := 'f1000000-0000-4000-a000-000000000006';
  v_otro uuid := 'f1000000-0000-4000-a000-000000000007';
  v_company uuid := 'f3000000-0000-4000-a000-000000000001';
  v_profiles uuid[];
  v_job uuid;
  v_job_vacia uuid;
  v_res jsonb;
  v_esperado int;
  v_out text := '';
  v_fail int := 0;
  v_denegado boolean := false;
begin
  if not exists (select 1 from public.tenants where id = v_tenant)
     or not exists (select 1 from public.company_profiles where id = v_company) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | faltan los fixtures: carga supabase/tests/fixtures.sql';
  end if;

  if not public.has_active_asi_access(v_user) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | el reclutador % no tiene acceso ASI activo', v_user;
  end if;

  select array_agg(id order by id) into v_profiles from public.candidate_profiles;
  if coalesce(array_length(v_profiles, 1), 0) < 2 then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | hacen falta 2 perfiles de candidato: carga supabase/tests/fixtures.sql';
  end if;

  -- Una vacante con dos postulaciones y otra sin ninguna. La segunda es la que
  -- distingue "cero" de "no aparece": la pantalla debe poder mostrar 0.
  insert into public.job_postings (
    tenant_id, company_profile_id, created_by_user_id, title, slug, summary, description, status
  )
  values (v_tenant, v_company, v_user, 'Probe 277 Con postulantes', 'probe-277-con', 'probe', 'probe', 'published')
  returning id into v_job;

  insert into public.job_postings (
    tenant_id, company_profile_id, created_by_user_id, title, slug, summary, description, status
  )
  values (v_tenant, v_company, v_user, 'Probe 277 Sin postulantes', 'probe-277-sin', 'probe', 'probe', 'published')
  returning id into v_job_vacia;

  insert into public.applications (
    job_posting_id, candidate_profile_id, candidate_display_name_snapshot,
    candidate_email_snapshot, submitted_at, status_public
  )
  select v_job, v_profiles[i], 'Probe 277 Candidato ' || i, 'probe277-' || i || '@example.test',
         timezone('utc', now()), 'submitted'
  from generate_series(1, 2) as i;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  v_res := public.tenant_job_application_counts(v_tenant);

  -- ── A. Cuenta lo que hay ──────────────────────────────────────────────────
  if coalesce((v_res ->> v_job::text)::int, -1) <> 2 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A1 la vacante con 2 postulaciones dio %s', coalesce(v_res ->> v_job::text, 'ausente'));
  else
    v_out := v_out || ' | A1 conteo ok';
  end if;

  -- ── B. Una vacante sin postulaciones no aparece (el cliente resuelve a 0) ──
  if v_res ? v_job_vacia::text then
    v_fail := v_fail + 1;
    v_out := v_out || ' | B1 la vacante sin postulaciones apareció en el objeto';
  else
    v_out := v_out || ' | B1 vacante vacía omitida ok';
  end if;

  -- ── C. El total coincide con un group by directo ──────────────────────────
  select count(*) into v_esperado
  from public.applications a
  join public.job_postings j on j.id = a.job_posting_id
  where j.tenant_id = v_tenant;

  if (select coalesce(sum(value::int), 0) from jsonb_each_text(v_res)) <> v_esperado then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | C1 la suma de contadores no cuadra con las %s postulaciones del tenant', v_esperado);
  else
    v_out := v_out || ' | C1 suma ok';
  end if;

  -- ── D. No cuenta vacantes del tenant vecino ───────────────────────────────
  if exists (
    select 1
    from jsonb_object_keys(v_res) k
    join public.job_postings j on j.id = k::uuid
    where j.tenant_id <> v_tenant
  ) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | D1 se colaron vacantes de otro tenant';
  else
    v_out := v_out || ' | D1 aislamiento ok';
  end if;

  -- ── E. Un tenant sin postulaciones devuelve objeto vacío, no null ─────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
  delete from public.applications a
  using public.job_postings j
  where j.id = a.job_posting_id and j.tenant_id = v_tenant_b;

  v_res := public.tenant_job_application_counts(v_tenant_b);
  if v_res is null or v_res <> '{}'::jsonb then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | E1 tenant sin postulaciones devolvió %s', coalesce(v_res::text, 'null'));
  else
    v_out := v_out || ' | E1 objeto vacío ok';
  end if;

  -- ── F. Sin permiso sobre el tenant, no se responde ────────────────────────
  begin
    perform public.tenant_job_application_counts(v_tenant);
  exception when insufficient_privilege then
    v_denegado := true;
  end;
  if not v_denegado then
    v_fail := v_fail + 1;
    v_out := v_out || ' | F1 un reclutador de otro tenant leyó los contadores ajenos';
  else
    v_out := v_out || ' | F1 denegación ok';
  end if;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
