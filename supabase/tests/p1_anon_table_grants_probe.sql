-- Prueba de la restricción de grants de tabla del rol `anon`.
-- Impersona a `anon` y termina en RAISE EXCEPTION: la transacción se revierte
-- siempre, así que no deja rastro en producción.
do $probe$
declare
  v_out text := '';
  v_n bigint;
  v_public text[] := array['church_unions', 'church_associations', 'church_districts',
                           'churches', 'donation_amount_options'];
  v_closed text[] := array['users', 'applications', 'audit_logs', 'membership_payments',
                           'candidate_profiles', 'notifications', 'donations'];
  t text;
  v_ok int := 0;
  v_fail int := 0;
  -- Los contadores por bloque se reinician; este no. Es el que decide el
  -- veredicto, así que ningún bloque puede tapar el fallo de otro.
  v_fail_total int := 0;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);

  -- A) La superficie pública deliberada debe seguir siendo legible.
  foreach t in array v_public loop
    begin
      execute format('select count(*) from public.%I', t) into v_n;
      v_ok := v_ok + 1;
    exception when others then
      v_fail := v_fail + 1;
      v_out := v_out || format(' [ROTA: %s -> %s]', t, sqlerrm);
    end;
  end loop;
  v_out := format('A) publicas legibles: %s/%s', v_ok, array_length(v_public, 1)) || v_out;
  v_fail_total := v_fail_total + v_fail;

  -- B) El resto debe estar cerrado por permisos, no solo por RLS.
  v_ok := 0; v_fail := 0;
  foreach t in array v_closed loop
    begin
      execute format('select count(*) from public.%I', t) into v_n;
      v_fail := v_fail + 1;
      v_out := v_out || format(' [ABIERTA: %s]', t);
    exception
      when insufficient_privilege then v_ok := v_ok + 1;
      when others then v_ok := v_ok + 1;
    end;
  end loop;
  v_out := v_out || format(' | B) cerradas: %s/%s', v_ok, array_length(v_closed, 1));
  v_fail_total := v_fail_total + v_fail;

  -- C) Escritura y TRUNCATE sobre una tabla sensible.
  begin
    execute 'insert into public.users (id, email) values (gen_random_uuid(), ''x@example.com'')';
    v_fail_total := v_fail_total + 1;
    v_out := v_out || ' | C) insert en users -> PERMITIDO (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | C) insert en users -> BLOQUEADO';
  end;

  begin
    execute 'truncate table public.audit_logs';
    v_fail_total := v_fail_total + 1;
    v_out := v_out || ' | D) truncate de audit_logs -> PERMITIDO (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | D) truncate de audit_logs -> BLOQUEADO';
  end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- E) Recuento global: solo deben quedar los 5 SELECT.
  select count(*) into v_n
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon';
  if v_n <> 5 then
    v_fail_total := v_fail_total + 1;
  end if;
  v_out := v_out || format(' | E) grants a anon restantes: %s (esperado 5)', v_n);

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail_total = 0 then 'PASS' else 'FAIL' end, v_fail_total, v_out;
end;
$probe$;
