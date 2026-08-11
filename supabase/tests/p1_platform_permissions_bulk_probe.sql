-- Probe de `my_platform_permissions` (migración 20260811013000).
--
-- El riesgo de sustituir 29 preguntas por una no es el rendimiento: es que la
-- respuesta cambie. Si el conjunto que devuelve la nueva función no coincide
-- **exactamente** con lo que habrían contestado las 29 llamadas a
-- `has_platform_permission`, la hidratación de sesión concede o niega accesos
-- que antes no concedía ni negaba, y no lo hace visible en ningún sitio.
--
-- Por eso aquí no se comprueba una lista escrita a mano: se comparan las dos
-- funciones entre sí, permiso por permiso, para cada usuario con rol de
-- plataforma. Una lista fija envejecería y pasaría a validar el pasado.
--
-- Todo el bloque termina en RAISE EXCEPTION: la transacción SIEMPRE se revierte.
do $probe$
declare
  v_out text := '';
  v_fail int := 0;
  v_err text;
  r record;
  v_bulk text[];
  v_uno boolean;
  v_discrepancias int := 0;
  v_usuarios int := 0;
  v_permisos int := 0;
begin
  select count(*) into v_permisos from public.permissions;
  if v_permisos = 0 then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | sin permisos en el catálogo: nada que comparar';
  end if;

  -- ── A) Las dos funciones dicen lo mismo, para cada usuario y permiso ───────
  -- Se impersona a cada titular de rol: ambas funciones dependen de auth.uid(),
  -- así que compararlas sin sesión mediría el caso vacío en los dos lados y
  -- pasaría siempre.
  for r in
    select distinct upr.user_id
    from public.user_platform_roles upr
    where upr.revoked_at is null
  loop
    v_usuarios := v_usuarios + 1;

    perform set_config('request.jwt.claims',
      json_build_object('sub', r.user_id::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    v_bulk := public.my_platform_permissions();

    -- ¿Sobra algo en el conjunto que la individual niegue?
    declare
      v_code text;
    begin
      foreach v_code in array coalesce(v_bulk, '{}') loop
        v_uno := public.has_platform_permission(v_code);
        if v_uno is not true then
          v_discrepancias := v_discrepancias + 1;
          v_out := v_out || format(' | A) %s: el conjunto trae %s pero la individual lo niega',
            r.user_id, v_code);
        end if;
      end loop;
    end;

    -- ¿Falta algo que la individual conceda? Se recorre el catálogo entero, no
    -- los 29 códigos del cliente: si mañana alguien añade un permiso, esta
    -- probe lo cubre sin tocarla.
    declare
      v_code text;
    begin
      for v_code in select code from public.permissions loop
        if public.has_platform_permission(v_code)
           and not (v_code = any(coalesce(v_bulk, '{}'))) then
          v_discrepancias := v_discrepancias + 1;
          v_out := v_out || format(' | A) %s: la individual concede %s y el conjunto no lo trae',
            r.user_id, v_code);
        end if;
      end loop;
    end;

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', null, true);
  end loop;

  if v_usuarios = 0 then
    -- Sin titulares de rol la comparación no mide nada, y «0 discrepancias de 0»
    -- se lee igual que «todo bien». Es el mismo piso anti-silencio de §14.1.
    v_fail := v_fail + 1;
    v_out := v_out || ' | A) sin usuarios con rol de plataforma: la comparación no midió nada';
  elsif v_discrepancias = 0 then
    v_out := v_out || format(' | A) %s usuario(s) × %s permisos: los dos caminos coinciden OK',
      v_usuarios, v_permisos);
  else
    v_fail := v_fail + 1;
  end if;

  -- ── B) Sin sesión no se filtra nada ───────────────────────────────────────
  begin
    perform set_config('request.jwt.claims', null, true);
    perform set_config('role', 'anon', true);
    begin
      v_bulk := public.my_platform_permissions();
      -- Que `anon` pueda ejecutarla ya sería un fallo de ACL; que además
      -- devolviera permisos sería una fuga.
      if coalesce(array_length(v_bulk, 1), 0) > 0 then
        v_fail := v_fail + 1;
        v_out := v_out || format(' | B) anon recibió %s permisos', array_length(v_bulk, 1));
      else
        v_out := v_out || ' | B) anon ejecuta pero recibe conjunto vacío (revisar ACL)';
      end if;
    exception when insufficient_privilege then
      v_out := v_out || ' | B) anon no puede ejecutarla OK';
    end;
    perform set_config('role', 'postgres', true);
  exception when others then
    get stacked diagnostics v_err = message_text;
    perform set_config('role', 'postgres', true);
    v_fail := v_fail + 1;
    v_out := v_out || format(' | B) ROTO: %s', v_err);
  end;

  -- ── C) `has_platform_permission` sigue disponible para las políticas RLS ──
  if not has_function_privilege('anon', 'public.has_platform_permission(text)', 'execute') then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C) has_platform_permission perdió EXECUTE para anon (rompe políticas RLS)';
  else
    v_out := v_out || ' | C) has_platform_permission intacta para RLS OK';
  end if;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
