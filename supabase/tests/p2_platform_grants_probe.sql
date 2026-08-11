-- Probe de 20260807042236_p2_declara_grants_de_plataforma.
--
-- Qué vigila: que el estado de privilegios de `public` siga siendo el que la
-- migración declara. Es una probe de inventario, no de comportamiento: si algún
-- día alguien concede o revoca por fuera de una migración, el conteo cambia
-- aquí antes de que el job de drift lo vea a la mañana siguiente.
--
-- Los números esperados son los medidos el 2026-08-07. Al añadir tablas o
-- funciones hay que actualizarlos: es deliberado que crecer la superficie
-- obligue a tocar este archivo.
--
-- Termina en RAISE EXCEPTION: la transacción se revierte siempre.
do $probe$
declare
  v_out text := '';
  v_ok int := 0;
  v_fail int := 0;
  v_n bigint;
begin
  -- ── A) Los default privileges de `public` ───────────────────────────────────
  -- La fuente. Sin estas entradas, cada objeto nuevo vuelve a abrir el drift.
  -- Se leen sobre `postgres`, que es quien ejecuta las migraciones.
  select count(*) into v_n
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and pg_get_userbyid(d.defaclrole) = 'postgres'
    and d.defaclobjtype = 'r'
    and d.defaclacl::text like '%service_role=arwdDxtm/postgres%';
  if v_n = 1 then v_ok := v_ok + 1; else
    v_fail := v_fail + 1;
    v_out := v_out || E'\n  A1: faltan los default privileges de tablas para service_role';
  end if;

  select count(*) into v_n
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and pg_get_userbyid(d.defaclrole) = 'postgres'
    and d.defaclobjtype = 'f'
    and d.defaclacl::text like '%service_role=X/postgres%';
  if v_n = 1 then v_ok := v_ok + 1; else
    v_fail := v_fail + 1;
    v_out := v_out || E'\n  A2: faltan los default privileges de funciones para service_role';
  end if;

  -- `anon` no debe estar en los defaults de tablas ni de funciones: se lo
  -- retiraron 20260802190000 y 20260801120000. Volver a meterlo abriría cada
  -- tabla y cada función nueva al visitante anónimo.
  --
  -- Solo se mira el rol `postgres`. `supabase_admin` tiene sus propios defaults
  -- en `public` —esos sí incluyen `anon`— pero rigen para objetos que crea la
  -- plataforma, no las migraciones, y no se pueden cambiar desde aquí.
  select count(*) into v_n
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and pg_get_userbyid(d.defaclrole) = 'postgres'
    and d.defaclobjtype in ('r', 'f')
    and d.defaclacl::text like '%anon=%';
  if v_n = 0 then v_ok := v_ok + 1; else
    v_fail := v_fail + 1;
    v_out := v_out || format(E'\n  A3: `anon` volvió a los default privileges (%s entradas)', v_n);
  end if;

  -- ── B) Tablas ───────────────────────────────────────────────────────────────
  -- `service_role` con los 7 privilegios en las 58.
  --
  -- `authenticated` ya no se comprueba aquí: la Fase D (20260807145727) le quitó
  -- el ALL heredado y su matriz —tabla por tabla, con lectura real
  -- impersonando el rol— vive en `p2_fase_d_authenticated_grants_probe.sql`.
  select count(*) into v_n
  from pg_tables t
  where t.schemaname = 'public'
    and 7 <> (
      select count(distinct g.privilege_type)
      from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = t.tablename and g.grantee = 'service_role'
    );
  if v_n = 0 then v_ok := v_ok + 1; else
    v_fail := v_fail + 1;
    v_out := v_out || format(E'\n  B1: %s tablas sin ALL para service_role', v_n);
  end if;

  -- `anon` sigue limitado a las 5 tablas de solo lectura de 20260802190000.
  select count(distinct g.table_name) into v_n
  from information_schema.role_table_grants g
  where g.table_schema = 'public' and g.grantee = 'anon' and g.privilege_type = 'SELECT';
  if v_n = 5 then v_ok := v_ok + 1; else
    v_fail := v_fail + 1;
    v_out := v_out || format(E'\n  B2: `anon` lee %s tablas de public, se esperaban 5', v_n);
  end if;

  -- ── C) Funciones ────────────────────────────────────────────────────────────
  -- Los grupos que declara el bloque 3 de la migración. El número importa: si
  -- crece el de PUBLIC o el de `anon`, alguien amplió la superficie sin decirlo.
  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE');
  if v_n = 22 then v_ok := v_ok + 1; else
    v_fail := v_fail + 1;
    v_out := v_out || format(E'\n  C1: %s funciones con EXECUTE para PUBLIC, se esperaban 22', v_n);
  end if;

  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  -- 25 desde 2026-08-10. Las dos que subieron están justificadas:
  --
  --   · `email_unsubscribe`: la baja de una campaña llega desde el cliente de
  --     correo, sin sesión posible. Su superficie es un token uuid aleatorio por
  --     destinatario; no acepta direcciones, no dice a quién pertenece el token
  --     y responde igual ante uno inventado que ante uno caducado, para no ser
  --     un oráculo.
  --   · `submit_contact_message`: el formulario público de contacto se envía sin
  --     cuenta. No es una superficie abierta: acota a 3 mensajes por hora y
  --     correo, 60 por hora en total, y limita el largo de cada campo.
  --
  -- Cualquier otra subida de este número hay que justificarla igual o revertirla.
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
  if v_n = 25 then v_ok := v_ok + 1; else
    v_fail := v_fail + 1;
    v_out := v_out || format(E'\n  C2: %s funciones ejecutables por `anon`, se esperaban 25', v_n);
  end if;

  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and not has_function_privilege('service_role', p.oid, 'execute');
  if v_n = 0 then v_ok := v_ok + 1; else
    v_fail := v_fail + 1;
    v_out := v_out || format(E'\n  C3: %s funciones sin EXECUTE para service_role', v_n);
  end if;

  -- Ninguna función debe quedar con la ACL nula: significaría que se creó sin
  -- pasar por los default privileges y que PUBLIC la ejecuta por omisión.
  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proacl is null;
  if v_n = 0 then v_ok := v_ok + 1; else
    v_fail := v_fail + 1;
    v_out := v_out || format(E'\n  C4: %s funciones con ACL nula (PUBLIC ejecuta por omisión)', v_n);
  end if;

  raise exception E'PROBE_VERDICT status=% fails=% | OK: % %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail,
    v_ok, coalesce(nullif(v_out, ''), E'\n  (sin desviaciones)');
end;
$probe$;
