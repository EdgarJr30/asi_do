-- ─────────────────────────────────────────────────────────────────────────────
-- P0 — Endurecimiento de lógica (auditoría 2026-07-29).
--
-- Complementa 20260801120000, que cerró los grants. Aquí se corrigen los fallos
-- de lógica que hacían explotables las funciones aun con permisos correctos,
-- para que la mitigación no dependa de una sola capa.
--
--   TASK-256: set_runtime_secret no validaba el rol del llamante.
--   TASK-258: las liquidaciones AZUL aprobaban sin comprobar el monto cuando
--             el campo `Amount` venía ausente del payload.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. set_runtime_secret: guarda de rol interna ─────────────────────────────
-- El grant ya limita a service_role; esta validación evita que un GRANT
-- accidental futuro vuelva a abrir el setter de secretos.

create or replace function public.set_runtime_secret(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- auth.role() refleja el claim del JWT (service_role vía PostgREST); en
  -- conexiones directas (cron, psql de mantenimiento) cae a session_user.
  v_role := coalesce(nullif(auth.role(), ''), session_user::text);

  if v_role not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'set_runtime_secret requiere service_role (rol recibido: %)', v_role
      using errcode = 'insufficient_privilege';
  end if;

  insert into private.runtime_secrets (key, value, updated_at)
  values (p_key, p_value, timezone('utc', now()))
  on conflict (key) do update
    set value = excluded.value,
        updated_at = timezone('utc', now());
end;
$$;

revoke all on function public.set_runtime_secret(text, text) from public, anon, authenticated;
grant execute on function public.set_runtime_secret(text, text) to service_role;

-- ── 2. Liquidación de membresía: monto obligatorio al aprobar ────────────────
-- Antes: `if v_approved and v_response_amount is not null` — omitir `Amount`
-- saltaba la comprobación entera y la aprobación pasaba sin validar el importe.
-- Ahora la ausencia de `Amount` degrada a fallo, igual que un monto que no cuadra.
-- `Amount` e `IsoCode` viajan dentro del AuthHash que verifica el microservicio,
-- así que una liquidación legítima siempre los trae.

create or replace function public.azul_settle_membership_payment(
  p_order_number text,
  p_approved boolean,
  p_response jsonb default '{}'::jsonb
)
returns table(status text, member_user_id uuid, application_id uuid)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_payment public.membership_payments;
  v_approved boolean;
  v_expected_amount text;
  v_response_amount text;
  v_iso_code text;
  v_final public.membership_payment_status;
  v_previous_expiry timestamptz;
  v_base timestamptz;
  v_new_expiry timestamptz;
begin
  select * into v_payment
  from public.membership_payments
  where order_number = p_order_number
  for update;

  if not found then
    return query select 'noop'::text, null::uuid, null::uuid;
    return;
  end if;

  if v_payment.status <> 'initiated' then
    return query select 'noop'::text, v_payment.member_user_id, v_payment.application_id;
    return;
  end if;

  v_approved := coalesce(p_approved, false);

  if v_approved then
    v_expected_amount := (round(v_payment.amount * 100))::bigint::text;
    v_response_amount := nullif(trim(coalesce(p_response ->> 'Amount', '')), '');
    v_iso_code := nullif(trim(coalesce(p_response ->> 'IsoCode', '')), '');

    if v_response_amount is null then
      v_approved := false;
      p_response := p_response || jsonb_build_object('settlementError', 'missing_amount',
                                                     'expectedAmount', v_expected_amount);
    elsif v_response_amount <> v_expected_amount then
      v_approved := false;
      p_response := p_response || jsonb_build_object('settlementError', 'amount_mismatch',
                                                     'expectedAmount', v_expected_amount);
    elsif v_iso_code is distinct from '00' then
      v_approved := false;
      p_response := p_response || jsonb_build_object('settlementError', 'iso_code_not_approved');
    end if;
  end if;

  v_final := case when v_approved then 'verified' else 'failed' end::public.membership_payment_status;

  update public.membership_payments
  set
    status = v_final,
    authorization_code = nullif(trim(coalesce(p_response ->> 'AuthorizationCode', '')), ''),
    azul_order_id = nullif(trim(coalesce(p_response ->> 'AzulOrderId', '')), ''),
    azul_rrn = nullif(trim(coalesce(p_response ->> 'RRN', '')), ''),
    azul_response_code = nullif(trim(coalesce(p_response ->> 'ResponseCode', '')), ''),
    azul_iso_code = nullif(trim(coalesce(p_response ->> 'IsoCode', '')), ''),
    azul_response_message = nullif(trim(coalesce(p_response ->> 'ResponseMessage', '')), ''),
    azul_date_time = nullif(trim(coalesce(p_response ->> 'DateTime', '')), ''),
    gateway_payload = coalesce(p_response, '{}'::jsonb),
    verified_by_user_id = null,
    verified_at = timezone('utc', now())
  where id = v_payment.id
  returning * into v_payment;

  if v_approved and v_payment.intent = 'renewal' then
    select membership_expires_at into v_previous_expiry
    from public.users
    where id = v_payment.member_user_id
    for update;

    v_base := greatest(coalesce(v_previous_expiry, timezone('utc', now())), timezone('utc', now()));
    v_new_expiry := v_base + make_interval(months => greatest(coalesce(v_payment.term_months, 12), 1));

    update public.users
    set
      status = 'active',
      user_approval_status = 'approved',
      asi_membership_status = 'active',
      user_subscription_status = 'active',
      membership_activated_at = coalesce(membership_activated_at, timezone('utc', now())),
      membership_expires_at = v_new_expiry,
      subscription_expires_at = v_new_expiry
    where id = v_payment.member_user_id;

    update public.membership_payments
    set
      period_start = v_base::date,
      period_end = v_new_expiry::date
    where id = v_payment.id
    returning * into v_payment;

    insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
    values (
      null,
      'member.renewed',
      'user',
      v_payment.member_user_id::text,
      jsonb_build_object(
        'payment_id', v_payment.id,
        'application_id', v_payment.application_id,
        'previous_expires_at', v_previous_expiry,
        'base_expires_at', v_base,
        'expires_at', v_new_expiry,
        'term_months', v_payment.term_months
      )
    );
  end if;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    null,
    'membership_payment.azul_settled',
    'membership_payment',
    v_payment.id::text,
    jsonb_build_object(
      'approved', v_approved,
      'order_number', p_order_number,
      'intent', v_payment.intent,
      'term_months', v_payment.term_months,
      'period_start', v_payment.period_start,
      'period_end', v_payment.period_end,
      'response_code', p_response ->> 'ResponseCode',
      'settlement_error', p_response ->> 'settlementError'
    )
  );

  perform public.system_create_notification(
    v_payment.member_user_id,
    'membership.payment_reviewed',
    case
      when not v_approved then 'Tu pago de membresía no se completó'
      when v_payment.intent = 'renewal' then 'Tu membresía fue renovada'
      else 'Tu pago de membresía fue confirmado'
    end,
    case
      when not v_approved then 'No pudimos completar tu pago con tarjeta. Puedes intentarlo de nuevo desde tu panel de membresía.'
      when v_payment.intent = 'renewal' then 'Recibimos tu pago. Tu membresía quedó renovada y la nueva fecha de vencimiento ya está actualizada.'
      else 'Recibimos tu pago con tarjeta. El siguiente paso es la activación de tu cuenta por un administrador.'
    end,
    '/account/membership',
    jsonb_build_object(
      'application_id', v_payment.application_id,
      'payment_id', v_payment.id,
      'approved', v_approved,
      'intent', v_payment.intent,
      'expires_at', v_new_expiry
    ),
    null
  );

  if v_approved and v_payment.intent = 'renewal' then
    perform public.notify_membership_admins(
      'membership.renewed',
      'Membresía renovada',
      'Un miembro completó una renovación con tarjeta. La vigencia de su membresía ya fue extendida automáticamente.',
      '/admin/membership',
      jsonb_build_object(
        'application_id', v_payment.application_id,
        'payment_id', v_payment.id,
        'member_user_id', v_payment.member_user_id,
        'expires_at', v_new_expiry,
        'term_months', v_payment.term_months
      )
    );
  end if;

  if v_approved and v_payment.intent <> 'renewal' then
    perform public.notify_membership_admins(
      'membership.payment_submitted',
      'Pago de membresía confirmado por AZUL',
      'Un miembro completó su pago con tarjeta. Verifica la solicitud y activa la cuenta.',
      '/admin/membership',
      jsonb_build_object('application_id', v_payment.application_id, 'payment_id', v_payment.id)
    );
  end if;

  return query select v_final::text, v_payment.member_user_id, v_payment.application_id;
