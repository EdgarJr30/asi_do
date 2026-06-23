-- Membresía multi-año (1–5) + fechas + auto-renovación.
-- * El miembro puede pagar de 1 a 5 años; el monto se calcula como cuota_anual × años.
-- * Se guarda el término (term_months) en el pago y la fecha de activación en users.
-- * La RENOVACIÓN verificada extiende la vigencia automáticamente (sin admin), ya que
--   el miembro ya estaba aprobado/activo. La activación INICIAL sigue siendo del admin,
--   pero ahora deriva el término del pago verificado.

-- ── 1. Columnas nuevas ────────────────────────────────────────────────────────
alter table public.membership_payments
  add column if not exists term_months integer not null default 12;

alter table public.users
  add column if not exists membership_activated_at timestamptz;

-- ── 2. Iniciar pago AZUL con años (1–5) ───────────────────────────────────────
create or replace function public.azul_begin_membership_payment(
  p_application_id uuid,
  p_intent text default 'initial',
  p_years integer default 1
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
  v_annual numeric(12, 2);
  v_amount numeric(12, 2);
  v_years integer;
  v_term_months integer;
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

  -- Años permitidos: 1 a 5 (default 1).
  v_years := least(greatest(coalesce(p_years, 1), 1), 5);
  v_term_months := v_years * 12;

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

  v_annual := (v_due ->> 'amount')::numeric;
  if v_annual <= 0 then
    raise exception 'Invalid due amount for category %', v_app.category_slug;
  end if;
  v_amount := v_annual * v_years;
  v_label := coalesce(v_due ->> 'label', v_app.category_name);

  v_order := 'ASI-' || to_char(timezone('utc', now()), 'YYMMDD') || '-'
             || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.membership_payments (
    application_id, member_user_id, category_slug, amount, currency,
    method, gateway, intent, order_number, term_months,
    period_start, period_end, status, uploaded_by_user_id
  )
  values (
    v_app.id, auth.uid(), v_app.category_slug, v_amount, 'DOP',
    'azul', 'azul', p_intent, v_order, v_term_months,
    current_date, (current_date + make_interval(months => v_term_months))::date, 'initiated', auth.uid()
  )
  returning * into v_payment;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(), 'membership_payment.azul_initiated', 'membership_payment', v_payment.id::text,
    jsonb_build_object('application_id', v_app.id, 'order_number', v_order, 'intent', p_intent,
                       'amount', v_amount, 'years', v_years)
  );

  return query
  select v_payment.id, v_payment.order_number, v_payment.amount, v_payment.currency, v_label;
end;
$$;

grant execute on function public.azul_begin_membership_payment(uuid, text, integer) to authenticated;

-- ── 3. Liquidar pago: en renovación verificada, extender vigencia automáticamente ─
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
                       'intent', v_payment.intent, 'term_months', v_payment.term_months,
                       'response_code', p_response ->> 'ResponseCode')
  );

  -- RENOVACIÓN aprobada → extiende la vigencia sin intervención del admin.
  if v_approved and v_payment.intent = 'renewal' then
    v_base := greatest(
      coalesce((select membership_expires_at from public.users where id = v_payment.member_user_id), timezone('utc', now())),
      timezone('utc', now())
    );
    v_new_expiry := v_base + make_interval(months => v_payment.term_months);

    update public.users
    set
      status = 'active',
      asi_membership_status = 'active',
      user_subscription_status = 'active',
      membership_expires_at = v_new_expiry,
      subscription_expires_at = v_new_expiry
    where id = v_payment.member_user_id;

    insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
    values (
      null, 'member.renewed', 'user', v_payment.member_user_id::text,
      jsonb_build_object('payment_id', v_payment.id, 'expires_at', v_new_expiry, 'term_months', v_payment.term_months)
    );
  end if;

  -- Notificación al miembro.
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
    jsonb_build_object('application_id', v_payment.application_id, 'payment_id', v_payment.id,
                       'approved', v_approved, 'intent', v_payment.intent),
    null
  );

  -- Pago INICIAL aprobado → avisar a los admins para que activen la cuenta.
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
$$;

grant execute on function public.azul_settle_membership_payment(text, boolean, jsonb) to service_role;

-- ── 4. Activar miembro: deriva el término del pago verificado + fecha de activación ─
create or replace function public.activate_member(
  p_application_id uuid,
  p_notes text default null,
  p_membership_months integer default 12
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.institutional_membership_applications;
  v_user public.users;
  v_term_months integer;
  v_months integer;
  v_now timestamptz := timezone('utc', now());
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can activate a member';
  end if;

  select * into v_app
  from public.institutional_membership_applications
  where id = p_application_id;

  if not found then
    raise exception 'Membership application not found';
  end if;

  if v_app.requester_user_id is null then
    raise exception 'Application has no linked user account';
  end if;

  if v_app.status <> 'approved' then
    raise exception 'Application must be approved before activation';
  end if;

  -- Término del último pago verificado (multi-año); fallback al parámetro o 12.
  select mp.term_months into v_term_months
  from public.membership_payments mp
  where mp.application_id = p_application_id and mp.status = 'verified'
  order by mp.verified_at desc nulls last, mp.created_at desc
  limit 1;

  if v_term_months is null then
    raise exception 'A verified payment is required before activation';
  end if;

  v_months := greatest(coalesce(v_term_months, p_membership_months, 12), 1);
  v_expires := v_now + make_interval(months => v_months);

  update public.users
  set
    status = 'active',
    user_approval_status = 'approved',
    asi_membership_status = 'active',
    user_subscription_status = 'active',
    membership_activated_at = coalesce(membership_activated_at, v_now),
    membership_expires_at = v_expires,
    subscription_expires_at = v_expires
  where id = v_app.requester_user_id
  returning * into v_user;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'member.activated',
    'user',
    v_user.id::text,
    jsonb_build_object('application_id', p_application_id, 'expires_at', v_expires,
                       'term_months', v_months, 'notes', nullif(trim(p_notes), ''))
  );

  return v_user;
end;
$$;

grant execute on function public.activate_member(uuid, text, integer) to authenticated;
