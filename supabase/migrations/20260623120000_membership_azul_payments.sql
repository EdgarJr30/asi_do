-- Pasarela de pagos AZUL (Página de Pago) para membresías.
-- Reemplaza la transferencia + comprobante por pago con tarjeta vía AZUL. El
-- microservicio `services/azul-payments` firma/verifica el AuthHash (HMAC-SHA512) y
-- llama estos RPC. La lógica de negocio, autorización y notificaciones quedan en SQL.
-- Reutiliza: membership_payments, membership_payment_settings, institutional_membership_applications,
-- is_platform_admin(), system_create_notification(), notify_membership_admins(), audit_logs.

-- Los estados 'initiated' y 'failed' se agregan en la migración previa
-- (20260623115000_membership_payment_status_values.sql).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columnas AZUL en los pagos
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.membership_payments
  add column if not exists order_number text,
  add column if not exists intent text not null default 'initial',
  add column if not exists gateway text,
  add column if not exists azul_order_id text,
  add column if not exists authorization_code text,
  add column if not exists azul_rrn text,
  add column if not exists azul_response_code text,
  add column if not exists azul_iso_code text,
  add column if not exists azul_response_message text,
  add column if not exists azul_date_time text,
  add column if not exists gateway_payload jsonb;

create unique index if not exists membership_payments_order_number_key
  on public.membership_payments (order_number)
  where order_number is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Configuración AZUL (no-secreta) en settings. MerchantID/AuthKey viven en el
--    secret store del microservicio, nunca en la DB.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.membership_payment_settings
  add column if not exists azul_enabled boolean not null default false,
  add column if not exists azul_currency_code text not null default '$',
  add column if not exists azul_environment text not null default 'test';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: iniciar pago AZUL (lo llama el miembro vía el microservicio con su JWT).
--    Crea el registro 'initiated', calcula la cuota desde settings y devuelve los
--    datos que el servicio necesita para firmar el formulario de AZUL.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.azul_begin_membership_payment(
  p_application_id uuid,
  p_intent text default 'initial'
)
returns table (
  payment_id uuid,
  order_number text,
  amount numeric,
  currency text,
  category_label text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.institutional_membership_applications;
  v_settings public.membership_payment_settings;
  v_due jsonb;
  v_amount numeric(12, 2);
  v_label text;
  v_order text;
  v_payment public.membership_payments;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(p_intent, 'initial') not in ('initial', 'renewal') then
    raise exception 'Invalid payment intent';
  end if;

  select * into v_app
  from public.institutional_membership_applications
  where id = p_application_id;

  if not found then
    raise exception 'Membership application not found';
  end if;

  if v_app.requester_user_id <> auth.uid() then
    raise exception 'You can only pay for your own membership application';
  end if;

  if p_intent = 'initial' then
    if v_app.status in ('rejected', 'cancelled') then
      raise exception 'This application is not eligible for payment';
    end if;
    if exists (
      select 1 from public.membership_payments mp
      where mp.application_id = v_app.id and mp.status = 'verified'
    ) then
      raise exception 'This application already has a verified payment';
    end if;
  else
    -- renovación: requiere una solicitud aprobada previa
    if v_app.status <> 'approved' then
      raise exception 'Renewal requires an approved membership application';
    end if;
  end if;

  select * into v_settings
  from public.membership_payment_settings
  where is_active = true
  order by updated_at desc
  limit 1;

  if not found then
    raise exception 'Payment settings are not configured';
  end if;

  if not v_settings.azul_enabled then
    raise exception 'AZUL payments are not enabled';
  end if;

  v_due := v_settings.dues_by_category -> v_app.category_slug;
  if v_due is null or (v_due ->> 'amount') is null then
    raise exception 'No configured due for category %', v_app.category_slug;
  end if;

  v_amount := (v_due ->> 'amount')::numeric;
  if v_amount <= 0 then
    raise exception 'Invalid due amount for category %', v_app.category_slug;
  end if;
  v_label := coalesce(v_due ->> 'label', v_app.category_name);

  -- OrderNumber único y compacto (≤ ~20 chars): ASI-AAMMDD-<8 hex>
  v_order := 'ASI-' || to_char(timezone('utc', now()), 'YYMMDD') || '-'
             || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.membership_payments (
    application_id, member_user_id, category_slug, amount, currency,
    method, gateway, intent, order_number,
    period_start, period_end, status, uploaded_by_user_id
  )
  values (
    v_app.id, auth.uid(), v_app.category_slug, v_amount, 'DOP',
    'azul', 'azul', p_intent, v_order,
    current_date, (current_date + interval '1 year')::date, 'initiated', auth.uid()
  )
  returning * into v_payment;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(), 'membership_payment.azul_initiated', 'membership_payment', v_payment.id::text,
    jsonb_build_object('application_id', v_app.id, 'order_number', v_order, 'intent', p_intent, 'amount', v_amount)
  );

  return query
  select v_payment.id, v_payment.order_number, v_payment.amount, v_payment.currency, v_label;
