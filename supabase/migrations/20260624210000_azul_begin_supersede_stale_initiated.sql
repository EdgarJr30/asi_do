-- Evita pagos de membresía 'initiated' colgados: cuando el miembro inicia un nuevo
-- intento de pago (p. ej. tras abandonar/cancelar AZUL sin que el callback dispare),
-- los intentos previos 'initiated' de la misma solicitud se cierran como 'failed'.
-- Así el panel no se queda en "Estamos confirmando tu pago…" para siempre y el
-- reintento queda como el único pago vigente.
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

  -- Cierra intentos previos sin completar de esta solicitud (abandono/cancelación que
  -- no disparó el callback) para no dejar pagos 'initiated' colgados ni bloquear el panel.
  update public.membership_payments
  set status = 'failed',
      notes = coalesce(nullif(trim(notes), ''), 'superseded by new attempt')
  where application_id = v_app.id and status = 'initiated';

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