end;
$function$;

-- ── 3. Liquidación de donación: mismo criterio ───────────────────────────────

create or replace function public.azul_settle_donation_payment(
  p_order_number text,
  p_approved boolean,
  p_response jsonb default '{}'::jsonb
)
returns table(status text, donor_user_id uuid, donation_id uuid)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_donation public.donations;
  v_approved boolean;
  v_expected_amount text;
  v_response_amount text;
  v_iso_code text;
  v_final public.donation_payment_status;
begin
  select * into v_donation
  from public.donations
  where order_number = p_order_number
  for update;

  if not found then
    return query select 'noop'::text, null::uuid, null::uuid;
    return;
  end if;

  if v_donation.status <> 'initiated' then
    return query select 'noop'::text, v_donation.donor_user_id, v_donation.id;
    return;
  end if;

  v_approved := coalesce(p_approved, false);

  if v_approved then
    v_expected_amount := (round(v_donation.amount * 100))::bigint::text;
    v_response_amount := nullif(trim(coalesce(p_response ->> 'Amount', '')), '');
    v_iso_code := nullif(trim(coalesce(p_response ->> 'IsoCode', '')), '');

    if v_response_amount is null then
      v_approved := false;
      p_response := p_response || jsonb_build_object('settlementError', 'missing_amount',
                                                     'expectedAmount', v_expected_amount);
    elsif v_response_amount <> v_expected_amount then
      v_approved := false;
      p_response := p_response || jsonb_build_object('settlementError', 'amount_mismatch',
                                                     'expectedAmount', v_expected_amount);
    elsif v_iso_code is distinct from '00' then
      v_approved := false;
      p_response := p_response || jsonb_build_object('settlementError', 'iso_code_not_approved');
    end if;
  end if;

  v_final := case
    when v_approved then 'verified'::public.donation_payment_status
    when coalesce(p_response ->> 'outcome', '') = 'cancelled' then 'cancelled'::public.donation_payment_status
    else 'failed'::public.donation_payment_status
  end;

  update public.donations
  set
    status = v_final,
    authorization_code = nullif(trim(coalesce(p_response ->> 'AuthorizationCode', '')), ''),
    azul_order_id = nullif(trim(coalesce(p_response ->> 'AzulOrderId', '')), ''),
    azul_rrn = nullif(trim(coalesce(p_response ->> 'RRN', '')), ''),
    azul_response_code = nullif(trim(coalesce(p_response ->> 'ResponseCode', '')), ''),
    azul_iso_code = nullif(trim(coalesce(p_response ->> 'IsoCode', '')), ''),
    azul_response_message = nullif(trim(coalesce(p_response ->> 'ResponseMessage', '')), ''),
    azul_date_time = nullif(trim(coalesce(p_response ->> 'DateTime', '')), ''),
    gateway_payload = coalesce(p_response, '{}'::jsonb),
    settled_at = timezone('utc', now())
  where id = v_donation.id
  returning * into v_donation;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    null,
    'donation.azul_settled',
    'donation',
    v_donation.id::text,
    jsonb_build_object('approved', v_approved, 'status', v_final, 'order_number', p_order_number,
                       'amount', v_donation.amount, 'response_code', p_response ->> 'ResponseCode',
                       'settlement_error', p_response ->> 'settlementError')
  );

  if v_approved then
    perform public.enqueue_donation_receipt_email(v_donation.id);
  elsif v_donation.donor_user_id is not null then
    perform public.system_create_notification(
      v_donation.donor_user_id,
      'donation.payment_reviewed',
      'Tu donación no se completó',
      'No pudimos completar el pago de tu donación. Puedes intentarlo de nuevo desde la página de donaciones.',
      '/donate',
      jsonb_build_object('donation_id', v_donation.id, 'approved', false, 'amount', v_donation.amount),
      null
    );
  end if;

  return query select v_final::text, v_donation.donor_user_id, v_donation.id;
end;
$function$;

-- `create or replace` conserva la ACL previa, pero se reafirma para que el
-- estado quede explícito en la migración y no dependa del orden de aplicación.
revoke all on function public.azul_settle_membership_payment(text, boolean, jsonb)
  from public, anon, authenticated;
revoke all on function public.azul_settle_donation_payment(text, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.azul_settle_membership_payment(text, boolean, jsonb) to service_role;
grant execute on function public.azul_settle_donation_payment(text, boolean, jsonb) to service_role;
