-- Prueba de regresión del P0 TASK-258.
-- Todo el bloque termina en RAISE EXCEPTION: la transacción SIEMPRE se revierte,
-- así que no queda ningún pago, notificación ni audit_log de prueba en producción.
do $probe$
declare
  v_app_id uuid;
  v_user_id uuid;
  v_res record;
  v_out text := '';
begin
  select id, requester_user_id into v_app_id, v_user_id
  from public.institutional_membership_applications
  where requester_user_id is not null
  limit 1;

  if v_app_id is null then
    raise exception 'PROBE_RESULT: no hay solicitudes de membresía para armar el caso de prueba';
  end if;

  -- Caso A: aprobación sin `Amount` — el vector explotable original.
  insert into public.membership_payments
    (application_id, member_user_id, category_slug, amount, currency, method, status, order_number, intent)
  values (v_app_id, v_user_id, 'profesional', 2500.00, 'DOP', 'card', 'initiated', 'SECTEST-A', 'initial');

  select * into v_res from public.azul_settle_membership_payment('SECTEST-A', true, '{}'::jsonb);
  v_out := v_out || format('A) sin Amount -> %s (esperado: failed)', v_res.status);

  -- Caso B: monto correcto e IsoCode aprobado — debe seguir liquidando.
  insert into public.membership_payments
    (application_id, member_user_id, category_slug, amount, currency, method, status, order_number, intent)
  values (v_app_id, v_user_id, 'profesional', 2500.00, 'DOP', 'card', 'initiated', 'SECTEST-B', 'initial');

  select * into v_res from public.azul_settle_membership_payment(
    'SECTEST-B', true, jsonb_build_object('Amount', '250000', 'IsoCode', '00', 'ResponseCode', 'Approved'));
  v_out := v_out || format(' | B) Amount correcto -> %s (esperado: verified)', v_res.status);

  -- Caso C: monto manipulado.
  insert into public.membership_payments
    (application_id, member_user_id, category_slug, amount, currency, method, status, order_number, intent)
  values (v_app_id, v_user_id, 'profesional', 2500.00, 'DOP', 'card', 'initiated', 'SECTEST-C', 'initial');

  select * into v_res from public.azul_settle_membership_payment(
    'SECTEST-C', true, jsonb_build_object('Amount', '1', 'IsoCode', '00'));
  v_out := v_out || format(' | C) Amount manipulado -> %s (esperado: failed)', v_res.status);

  raise exception 'PROBE_RESULT: %', v_out;
end;
$probe$;
