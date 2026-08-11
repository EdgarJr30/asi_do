-- Probe de la retención del historial de notificaciones y correo
-- (migración 20260811010800, regla R-153).
--
-- Lo que se mide no es «borra filas viejas» —eso es lo fácil— sino las tres
-- formas en que una purga puede hacer daño callado:
--
--   A) llevarse una entrega que todavía está en la cola,
--   B) romper el enlace de baja de un correo que sigue en una bandeja de entrada,
--   C) borrar la evidencia de rebote/queja al mismo ritmo que la telemetría.
--
-- Todo el bloque termina en RAISE EXCEPTION: la transacción SIEMPRE se revierte,
-- así que no queda ninguna fila de prueba en producción.
do $probe$
declare
  v_out text := '';
  v_fail int := 0;
  v_err text;
  v_notif_viva uuid;
  v_notif_vieja uuid;
  v_entrega_viva uuid;
  v_entrega_vieja uuid;
  v_token uuid := extensions.gen_random_uuid();
  v_email text := 'probe-retencion@example.invalid';
  v_antiguo timestamptz := timezone('utc', now()) - interval '400 days';
  v_res jsonb;
begin
  -- ── Montaje: una notificación vieja con entrega cerrada, y otra vieja con
  -- entrega VIVA. La segunda es la que la purga no puede tocar.
  insert into public.notifications (type, title, body, payload, created_at)
  values ('email.broadcast', 'probe vieja', 'cuerpo',
          jsonb_build_object('to', v_email, 'unsubscribe_token', v_token::text), v_antiguo)
  returning id into v_notif_vieja;

  insert into public.notifications (type, title, body, payload, created_at)
  values ('email.broadcast', 'probe viva', 'cuerpo',
          jsonb_build_object('to', v_email), v_antiguo)
  returning id into v_notif_viva;

  insert into public.notification_deliveries
    (notification_id, channel, delivery_status, provider_name, created_at)
  values (v_notif_vieja, 'email', 'sent', 'resend', v_antiguo)
  returning id into v_entrega_vieja;

  -- Vieja de fecha pero PENDING: sigue en la cola pese a la antigüedad.
  insert into public.notification_deliveries
    (notification_id, channel, delivery_status, provider_name, created_at)
  values (v_notif_viva, 'email', 'pending', 'resend', v_antiguo)
  returning id into v_entrega_viva;

  insert into public.notification_delivery_logs (delivery_id, log_level, message, created_at)
  values (v_entrega_vieja, 'info', 'probe log viejo', v_antiguo);

  insert into public.email_delivery_events
    (delivery_id, provider_event_id, provider_message_id, event_type, event_created_at, created_at)
  values
    (v_entrega_vieja, 'probe_evt_tel', 'probe_msg', 'email.delivered', v_antiguo, v_antiguo),
    (v_entrega_vieja, 'probe_evt_rep', 'probe_msg', 'email.bounced',  v_antiguo, v_antiguo);

  insert into public.email_unsubscribe_tokens (token, email, created_at)
  values (v_token, v_email, v_antiguo)
  on conflict (token) do nothing;

  -- ── Ejecutar la purga con los plazos por defecto ───────────────────────────
  begin
    v_res := private.purge_notification_history();
  exception when others then
    get stacked diagnostics v_err = message_text;
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | la purga reventó: %', v_err;
  end;

  -- ── A) Nada vivo se toca ───────────────────────────────────────────────────
  if not exists (select 1 from public.notification_deliveries where id = v_entrega_viva) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | A) entrega PENDING vieja -> BORRADA (perdería un correo sin enviar)';
  else
    v_out := v_out || ' | A) entrega PENDING vieja -> conservada OK';
  end if;

  if not exists (select 1 from public.notifications where id = v_notif_viva) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | A2) notificación con entrega viva -> BORRADA (CASCADE se lleva la cola)';
  else
    v_out := v_out || ' | A2) notificación con entrega viva -> conservada OK';
  end if;

  -- ── B) La baja sigue funcionando sin su notificación ───────────────────────
  if exists (select 1 from public.notifications where id = v_notif_vieja) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | B0) notificación vieja y cerrada -> NO se purgó (retención inerte)';
  else
    v_out := v_out || ' | B0) notificación vieja y cerrada -> purgada OK';
  end if;

  -- El token debe sobrevivir a la purga de la notificación que lo llevaba.
  if not exists (select 1 from public.email_unsubscribe_tokens where token = v_token) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | B1) token de baja -> BORRADO con la notificación';
  else
    v_out := v_out || ' | B1) token de baja -> sobrevive OK';
  end if;

  -- Y la baja debe resolverse de verdad, no solo existir la fila.
  begin
    if public.email_unsubscribe(v_token) is not true then
      v_fail := v_fail + 1;
      v_out := v_out || ' | B2) email_unsubscribe tras purga -> false (baja rota en silencio)';
    elsif not exists (
      select 1 from public.email_suppressions where email = lower(v_email)
    ) then
      v_fail := v_fail + 1;
      v_out := v_out || ' | B2) email_unsubscribe devolvió true pero NO suprimió';
    else
      v_out := v_out || ' | B2) baja tras purga -> suprime OK';
    end if;
  exception when others then
    get stacked diagnostics v_err = message_text;
    v_fail := v_fail + 1;
    v_out := v_out || format(' | B2) email_unsubscribe -> ROTO: %s', v_err);
  end;

  -- ── C) La reputación dura más que la telemetría ────────────────────────────
  if exists (
    select 1 from public.email_delivery_events where provider_event_id = 'probe_evt_tel'
  ) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C1) evento de telemetría a 400 días -> NO se purgó';
  else
    v_out := v_out || ' | C1) telemetría vieja -> purgada OK';
  end if;

  if not exists (
    select 1 from public.email_delivery_events where provider_event_id = 'probe_evt_rep'
  ) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C2) rebote a 400 días -> BORRADO (única evidencia de reputación)';
  else
    v_out := v_out || ' | C2) rebote conservado OK';
  end if;

  -- ── D) El resultado se puede leer ──────────────────────────────────────────
  if v_res ? 'deliveries' and v_res ? 'notifications' and v_res ? 'providerEvents' then
    v_out := v_out || ' | D) la purga informa qué borró OK';
  else
    v_fail := v_fail + 1;
    v_out := v_out || format(' | D) resultado sin contadores: %s', v_res);
  end if;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
