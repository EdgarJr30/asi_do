-- Verificación de la Fase B: las superficies públicas deben seguir funcionando
-- como rol `anon`, y las RPC de sesión deben quedar denegadas.
-- Termina en RAISE EXCEPTION para revertir cualquier efecto.
--
-- CORREGIDA el 2026-08-09, al ejecutarla por primera vez desde que se escribió.
-- Los casos 1 y 4 afirmaban que `anon` debía poder leer `job_postings` y `users`
-- directamente. Eso era cierto el 2026-08-01 y dejó de serlo un día después: la
-- Fase C (20260802190000) recortó los grants de `anon` a las cinco tablas de
-- catálogo, y `p1_anon_table_grants_probe` afirma esa clausura desde entonces.
-- Las dos probes se contradecían y ninguna corría, así que nadie lo vio.
--
-- La versión buena es la de la Fase C: el job board vive bajo `/account/jobs`,
-- tras sesión —`/platform/jobs` solo redirige—, así que el visitante anónimo no
-- necesita leer esas tablas. Los casos 1 y 4 pasan a comprobar lo contrario de
-- lo que comprobaban: que están cerradas.
do $probe$
declare
  v_out text := '';
  v_n integer;
  v_fail int := 0;
begin
  -- "Está cerrado" solo significa algo si hay algo que ocultar. Sin filas, un
  -- cero de `anon` sale igual con la tabla cerrada que con la tabla vacía. El
  -- fixture publica un empleo por tenant y crea siete usuarios justo para que la
  -- clausura sea comprobable.
  if not exists (select 1 from public.job_postings where status = 'published')
     or not exists (select 1 from public.users) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | faltan datos que ocultar: carga supabase/tests/fixtures.sql';
  end if;

  perform set_config('role', 'anon', true);

  -- 1. Los empleos no son superficie anónima: se leen con sesión, bajo
  --    `/account/jobs`. Si `anon` volviera a leerlos, el inventario de vacantes
  --    de todos los tenants quedaría abierto a cualquiera.
  begin
    select count(*) into v_n from public.job_postings;
    v_fail := v_fail + 1;
    v_out := v_out || format('1) job_postings anon -> ABIERTA con %s filas (fallo de seguridad)', v_n);
  exception when insufficient_privilege then
    v_out := v_out || '1) job_postings anon -> CERRADA';
  when others then
    v_fail := v_fail + 1;
    v_out := v_out || format('1) job_postings anon -> error inesperado: %s', sqlerrm);
  end;

  -- 2. Opciones de donación: RPC que debe seguir siendo pública.
  begin
    perform public.list_active_donation_amount_options();
    v_out := v_out || ' | 2) donation options anon -> OK';
  exception when others then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | 2) donation options anon -> ROTO: %s', sqlerrm);
  end;

  -- 3. Recibo de donación: también público.
  begin
    perform public.get_donation_receipt('NO-EXISTE');
    v_out := v_out || ' | 3) donation receipt anon -> OK';
  exception when insufficient_privilege then
    v_fail := v_fail + 1;
    v_out := v_out || ' | 3) donation receipt anon -> ROTO: sin privilegio';
  when others then
    v_out := v_out || ' | 3) donation receipt anon -> OK (error de datos, no de permiso)';
  end;

  -- 4. El directorio de personas tampoco. Es el peor de los dos: nombres,
  --    correos y estado de membresía de todo el que se haya registrado.
  begin
    select count(*) into v_n from public.users;
    v_fail := v_fail + 1;
    v_out := v_out || format(' | 4) users anon -> ABIERTA con %s filas (fallo de seguridad)', v_n);
  exception when insufficient_privilege then
    v_out := v_out || ' | 4) users anon -> CERRADA';
  when others then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | 4) users anon -> error inesperado: %s', sqlerrm);
  end;

  -- 5. RPC de sesión: ahora debe estar denegada para anon.
  begin
    perform public.submit_application(null::uuid, null::uuid, null::text, '{}'::jsonb);
    v_fail := v_fail + 1;
    v_out := v_out || ' | 5) submit_application anon -> PERMITIDA (fallo)';
  exception when insufficient_privilege then
    v_out := v_out || ' | 5) submit_application anon -> DENEGADA';
  when others then
    v_out := v_out || format(' | 5) submit_application anon -> alcanzo la funcion (%s)', sqlstate);
  end;

  -- 6. Otra RPC administrativa, tambien denegada.
  begin
    perform public.platform_ops_snapshot();
    v_fail := v_fail + 1;
    v_out := v_out || ' | 6) platform_ops_snapshot anon -> PERMITIDA (fallo)';
  exception when insufficient_privilege then
    v_out := v_out || ' | 6) platform_ops_snapshot anon -> DENEGADA';
  when others then
    v_out := v_out || format(' | 6) platform_ops_snapshot anon -> alcanzo la funcion (%s)', sqlstate);
  end;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