end;
$$;

grant execute on function public.azul_begin_membership_payment(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: liquidar pago AZUL (lo llama el microservicio con service_role desde el
--    callback firmado o el cron). Idempotente: solo actúa sobre pagos 'initiated'.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.azul_settle_membership_payment(
  p_order_number text,
  p_approved boolean,
  p_response jsonb default '{}'::jsonb
)
returns table (
  status text,
  member_user_id uuid,
  application_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.membership_payments;
  v_approved boolean;
  v_expected_amount text;
  v_response_amount text;
  v_final public.membership_payment_status;
begin
  select * into v_payment
  from public.membership_payments
  where order_number = p_order_number
  for update;

  if not found then
    return query select 'noop'::text, null::uuid, null::uuid;
    return;
  end if;

  -- Idempotencia: si ya no está in-flight, no reprocesar.
  if v_payment.status <> 'initiated' then
    return query select 'noop'::text, v_payment.member_user_id, v_payment.application_id;
    return;
  end if;

  v_approved := coalesce(p_approved, false);

  -- Verificación de monto: el monto devuelto por AZUL debe coincidir con el cobrado.
  v_response_amount := nullif(trim(coalesce(p_response ->> 'Amount', '')), '');
  if v_approved and v_response_amount is not null then
    v_expected_amount := (round(v_payment.amount * 100))::bigint::text;
    if v_response_amount <> v_expected_amount then
      v_approved := false;
      p_response := p_response || jsonb_build_object('settlementError', 'amount_mismatch',
                                                     'expectedAmount', v_expected_amount);
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

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    null, 'membership_payment.azul_settled', 'membership_payment', v_payment.id::text,
    jsonb_build_object('approved', v_approved, 'order_number', p_order_number,
                       'response_code', p_response ->> 'ResponseCode')
  );

  -- Notificación al miembro.
  perform public.system_create_notification(
    v_payment.member_user_id,
    'membership.payment_reviewed',
    case when v_approved then 'Tu pago de membresía fue confirmado' else 'Tu pago de membresía no se completó' end,
    case when v_approved
      then 'Recibimos tu pago con tarjeta. El siguiente paso es la activación de tu cuenta por un administrador.'
      else 'No pudimos completar tu pago con tarjeta. Puedes intentarlo de nuevo desde tu panel de membresía.'
    end,
    '/account/membership',
    jsonb_build_object('application_id', v_payment.application_id, 'payment_id', v_payment.id, 'approved', v_approved),
    null
  );

  -- Si fue aprobado, avisar a los admins para que activen la cuenta.
  if v_approved then
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
$$;

-- service_role omite RLS; este RPC solo lo invoca el microservicio. No se otorga a authenticated.
grant execute on function public.azul_settle_membership_payment(text, boolean, jsonb) to service_role;
