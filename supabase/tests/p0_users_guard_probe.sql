-- Prueba de regresión del P0 TASK-257.
-- Impersona a un usuario no administrador y termina en RAISE EXCEPTION,
-- de modo que la transacción se revierte siempre.
do $probe$
declare
  v_uid uuid;
  v_name text;
  v_out text := '';
begin
  -- Usuario no administrador de plataforma, para que el guard aplique.
  select u.id, u.full_name into v_uid, v_name
  from public.users u
  where u.status = 'active'
    and not exists (
      select 1 from public.user_platform_roles r where r.user_id = u.id
    )
  limit 1;

  if v_uid is null then
    select u.id, u.full_name into v_uid, v_name from public.users u limit 1;
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
    v_out := v_out || 'A) autoactivacion -> PERMITIDA (fallo de seguridad)';
  exception
    when insufficient_privilege then v_out := v_out || 'A) autoactivacion -> BLOQUEADA';
    when others then v_out := v_out || format('A) autoactivacion -> otro error: %s', sqlerrm);
  end;

  -- Caso B: override de acceso manual.
  begin
    update public.users
    set manual_access_override_until = timezone('utc', now()) + interval '1 year'
    where id = v_uid;
    v_out := v_out || ' | B) manual_access_override -> PERMITIDA (fallo de seguridad)';
  exception
    when insufficient_privilege then v_out := v_out || ' | B) manual_access_override -> BLOQUEADA';
    when others then v_out := v_out || format(' | B) manual_access_override -> otro error: %s', sqlerrm);
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
    when others then v_out := v_out || format(' | C) perfil legitimo -> BLOQUEADA (regresion): %s', sqlerrm);
  end;

  raise exception 'PROBE_RESULT: %', v_out;
end;
$probe$;
