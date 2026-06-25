-- ─────────────────────────────────────────────────────────────────────────────
-- system_create_notification: tolera entregas de email canceladas por un trigger.
--
-- El trigger de supresión del arnés (suppress_email_delivery_when_harness) es un
-- BEFORE INSERT en notification_deliveries que devuelve NULL para cancelar la
-- entrega de email mientras la supresión está activa. En ese caso, el
-- `returning id into email_delivery_id` queda en NULL y el INSERT posterior en
-- notification_delivery_logs viola el not-null de delivery_id.
--
-- Arreglo: solo registrar el log de email cuando la entrega realmente se creó
-- (email_delivery_id is not null). Es una guarda defensiva ante cualquier trigger
-- que omita una entrega, no solo el del arnés.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.system_create_notification(
  p_recipient_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_action_url text default null,
  p_payload jsonb default '{}'::jsonb,
  p_tenant_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_row public.notifications;
  in_app_delivery_id uuid;
  email_delivery_id uuid;
begin
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
    p_recipient_user_id,
    p_tenant_id,
    trim(p_type),
    trim(p_title),
    trim(p_body),
    nullif(trim(coalesce(p_action_url, '')), ''),
    coalesce(p_payload, '{}'::jsonb)
  )
  returning * into notification_row;

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
    notification_row.id,
    'in_app',
    'sent',
    'system',
    1,
    timezone('utc', now()),
    timezone('utc', now()),
    jsonb_build_object('source', 'system_create_notification')
  )
  returning id into in_app_delivery_id;

  insert into public.notification_delivery_logs (
    delivery_id,
    log_level,
    message,
    metadata
  )
  values (
    in_app_delivery_id,
    'info',
    'Notification stored in in-app inbox by system trigger',
    jsonb_build_object('notification_id', notification_row.id)
  );

  if exists (
    select 1
    from public.notification_preferences np
    where np.user_id = p_recipient_user_id
      and np.tenant_id is null
      and np.email_enabled = true
  ) then
    insert into public.notification_deliveries (
      notification_id,
      channel,
      delivery_status,
      provider_name,
      response_payload
    )
    values (
      notification_row.id,
      'email',
      'pending',
      'email_hook',
      jsonb_build_object('source', 'system_create_notification')
    )
    returning id into email_delivery_id;

    -- email_delivery_id es NULL si un BEFORE INSERT (p. ej. la supresión del
    -- arnés) canceló la entrega de email: en ese caso no hay nada que registrar.
    if email_delivery_id is not null then
      insert into public.notification_delivery_logs (
        delivery_id,
        log_level,
        message,
        metadata
      )
      values (
        email_delivery_id,
        'info',
        'Email hook queued for workflow notification',
        jsonb_build_object('notification_id', notification_row.id)
      );
    end if;
  end if;

  insert into public.notification_deliveries (
    notification_id,
    channel,
    push_subscription_id,
    delivery_status,
    provider_name,
    response_payload
  )
  select
    notification_row.id,
    'push',
    ps.id,
    'pending',
    'web_push',
    jsonb_build_object('source', 'system_create_notification')
  from public.push_subscriptions ps
  where ps.user_id = p_recipient_user_id
    and ps.is_active = true
    and ps.permission_state = 'granted';

  insert into public.notification_delivery_logs (
    delivery_id,
    log_level,
    message,
    metadata
  )
  select
    nd.id,
    'info',
    'Push delivery queued by workflow notification',
    jsonb_build_object('notification_id', notification_row.id, 'push_subscription_id', nd.push_subscription_id)
  from public.notification_deliveries nd
  where nd.notification_id = notification_row.id
    and nd.channel = 'push';

  return notification_row.id;
end;
$$;
