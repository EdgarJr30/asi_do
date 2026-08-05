-- Prueba de la Fase C extendida al esquema `storage`.
-- Impersona a `anon` y a `authenticated`, y termina en RAISE EXCEPTION: la
-- transacción se revierte siempre, así que no deja rastro en producción.
--
-- Lo que vigila: que `TRUNCATE` —el único privilegio de esta lista que no pasa
-- por RLS— no vuelva a concederse sobre las tablas de storage. Un `TRUNCATE` de
-- `storage.objects` vacía el inventario entero sin evaluar una sola política.
do $probe$
declare
  v_out text := '';
  v_n bigint;
  v_ok int := 0;
  v_fail int := 0;
  t text;
  r text;
  v_tables text[] := array['objects', 'buckets', 'buckets_analytics'];
  v_roles text[] := array['anon', 'authenticated'];
begin
  -- A) El grant de TRUNCATE ya no debe existir para ninguno de los dos roles.
  foreach t in array v_tables loop
    foreach r in array v_roles loop
      select count(*) into v_n
      from information_schema.role_table_grants
      where table_schema = 'storage'
        and table_name = t
        and grantee = r
        and privilege_type = 'TRUNCATE';

      if v_n = 0 then
        v_ok := v_ok + 1;
      else
        v_fail := v_fail + 1;
        v_out := v_out || format(' [TRUNCATE VIVO: storage.%s -> %s]', t, r);
      end if;
    end loop;
  end loop;
  v_out := format('A) TRUNCATE retirado: %s/%s', v_ok, v_ok + v_fail) || v_out;

  -- B) Comprobación por comportamiento, no solo por catálogo: intentarlo de
  --    verdad como `anon` debe fallar.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);

  begin
    execute 'truncate table storage.objects';
    v_out := v_out || ' | B) truncate de storage.objects como anon -> PERMITIDO (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | B) truncate de storage.objects como anon -> BLOQUEADO';
  end;

  perform set_config('role', 'postgres', true);

  -- C) Lo mismo como `authenticated`: es el rol que sí tiene políticas, pero
  --    ninguna de ellas cubre un TRUNCATE.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  begin
    execute 'truncate table storage.objects';
    v_out := v_out || ' | C) truncate de storage.objects como authenticated -> PERMITIDO (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | C) truncate de storage.objects como authenticated -> BLOQUEADO';
  end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- D) Las políticas del esquema siguen apuntando solo a `authenticated`. Si
  --    aparece una dirigida a `anon`, los grants de `anon` dejan de ser peso
  --    muerto y la decisión de esta migración habría que revisarla.
  select count(*) into v_n
  from pg_policies
  where schemaname = 'storage' and 'anon' = any (roles);
  v_out := v_out || format(' | D) politicas de storage dirigidas a anon: %s (esperado 0)', v_n);

  select count(*) into v_n from pg_policies where schemaname = 'storage';
  v_out := v_out || format(' | E) politicas de storage en total: %s (esperado 17)', v_n);

  raise exception 'PROBE_RESULT: %', v_out;
end;
$probe$;
