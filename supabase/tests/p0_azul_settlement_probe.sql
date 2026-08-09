-- Prueba de regresión del P0 TASK-258.
-- Todo el bloque termina en RAISE EXCEPTION: la transacción SIEMPRE se revierte,
-- así que no queda ningún pago, notificación ni audit_log de prueba en producción.
do $probe$
declare
  v_app_id uuid;
  v_user_id uuid;
  v_res record;
  v_out text := '';
  v_fail int := 0;
begin
  -- Solicitud fija del fixture. Con `limit 1` la probe liquidaba pagos contra
  -- una solicitud cualquiera —distinta en cada corrida— y sobre base vacía ni
  -- siquiera llegaba a ejecutarse.
  v_app_id := 'f7000000-0000-4000-a000-000000000001';
  v_user_id := 'f1000000-0000-4000-a000-000000000004';

  if not exists (select 1 from public.institutional_membership_applications where id = v_app_id) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | falta el fixture %: carga supabase/tests/fixtures.sql', v_app_id;
  end if;

  -- Caso A: aprobación sin `Amount` — el vector explotable original.
  insert into public.membership_payments
    (application_id, member_user_id, category_slug, amount, currency, method, status, order_number, intent)
  values (v_app_id, v_user_id, 'profesional', 2500.00, 'DOP', 'card', 'initiated', 'SECTEST-A', 'initial');

  select * into v_res from public.azul_settle_membership_payment('SECTEST-A', true, '{}'::jsonb);
  if v_res.status is distinct from 'failed' then v_fail := v_fail + 1; end if;
  v_out := v_out || format('A) sin Amount -> %s (esperado: failed)', v_res.status);

  -- Caso B: monto correcto e IsoCode aprobado — debe seguir liquidando.
  insert into public.membership_payments
    (application_id, member_user_id, category_slug, amount, currency, method, status, order_number, intent)
  values (v_app_id, v_user_id, 'profesional', 2500.00, 'DOP', 'card', 'initiated', 'SECTEST-B', 'initial');

  select * into v_res from public.azul_settle_membership_payment(
    'SECTEST-B', true, jsonb_build_object('Amount', '250000', 'IsoCode', '00', 'ResponseCode', 'Approved'));
  if v_res.status is distinct from 'verified' then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | B) Amount correcto -> %s (esperado: verified)', v_res.status);

  -- Caso C: monto manipulado.
  insert into public.membership_payments
    (application_id, member_user_id, category_slug, amount, currency, method, status, order_number, intent)
  values (v_app_id, v_user_id, 'profesional', 2500.00, 'DOP', 'card', 'initiated', 'SECTEST-C', 'initial');

  select * into v_res from public.azul_settle_membership_payment(
    'SECTEST-C', true, jsonb_build_object('Amount', '1', 'IsoCode', '00'));
  if v_res.status is distinct from 'failed' then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | C) Amount manipulado -> %s (esperado: failed)', v_res.status);

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
