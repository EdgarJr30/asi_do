-- Encola un correo transaccional para donaciones aprobadas.
-- Las donaciones pueden ser publicas/anónimas: en ese caso no hay inbox de usuario,
-- pero el correo del formulario sigue siendo el destinatario del comprobante.

alter table public.notifications
  alter column recipient_user_id drop not null;

create or replace function public.enqueue_donation_receipt_email(p_donation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donation public.donations;
  v_notification_id uuid;
  v_in_app_delivery_id uuid;
  v_email_delivery_id uuid;
  v_existing_delivery_id uuid;
  v_amount_label text;
  v_donor_name text;
  v_body text;
begin
  select * into v_donation
  from public.donations
  where id = p_donation_id
    and status = 'verified'
    and nullif(trim(coalesce(donor_email, '')), '') is not null;

  if not found then
    return null;
  end if;

  select nd.id into v_existing_delivery_id
  from public.notification_deliveries nd
  join public.notifications n on n.id = nd.notification_id
  where nd.channel = 'email'
    and n.type = 'donation.receipt_issued'
    and n.payload ->> 'donation_id' = v_donation.id::text
  order by nd.created_at asc
  limit 1;

  if v_existing_delivery_id is not null then
    return v_existing_delivery_id;
  end if;

  v_amount_label := v_donation.currency || ' ' || trim(to_char(v_donation.amount, 'FM999G999G999G990D00'));
  v_donor_name := coalesce(nullif(trim(coalesce(v_donation.donor_name, '')), ''), 'donante');
  v_body := concat_ws(
    E'\n\n',
    'Recibimos tu aporte para ASI República Dominicana. Gracias por apoyar la misión.',
    'Monto: ' || v_amount_label,
    'Orden: ' || v_donation.order_number,
    case
      when nullif(trim(coalesce(v_donation.designation, '')), '') is not null
        then 'Destino: ' || trim(v_donation.designation)
      else null
    end,
    'Referencia AZUL: ' || coalesce(nullif(trim(coalesce(v_donation.azul_rrn, '')), ''), 'pendiente en la respuesta de AZUL')
  );

  insert into public.notifications (
    recipient_user_id,
    tenant_id,
    type,
    title,
    body,
    action_url,
    payload
  )
  values (
    v_donation.donor_user_id,
    null,
    'donation.receipt_issued',
    'Recibimos tu donación',
    v_body,
    '/donate?payment=approved&order=' || v_donation.order_number,
    jsonb_build_object(
      'to', lower(trim(v_donation.donor_email)),
      'recipientName', v_donor_name,
      'donation_id', v_donation.id,
      'order_number', v_donation.order_number,
      'approved', true,
      'amount', v_donation.amount,
      'currency', v_donation.currency,
      'designation', v_donation.designation,
      'azul_rrn', v_donation.azul_rrn
    )
  )
  returning id into v_notification_id;

  if v_donation.donor_user_id is not null then
    insert into public.notification_deliveries (
      notification_id,
      channel,
      delivery_status,
      provider_name,
      attempt_count,
      last_attempt_at,
      delivered_at,
      response_payload
    )
    values (
      v_notification_id,
      'in_app',
      'sent',
      'system',
      1,
      timezone('utc', now()),
      timezone('utc', now()),
      jsonb_build_object('source', 'enqueue_donation_receipt_email')
    )
    returning id into v_in_app_delivery_id;

    insert into public.notification_delivery_logs (delivery_id, log_level, message, metadata)
    values (
      v_in_app_delivery_id,
      'info',
      'Donation receipt notification stored in in-app inbox',
      jsonb_build_object('notification_id', v_notification_id)
    );
  end if;

  insert into public.notification_deliveries (
    notification_id,
    channel,
    delivery_status,
    provider_name,
    response_payload
  )
  values (
    v_notification_id,
    'email',
    'pending',
    'email_hook',
    jsonb_build_object('source', 'enqueue_donation_receipt_email')
  )
  returning id into v_email_delivery_id;

  if v_email_delivery_id is not null then
    insert into public.notification_delivery_logs (delivery_id, log_level, message, metadata)
    values (
      v_email_delivery_id,
      'info',
      'Donation receipt email queued for donor',
      jsonb_build_object('notification_id', v_notification_id, 'donation_id', v_donation.id)
    );
  end if;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    null,
    'donation.receipt_email_queued',
    'donation',
    v_donation.id::text,
    jsonb_build_object('notification_id', v_notification_id, 'delivery_id', v_email_delivery_id, 'to', lower(trim(v_donation.donor_email)))
  );

  return v_email_delivery_id;
end;
$$;

revoke all on function public.enqueue_donation_receipt_email(uuid) from public;
grant execute on function public.enqueue_donation_receipt_email(uuid) to service_role;

create or replace function public.azul_settle_donation_payment(
  p_order_number text,
  p_approved boolean,
  p_response jsonb default '{}'::jsonb
)
returns table (
  status text,
  donor_user_id uuid,
  donation_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donation public.donations;
  v_approved boolean;
  v_expected_amount text;
  v_response_amount text;
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

  v_response_amount := nullif(trim(coalesce(p_response ->> 'Amount', '')), '');
  if v_approved and v_response_amount is not null then
    v_expected_amount := (round(v_donation.amount * 100))::bigint::text;
    if v_response_amount <> v_expected_amount then
      v_approved := false;
      p_response := p_response || jsonb_build_object('settlementError', 'amount_mismatch',
                                                     'expectedAmount', v_expected_amount);
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
                       'amount', v_donation.amount, 'response_code', p_response ->> 'ResponseCode')
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
$$;

grant execute on function public.azul_settle_donation_payment(text, boolean, jsonb) to service_role;
