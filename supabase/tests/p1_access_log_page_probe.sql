-- Prueba de corrección de la RPC del access log (TASK-270).
-- Siembra accesos sintéticos, comprueba el contrato y termina en RAISE
-- EXCEPTION: la transacción se revierte y no queda ni una fila de prueba.
do $probe$
declare
  v_admin uuid;
  v_out text := '';
  v_res jsonb;
  v_total int;
  v_esperado int;
  v_latest int;
  v_user uuid;
  v_fail int := 0;
  v_usuarios uuid[] := array[
    'f1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000002',
    'f1000000-0000-4000-a000-000000000003', 'f1000000-0000-4000-a000-000000000004',
    'f1000000-0000-4000-a000-000000000005', 'f1000000-0000-4000-a000-000000000006',
    'f1000000-0000-4000-a000-000000000007'
  ]::uuid[];
begin
  if (select count(*) from public.users where id = any(v_usuarios)) <> 7 then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | faltan los fixtures de usuarios: carga supabase/tests/fixtures.sql';
  end if;

  -- 300 accesos repartidos entre los usuarios del fixture.
  insert into public.user_access_logs
    (user_id, auth_session_id, signed_in_at, last_seen_at, ip_address,
     user_agent, authentication_method, client_timezone, client_language)
  select u.id, gen_random_uuid(),
         timezone('utc', now()) - (s.i || ' minutes')::interval,
         timezone('utc', now()) - (s.i || ' minutes')::interval + interval '10 minutes',
         ('10.0.0.' || (s.i % 250))::inet,
         'Mozilla/5.0 (probe)', 'password', 'America/Santo_Domingo', 'es'
  -- El reparto es aritmetico sobre la lista del fixture, no un `offset` sobre
  -- `public.users`: aquel `offset (s.i % 20)` sobre una tabla con menos de 20
  -- filas no devolvia nada para la mayoria de las iteraciones, asi que el numero
  -- de accesos sembrados dependia de cuanta gente hubiera registrada.
  from generate_series(1, 300) as s(i)
  cross join lateral (select v_usuarios[1 + (s.i % 7)] as id) u;

  v_admin := 'f1000000-0000-4000-a000-000000000001';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- A) Primera página: métricas presentes y conteo correcto.
  v_res := public.admin_user_access_log_page(null, null, 30, 0);
  select count(*)::int into v_esperado from public.user_access_logs;
  v_total := (v_res -> 'page' ->> 'total_count')::int;
  if v_total <> v_esperado then v_fail := v_fail + 1; end if;
  v_out := format('A) total_count %s vs real %s -> %s', v_total, v_esperado,
    case when v_total = v_esperado then 'OK' else 'DESCUADRA' end);
  if jsonb_array_length(v_res -> 'rows') <> 30 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | B) filas devueltas: %s (esperado 30)',
    jsonb_array_length(v_res -> 'rows'));
  if v_res -> 'stats' = 'null'::jsonb then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | C) stats en pagina 1: %s',
    case when v_res -> 'stats' <> 'null'::jsonb then 'presentes' else 'AUSENTES (regresion)' end);

  -- D) Página profunda: sin métricas, pero con filas y total.
  v_res := public.admin_user_access_log_page(null, null, 30, 90);
  -- Las metricas solo se calculan en la primera pagina: recalcularlas en cada
  -- salto es lo que hacia lenta la consulta. Que vuelvan a aparecer aqui seria
  -- la regresion.
  if v_res -> 'stats' <> 'null'::jsonb then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | D) pagina profunda: %s filas, stats %s, total %s',
    jsonb_array_length(v_res -> 'rows'),
    case when v_res -> 'stats' = 'null'::jsonb then 'null (correcto)' else 'presentes' end,
    (v_res -> 'page' ->> 'total_count')::int);

  -- E) is_latest_for_user: debe ser el ultimo acceso global del usuario,
  --    no el ultimo dentro de la pagina.
  select (r ->> 'user_id')::uuid into v_user
  from jsonb_array_elements(v_res -> 'rows') r
  limit 1;

  v_res := public.admin_user_access_log_page(null, null, 100, 0);
  select count(*)::int into v_latest
  from jsonb_array_elements(v_res -> 'rows') r
  where (r ->> 'is_latest_for_user')::boolean
    and (r ->> 'signed_in_at')::timestamptz <> (
      select max(signed_in_at) from public.user_access_logs l
      where l.user_id = (r ->> 'user_id')::uuid
    );
  if v_latest <> 0 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | E) marcas is_latest incorrectas: %s (esperado 0)', v_latest);

  -- F) Busqueda: el total debe cuadrar con el filtro.
  v_res := public.admin_user_access_log_page('10.0.0.7', null, 30, 0);
  select count(*)::int into v_esperado
  from public.user_access_logs l
  where coalesce(l.ip_address::text, '') ilike '%10.0.0.7%';
  v_total := (v_res -> 'page' ->> 'total_count')::int;
  if v_total <> v_esperado then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | F) busqueda total %s vs real %s -> %s', v_total, v_esperado,
    case when v_total = v_esperado then 'OK' else 'DESCUADRA' end);

  -- G) Sin permiso debe rechazar.
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  begin
    perform public.admin_user_access_log_page(null, null, 30, 0);
    v_fail := v_fail + 1;
    v_out := v_out || ' | G) sin permiso -> PERMITIDO (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | G) sin permiso -> BLOQUEADO';
  end;

  perform set_config('request.jwt.claims', '', true);
  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
