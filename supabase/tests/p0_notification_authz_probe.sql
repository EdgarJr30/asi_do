-- Prueba de abuso del P0 TASK-259.
-- Cubre las tres RPC: system_create_notification, notify_membership_admins y
-- set_harness_email_suppression.
--
-- Todo el bloque termina en RAISE EXCEPTION: la transacción SIEMPRE se revierte,
-- así que no queda ninguna notificación, entrega, grant ni función de prueba en
-- producción. Los GRANT temporales del bloque 2 son deliberados: sirven para
-- comprobar que la guarda interna aguanta aunque un GRANT futuro reabra la ACL.
do $probe$
declare
  v_uid uuid;
  v_admin_id uuid;
  v_out text := '';
  v_err text;
  v_id uuid;
  v_before bigint;
  v_after bigint;
  v_fail int := 0;
begin
  -- Sujeto fijo del fixture: activo y sin rol de plataforma. Con `limit 1` la
  -- probe podia acabar usando al propio admin —o ninguno— y entonces los
  -- bloques de ACL median el caso equivocado.
  v_uid := 'f1000000-0000-4000-a000-000000000004';

  if not exists (select 1 from public.users where id = v_uid) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | falta el fixture %: carga supabase/tests/fixtures.sql', v_uid;
  end if;

  -- El fanout del bloque P necesita al menos un admin al que notificar. Sin
  -- destinatarios, "se enviaron 0" saldria igual con el fanout roto.
  if not exists (
    select 1 from public.user_platform_roles r
    join public.platform_roles pr on pr.id = r.role_id
    where r.revoked_at is null and pr.code in ('platform_admin', 'platform_owner', 'super_administrator')
  ) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | sin admins de plataforma: carga supabase/tests/fixtures.sql';
  end if;

  -- Emula el único uso legítimo: una función SECURITY DEFINER (trigger o RPC de
  -- negocio) que delega en system_create_notification.
  execute $f$
    create or replace function public._probe_nested_notify(p_uid uuid)
    returns uuid language plpgsql security definer set search_path = public as $inner$
    begin
      return public.system_create_notification(
        p_uid, 'probe.nested', 'Probe anidada', 'Cuerpo legitimo de prueba',
        '/account/membership', '{}'::jsonb, null);
    end; $inner$;
  $f$;
  execute 'grant execute on function public._probe_nested_notify(uuid) to authenticated';

  -- ═══ Bloque 1 — ACL: el cliente no puede ni invocarlas ═══════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'anon')::text, true);
  perform set_config('role', 'anon', true);

  begin
    perform public.system_create_notification(
      v_uid, 'abuse.forged', 'Notificacion falsificada', 'Cuerpo arbitrario', null, '{}'::jsonb, null);
    v_fail := v_fail + 1;
    v_out := v_out || 'A) anon -> system_create_notification PERMITIDA (fallo de seguridad)';
  exception when others then
    v_out := v_out || 'A) anon -> BLOQUEADA por ACL';
  end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  begin
    perform public.notify_membership_admins(
      'abuse.fanout', 'Fanout falsificado', 'Cuerpo arbitrario', '/admin/membership', '{}'::jsonb);
    v_fail := v_fail + 1;
    v_out := v_out || ' | B) authenticated -> notify_membership_admins PERMITIDA (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | B) authenticated -> BLOQUEADA por ACL';
  end;

  begin
    perform public.set_harness_email_suppression(true);
    v_fail := v_fail + 1;
    v_out := v_out || ' | C) authenticated -> suppression toggle PERMITIDO (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | C) authenticated -> BLOQUEADO por ACL';
  end;

  perform set_config('role', 'postgres', true);

  -- ═══ Bloque 2 — Guarda interna: aunque un GRANT reabra la ACL ════════════
  execute 'grant execute on function public.system_create_notification(uuid, text, text, text, text, jsonb, uuid) to authenticated';
  execute 'grant execute on function public.notify_membership_admins(text, text, text, text, jsonb) to authenticated';
  execute 'grant execute on function public.set_harness_email_suppression(boolean) to authenticated';

  perform set_config('role', 'authenticated', true);

  begin
    perform public.system_create_notification(
      v_uid, 'abuse.forged', 'Notificacion falsificada', 'Cuerpo arbitrario', null, '{}'::jsonb, null);
    v_fail := v_fail + 1;
    v_out := v_out || ' | D) con GRANT, llamada directa -> PERMITIDA (fallo de seguridad)';
  exception when others then
    get stacked diagnostics v_err = message_text;
    v_out := v_out || format(' | D) con GRANT, llamada directa -> BLOQUEADA (%s)',
      case when v_err like '%permission denied%' then 'ACL' else 'guarda interna' end);
  end;

  begin
    perform public.notify_membership_admins(
      'abuse.fanout', 'Fanout falsificado', 'Cuerpo arbitrario', '/admin/membership', '{}'::jsonb);
    v_fail := v_fail + 1;
    v_out := v_out || ' | E) con GRANT, fanout directo -> PERMITIDO (fallo de seguridad)';
  exception when others then
    get stacked diagnostics v_err = message_text;
    v_out := v_out || format(' | E) con GRANT, fanout directo -> BLOQUEADO (%s)',
      case when v_err like '%permission denied%' then 'ACL' else 'guarda interna' end);
  end;

  begin
    perform public.set_harness_email_suppression(true);
    v_fail := v_fail + 1;
    v_out := v_out || ' | F) con GRANT, suppression toggle -> PERMITIDO (fallo de seguridad)';
  exception when others then
    get stacked diagnostics v_err = message_text;
    v_out := v_out || format(' | F) con GRANT, suppression toggle -> BLOQUEADO (%s)',
      case when v_err like '%permission denied%' then 'ACL' else 'guarda interna' end);
  end;

  -- El camino legítimo: mismo usuario authenticated, pero vía una función
  -- intermedia, como ocurre en los triggers de membresía. Debe seguir pasando.
  begin
    v_id := public._probe_nested_notify(v_uid);
    if v_id is null then v_fail := v_fail + 1; end if;
    v_out := v_out || case
      when v_id is not null then ' | G) llamada anidada legitima -> PERMITIDA'
      else ' | G) llamada anidada legitima -> sin id (regresion)'
    end;
  exception when others then
    get stacked diagnostics v_err = message_text;
    v_fail := v_fail + 1;
    v_out := v_out || format(' | G) llamada anidada legitima -> ROTA: %s', v_err);
  end;

  perform set_config('role', 'postgres', true);
  -- Sin esto auth.role() seguiría devolviendo 'authenticated' y la guarda
  -- bloquearía también los casos legítimos de los bloques 3 y 4.
  perform set_config('request.jwt.claims', '', true);

  -- ═══ Bloque 3 — Validación de contenido y destinatarios ══════════════════
  -- Como postgres la autorización pasa; lo que se ejercita aquí es el saneo.

  begin
    perform public.system_create_notification(
      null, 'probe.test', 'Titulo', 'Cuerpo', null, '{}'::jsonb, null);
    v_fail := v_fail + 1;
    v_out := v_out || ' | H) destinatario NULL -> ACEPTADO (fallo)';
  exception when others then
    v_out := v_out || ' | H) destinatario NULL -> RECHAZADO';
  end;

  begin
    perform public.system_create_notification(
      '00000000-0000-0000-0000-0000000000ff'::uuid, 'probe.test', 'Titulo', 'Cuerpo', null, '{}'::jsonb, null);
    v_fail := v_fail + 1;
    v_out := v_out || ' | I) destinatario inexistente -> ACEPTADO (fallo)';
  exception when others then
    v_out := v_out || ' | I) destinatario inexistente -> RECHAZADO';
  end;

  -- El vector real: payload.to redirige el correo a una direccion arbitraria.
  begin
    perform public.system_create_notification(
      v_uid, 'probe.test', 'Titulo', 'Cuerpo', null,
      jsonb_build_object('to', 'atacante@example.com'), null);
    v_fail := v_fail + 1;
    v_out := v_out || ' | J) payload.to (relay de correo) -> ACEPTADO (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | J) payload.to (relay de correo) -> RECHAZADO';
  end;

  begin
    perform public.system_create_notification(
      v_uid, 'probe.test', 'Titulo', 'Cuerpo', '//evil.example.com/phish', '{}'::jsonb, null);
    v_fail := v_fail + 1;
    v_out := v_out || ' | K) action_url externa -> ACEPTADA (fallo de seguridad)';
  exception when others then
    v_out := v_out || ' | K) action_url externa -> RECHAZADA';
  end;

  begin
    perform public.system_create_notification(
      v_uid, 'probe.test', '   ', 'Cuerpo', null, '{}'::jsonb, null);
    v_fail := v_fail + 1;
    v_out := v_out || ' | L) titulo vacio -> ACEPTADO (fallo)';
  exception when others then
    v_out := v_out || ' | L) titulo vacio -> RECHAZADO';
  end;

  begin
    perform public.system_create_notification(
      v_uid, 'Probe Type Con Espacios', 'Titulo', 'Cuerpo', null, '{}'::jsonb, null);
    v_fail := v_fail + 1;
    v_out := v_out || ' | M) type invalido -> ACEPTADO (fallo)';
  exception when others then
    v_out := v_out || ' | M) type invalido -> RECHAZADO';
  end;

  begin
    perform public.system_create_notification(
      v_uid, 'probe.test', 'Titulo', 'Cuerpo', null,
      jsonb_build_object('blob', repeat('x', 9000)), null);
    v_fail := v_fail + 1;
    v_out := v_out || ' | N) payload desmedido -> ACEPTADO (fallo)';
  exception when others then
    v_out := v_out || ' | N) payload desmedido -> RECHAZADO';
  end;

  -- ═══ Bloque 4 — El flujo legítimo sigue funcionando ══════════════════════
  select count(*) into v_before from public.notifications where recipient_user_id = v_uid;

  begin
    v_id := public.system_create_notification(
      v_uid, 'membership.reviewed', 'Titulo legitimo',
      'Cuerpo legitimo de la notificacion.', '/account/membership',
      jsonb_build_object('application_id', gen_random_uuid()), null);
    select count(*) into v_after from public.notifications where recipient_user_id = v_uid;
    if v_id is null or v_after <> v_before + 1 then v_fail := v_fail + 1; end if;
    v_out := v_out || format(' | O) notificacion legitima -> %s (filas %s->%s)',
      case when v_id is not null then 'CREADA' else 'sin id (regresion)' end, v_before, v_after);
  exception when others then
    get stacked diagnostics v_err = message_text;
    v_fail := v_fail + 1;
    v_out := v_out || format(' | O) notificacion legitima -> ROTA: %s', v_err);
  end;

  -- Fanout a admins desde el servidor (como lo hacen los triggers).
  select count(*) into v_before from public.notifications where type = 'probe.fanout';
  begin
    perform public.notify_membership_admins(
      'probe.fanout', 'Fanout legitimo', 'Cuerpo legitimo del fanout.',
      '/admin/membership', jsonb_build_object('probe', true));
    select count(*) into v_after from public.notifications where type = 'probe.fanout';
    if v_after - v_before < 1 then v_fail := v_fail + 1; end if;
    v_out := v_out || format(' | P) fanout legitimo -> %s notificacion(es) a admins', v_after - v_before);
  exception when others then
    get stacked diagnostics v_err = message_text;
    v_fail := v_fail + 1;
    v_out := v_out || format(' | P) fanout legitimo -> ROTO: %s', v_err);
  end;

  -- Toggle de supresión desde el servidor: encender y apagar.
  begin
    perform public.set_harness_email_suppression(true);
    if not public.harness_email_suppressed() then
      v_fail := v_fail + 1;
      v_out := v_out || ' | Q) suppression on -> NO se activo (regresion)';
    else
      perform public.set_harness_email_suppression(false);
      if public.harness_email_suppressed() then v_fail := v_fail + 1; end if;
      v_out := v_out || case
        when public.harness_email_suppressed() then ' | Q) suppression off -> NO se apago (regresion)'
        else ' | Q) suppression on/off legitimo -> OK'
      end;
    end if;
  exception when others then
    get stacked diagnostics v_err = message_text;
    v_fail := v_fail + 1;
    v_out := v_out || format(' | Q) suppression legitimo -> ROTO: %s', v_err);
  end;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
