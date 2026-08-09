-- Prueba de la optimización RLS de TASK-269.
-- Termina en RAISE EXCEPTION: la transacción se revierte siempre.
--
-- La aserción crítica es la D. Envolver en un subselect una función que recibe
-- una columna de la fila —`has_tenant_permission(tenant_id, ...)`,
-- `is_tenant_member(tenant_id)`, `can_read_application(id)`— la congelaría en el
-- valor de la primera fila y **ampliaría el acceso**: un usuario vería filas de
-- tenants ajenos. Esta prueba existe para que ese error no pueda colarse después.
do $probe$
declare
  v_out text := '';
  v_uid uuid;
  v_plan text := '';
  v_line text;
  v_n int;
  v_visibles bigint;
  v_total bigint;
  v_fail int := 0;
begin
  -- Sujeto fijo del fixture: sin rol de plataforma, que es la condición que hace
  -- significativo el bloque E. Elegirlo con `limit 1` podía caer en el admin —o
  -- en ninguno— y entonces "ve menos filas que el total" dejaba de medir nada.
  v_uid := 'f1000000-0000-4000-a000-000000000004';

  if not exists (select 1 from public.users where id = v_uid) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | falta el fixture %: carga supabase/tests/fixtures.sql', v_uid;
  end if;

  -- A) Ninguna política de sesión queda sin envolver.
  select count(*) into v_n
  from pg_policies
  where schemaname = 'public'
    and (coalesce(qual,'') || ' ' || coalesce(with_check,''))
        ~ '(auth\.(uid|role|jwt)\(\)|is_platform_admin\(\)|is_platform_owner\(\)|has_platform_permission\()'
    and (coalesce(qual,'') || ' ' || coalesce(with_check,''))
        !~ 'SELECT (auth\.|is_platform_|has_platform_permission)';
  if v_n <> 0 then v_fail := v_fail + 1; end if;
  v_out := format('A) politicas de sesion sin envolver: %s (esperado 0)', v_n);

  -- B) El total de políticas no cambió: no se consolidó ni se perdió ninguna.
  -- B) Inventario, no aserto: el total crece con cada migración que añade una
  --    política. Fijarlo obligaría a tocar este archivo por cambios inocuos, y
  --    una probe que se edita por rutina deja de leerse.
  select count(*) into v_n from pg_policies where schemaname = 'public';
  v_out := v_out || format(' | B) politicas totales: %s (informativo)', v_n);

  -- C) El plan usa InitPlan, es decir la función se evalúa una vez y no por fila.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  for v_line in execute 'explain (analyze, timing off, costs off) select id from public.users' loop
    v_plan := v_plan || v_line || E'\n';
  end loop;

  if v_plan !~ 'InitPlan' then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | C) plan con InitPlan: %s',
    case when v_plan ~ 'InitPlan' then 'SI' else 'NO (la optimizacion no esta activa)' end);

  -- D) Las funciones que dependen de la fila NO pueden estar envueltas.
  perform set_config('role', 'postgres', true);
  select count(*) into v_n
  from pg_policies
  where schemaname = 'public'
    and (coalesce(qual,'') || ' ' || coalesce(with_check,''))
        ~ 'SELECT (has_tenant_permission|is_tenant_member|can_read_application)\(';
  if v_n <> 0 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | D) helpers por fila envueltos: %s (esperado 0; >0 AMPLIA EL ACCESO)', v_n);

  -- E) El acceso no se amplió: un usuario sin rol de plataforma no ve a todos.
  perform set_config('role', 'authenticated', true);
  select count(*) into v_visibles from public.users;
  perform set_config('role', 'postgres', true);
  select count(*) into v_total from public.users;
  -- E) El aserto es `<`, no `<=`: con los fixtures cargados hay siete usuarios y
  --    uno sin rol no puede verlos todos. Si empatara, la política estaría
  --    dejando pasar el directorio entero.
  if v_visibles >= v_total then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | E) usuario no admin ve %s de %s filas de users (debe ser menor)',
    v_visibles, v_total);

  perform set_config('request.jwt.claims', '', true);
  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
