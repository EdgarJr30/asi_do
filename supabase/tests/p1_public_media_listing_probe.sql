-- Prueba del cierre del listado de `public-media`.
--
-- El bucket está vacío en el remoto, así que medir sin sembrar daría 0 filas
-- tanto si la policy existe como si no. La probe inserta objetos sintéticos y
-- termina en RAISE EXCEPTION: la transacción se revierte siempre, así que no
-- deja filas ni en `storage.objects` ni en `storage.prefixes`.
--
-- Ejecutar con: supabase db query --linked --file supabase/tests/p1_public_media_listing_probe.sql
do $probe$
declare
  v_out text := '';
  v_n bigint;
  v_ok int := 0;
  v_total int := 0;
begin
  -- Semilla: dos rutas del contrato real y una que nadie ha enlazado nunca,
  -- que es justo la que el listado abierto revelaba.
  insert into storage.objects (bucket_id, name, metadata)
  values ('public-media', 'videos/sintetico-a.webm', '{"size":1}'::jsonb),
         ('public-media', 'videos/sintetico-b.webm', '{"size":1}'::jsonb),
         ('public-media', 'internos/borrador-no-enlazado.webp', '{"size":1}'::jsonb);

  -- A) `anon` no debe poder enumerar el bucket.
  v_total := v_total + 1;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  select count(*) into v_n from storage.objects where bucket_id = 'public-media';
  perform set_config('role', 'postgres', true);
  if v_n = 0 then
    v_ok := v_ok + 1;
    v_out := v_out || 'A) anon lista 0/3 -> BLOQUEADO';
  else
    v_out := v_out || format('A) anon lista %s/3 -> ABIERTO (fallo de seguridad)', v_n);
  end if;

  -- B) `authenticated` tampoco: tener sesión no da derecho al inventario.
  v_total := v_total + 1;
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', gen_random_uuid())::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_n from storage.objects where bucket_id = 'public-media';
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  if v_n = 0 then
    v_ok := v_ok + 1;
    v_out := v_out || ' | B) authenticated lista 0/3 -> BLOQUEADO';
  else
    v_out := v_out || format(' | B) authenticated lista %s/3 -> ABIERTO (fallo de seguridad)', v_n);
  end if;

  -- C) El bucket debe seguir siendo público: es lo que mantiene viva la lectura
  --    por `/object/public/`, que no evalúa RLS. Si esto se apagara, cerrar el
  --    listado sí rompería el sitio.
  v_total := v_total + 1;
  if exists (select 1 from storage.buckets where id = 'public-media' and public) then
    v_ok := v_ok + 1;
    v_out := v_out || ' | C) bucket public = true -> lectura por URL intacta';
  else
    v_out := v_out || ' | C) bucket dejo de ser publico -> la lectura por URL se rompe';
  end if;

  -- D) Ninguna policy de SELECT puede volver a alcanzar al bucket.
  v_total := v_total + 1;
  select count(*) into v_n
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd = 'SELECT'
    and coalesce(qual, '') like '%public-media%';
  if v_n = 0 then
    v_ok := v_ok + 1;
    v_out := v_out || ' | D) policies de SELECT sobre public-media: 0';
  else
    v_out := v_out || format(' | D) policies de SELECT sobre public-media: %s (esperado 0)', v_n);
  end if;

  -- E) Guarda de regresión sobre los otros dos buckets públicos: nunca han
  --    tenido policy de SELECT y tampoco deben ganarla.
  v_total := v_total + 1;
  select count(*) into v_n
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd = 'SELECT'
    and roles::text like '%anon%';
  if v_n = 0 then
    v_ok := v_ok + 1;
    v_out := v_out || ' | E) policies de SELECT con anon en storage.objects: 0';
  else
    v_out := v_out || format(' | E) policies de SELECT con anon en storage.objects: %s (esperado 0)', v_n);
  end if;

  raise exception 'PROBE_RESULT: %/% asertos en verde | %', v_ok, v_total, v_out;
end;
$probe$;
