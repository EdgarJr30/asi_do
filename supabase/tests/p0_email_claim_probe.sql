-- Pruebas de reserva atómica e idempotencia del envío de correo (TASK-266).
-- Todo ocurre dentro de un bloque que termina en RAISE EXCEPTION, así que la
-- transacción se revierte y no queda ninguna notificación ni entrega de prueba.
do $probe$
declare
  v_user uuid;
  v_notif uuid;
  v_out text := '';
  v_a uuid[];
  v_b uuid[];
  v_solapan integer;
  v_key_1 uuid;
  v_key_2 uuid;
  v_tok uuid;
  v_ok boolean;
  v_status text;
  v_n integer;
  i integer;
  v_fail int := 0;
begin
  -- Destinatario fijo del fixture. Con `limit 1` sobre base vacía `v_user`
  -- quedaba null y los seis `insert` de abajo reventaban por la clave foránea:
  -- la probe moría antes de comprobar nada.
  v_user := 'f1000000-0000-4000-a000-000000000004';

  if not exists (select 1 from public.users where id = v_user) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | falta el fixture %: carga supabase/tests/fixtures.sql', v_user;
  end if;

  -- 6 entregas de email pendientes.
  for i in 1..6 loop
    insert into public.notifications (recipient_user_id, type, title, body)
    values (v_user, 'test.claim', 'Prueba de reserva ' || i, 'cuerpo')
    returning id into v_notif;

    insert into public.notification_deliveries (notification_id, channel, delivery_status, provider_name)
    values (v_notif, 'email', 'pending', 'resend');
  end loop;

  -- ── 1. Dos reservas sucesivas no pueden devolver la misma entrega ──────────
  select array_agg(delivery_id) into v_a
  from public.claim_email_deliveries(3, 300, 5);

  select array_agg(delivery_id) into v_b
  from public.claim_email_deliveries(3, 300, 5);

  select count(*) into v_solapan
  from unnest(v_a) a where a = any(v_b);

  if coalesce(array_length(v_a,1),0) <> 3 or coalesce(array_length(v_b,1),0) <> 3 or v_solapan <> 0 then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format('1) reservas disjuntas: A=%s B=%s solapan=%s (esperado 3/3/0)',
                           coalesce(array_length(v_a,1),0), coalesce(array_length(v_b,1),0), v_solapan);

  -- ── 2. Nada queda reclamable: la tercera llamada vuelve vacía ──────────────
  select count(*) into v_n from public.claim_email_deliveries(10, 300, 5);
  if v_n <> 0 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 2) tercera reserva devuelve %s (esperado 0)', v_n);

  -- ── 3. Recuperación de lease: worker muerto, la fila vuelve a reclamarse ───
  update public.notification_deliveries
  set claimed_at = timezone('utc', now()) - interval '1 hour'
  where id = v_a[1];

  select count(*) into v_n
  from public.claim_email_deliveries(10, 300, 5) c
  where c.delivery_id = v_a[1];
  if v_n <> 1 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 3) lease vencido se recupera: %s (esperado 1)', v_n);

  -- ── 4. La idempotency key sobrevive al reintento automático ────────────────
  select idempotency_key into v_key_1 from public.notification_deliveries where id = v_a[1];
  update public.notification_deliveries
  set claimed_at = timezone('utc', now()) - interval '1 hour'
  where id = v_a[1];
  perform public.claim_email_deliveries(10, 300, 5);
  select idempotency_key into v_key_2 from public.notification_deliveries where id = v_a[1];
  if v_key_1 is distinct from v_key_2 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 4) key estable en reintento: %s (esperado true)', v_key_1 = v_key_2);

  -- ── 5. Tope de intentos: la fila agotada se cierra como fallida ────────────
  update public.notification_deliveries
  set attempt_count = 5, claimed_at = timezone('utc', now()) - interval '1 hour'
  where id = v_a[2];
  perform public.claim_email_deliveries(10, 300, 5);
  select delivery_status into v_status from public.notification_deliveries where id = v_a[2];
  if v_status is distinct from 'failed' then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 5) intentos agotados -> %s (esperado failed)', v_status);

  -- ── 6. Un worker zombi no puede pisar el resultado de la reserva viva ──────
  -- v_a[1] fue re-reclamada en el paso 4, así que su token cambió.
  v_ok := public.complete_email_delivery(v_a[1], gen_random_uuid(), 'sent', 200, 'msg', '{}'::jsonb);
  if v_ok is distinct from false then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 6) cierre con token caduco aplicado=%s (esperado false)', v_ok);

  select claim_token into v_tok from public.notification_deliveries where id = v_a[1];
  v_ok := public.complete_email_delivery(v_a[1], v_tok, 'sent', 200, 'msg', '{}'::jsonb);
  select delivery_status into v_status from public.notification_deliveries where id = v_a[1];
  if v_ok is distinct from true or v_status is distinct from 'sent' then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 7) cierre con token vivo aplicado=%s estado=%s (esperado true/sent)', v_ok, v_status);

  -- ── 8. El reenvío deliberado estrena idempotency key ──────────────────────
  select idempotency_key into v_key_1 from public.notification_deliveries where id = v_a[1];
  update public.notification_deliveries
  set delivery_status = 'pending', idempotency_key = gen_random_uuid(), attempt_count = 0
  where id = v_a[1];
  select idempotency_key into v_key_2 from public.notification_deliveries where id = v_a[1];
  if v_key_1 is not distinct from v_key_2 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 8) key nueva en reenvio: %s (esperado true)', v_key_1 <> v_key_2);

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
