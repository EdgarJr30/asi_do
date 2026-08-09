-- Prueba de regresión del P0 TASK-257.
-- Impersona a un usuario no administrador y termina en RAISE EXCEPTION,
-- de modo que la transacción se revierte siempre.
do $probe$
declare
  -- Sujeto fijo del fixture: activo, aprobado y **sin rol de plataforma**, que
  -- es lo que hace que el guard aplique.
  --
  -- Antes se elegía con `limit 1`, y ahí estaba el falso verde: sobre una base
  -- sin usuarios `v_uid` quedaba null, el `update … where id = null` no afectaba
  -- a ninguna fila, no lanzaba `insufficient_privilege` y la probe reportaba
  -- BLOQUEADA — exactamente el veredicto que se quiere ver. Pasaba por no tener
  -- a quién atacar.
  v_uid uuid := 'f1000000-0000-4000-a000-000000000004';
  v_name text;
  v_out text := '';
  v_fail int := 0;
begin
  select u.full_name into v_name from public.users u where u.id = v_uid;

  if v_name is null then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | falta el fixture %: carga supabase/tests/fixtures.sql', v_uid;
  end if;

  if exists (select 1 from public.user_platform_roles r where r.user_id = v_uid and r.revoked_at is null) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | el sujeto % tiene rol de plataforma; el guard no aplica', v_uid;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- Caso A: autoactivación completa — el vector del hallazgo.
  begin
    update public.users
    set user_approval_status = 'approved',
        asi_membership_status = 'active',
        user_subscription_status = 'active',
        membership_expires_at = timezone('utc', now()) + interval '10 years'
    where id = v_uid;
    v_fail := v_fail + 1;
    v_out := v_out || 'A) autoactivacion -> PERMITIDA (fallo de seguridad)';
  exception
    when insufficient_privilege then v_out := v_out || 'A) autoactivacion -> BLOQUEADA';
    when others then v_out := v_out || format('A) autoactivacion -> BLOQUEADA (%s)', sqlerrm);
  end;

  -- Caso B: override de acceso manual.
  begin
    update public.users
    set manual_access_override_until = timezone('utc', now()) + interval '1 year'
    where id = v_uid;
    v_fail := v_fail + 1;
    v_out := v_out || ' | B) manual_access_override -> PERMITIDA (fallo de seguridad)';
  exception
    when insufficient_privilege then v_out := v_out || ' | B) manual_access_override -> BLOQUEADA';
    when others then v_out := v_out || format(' | B) manual_access_override -> BLOQUEADA (%s)', sqlerrm);
  end;

  -- Caso C: edición legítima de perfil — debe seguir funcionando.
  begin
    update public.users
    set full_name = coalesce(v_name, 'Probe') || ' (probe)',
        display_name = 'Probe',
        locale = 'es',
        country_code = 'DO'
    where id = v_uid;
    v_out := v_out || ' | C) perfil legitimo -> PERMITIDA';
  exception
    when others then
      v_fail := v_fail + 1;
      v_out := v_out || format(' | C) perfil legitimo -> BLOQUEADA (regresion): %s', sqlerrm);
  end;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
