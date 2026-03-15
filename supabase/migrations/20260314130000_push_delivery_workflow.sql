alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_delivery_logs enable row level security;

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update on public.notification_deliveries to authenticated;
grant select, insert, update on public.notification_delivery_logs to authenticated;

create or replace function public.upsert_notification_preferences(
  p_locale text default 'es',
  p_email_enabled boolean default true,
  p_push_enabled boolean default false,
  p_in_app_enabled boolean default true,
  p_quiet_hours_json jsonb default '{}'::jsonb,
  p_tenant_id uuid default null
)
returns public.notification_preferences
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  current_user uuid := auth.uid();
  preference_row public.notification_preferences;
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  update public.notification_preferences
  set locale = coalesce(nullif(trim(p_locale), ''), locale),
      email_enabled = p_email_enabled,
      push_enabled = p_push_enabled,
      in_app_enabled = p_in_app_enabled,
      quiet_hours_json = coalesce(p_quiet_hours_json, '{}'::jsonb),
      updated_at = timezone('utc', now())
  where user_id = current_user
    and tenant_id is not distinct from p_tenant_id
  returning * into preference_row;

  if preference_row.id is null then
    insert into public.notification_preferences (
      user_id,
      tenant_id,
      locale,
      email_enabled,
      push_enabled,
      in_app_enabled,
      quiet_hours_json
    )
    values (
      current_user,
      p_tenant_id,
      coalesce(nullif(trim(p_locale), ''), 'es'),
      p_email_enabled,
      p_push_enabled,
      p_in_app_enabled,
      coalesce(p_quiet_hours_json, '{}'::jsonb)
    )
    returning * into preference_row;
  end if;

  return preference_row;
end;
$$;

create or replace function public.queue_push_notification(
  p_recipient_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_action_url text default null,
  p_payload jsonb default '{}'::jsonb,
  p_tenant_id uuid default null
)
returns table(
  notification_id uuid,
  push_delivery_id uuid,
  push_subscription_id uuid,
  subscription_endpoint text,
  p256dh_key text,
  auth_key text,
  subscription_locale text,
  notification_title text,
  notification_body text,
  notification_action_url text,
  notification_payload jsonb
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  current_user uuid := auth.uid();
  inserted_notification public.notifications;
  in_app_delivery_id uuid;
  can_send boolean := false;
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  if p_recipient_user_id is null then
    raise exception 'Recipient is required';
  end if;

  if nullif(trim(p_type), '') is null then
    raise exception 'Notification type is required';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Notification title is required';
  end if;

  if nullif(trim(p_body), '') is null then
    raise exception 'Notification body is required';
  end if;

  can_send := (
    current_user = p_recipient_user_id
    and (
      p_tenant_id is null
      or exists(
        select 1
        from public.memberships m
        where m.user_id = current_user
          and m.tenant_id = p_tenant_id
          and m.status = 'active'
      )
    )
  )
  or public.is_platform_admin()
  or (p_tenant_id is not null and public.has_tenant_permission(p_tenant_id, 'notification:manage'));

  if not can_send then
    raise exception 'Not enough permissions to create this notification';
  end if;

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
  returning * into inserted_notification;

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
    inserted_notification.id,
    'in_app',
    'sent',
    'in_app',
    1,
    timezone('utc', now()),
    timezone('utc', now()),
    jsonb_build_object('source', 'queue_push_notification')
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
    'Notification stored in in-app inbox',
    jsonb_build_object(
      'notification_id', inserted_notification.id,
      'recipient_user_id', inserted_notification.recipient_user_id
    )
  );

  return query
  with active_subscriptions as (
    select ps.*
    from public.push_subscriptions ps
    where ps.user_id = p_recipient_user_id
      and ps.is_active = true
      and ps.permission_state = 'granted'
  ),
  inserted_push_deliveries as (
    insert into public.notification_deliveries (
      notification_id,
      channel,
      push_subscription_id,
      delivery_status,
      provider_name,
      response_payload
    )
    select
      inserted_notification.id,
      'push',
      active_subscriptions.id,
      'pending',
      'web_push',
      jsonb_build_object('source', 'queue_push_notification')
    from active_subscriptions
    returning id, push_subscription_id
  ),
  inserted_logs as (
    insert into public.notification_delivery_logs (
      delivery_id,
      log_level,
      message,
      metadata
    )
    select
      inserted_push_deliveries.id,
      'info',
      'Push delivery queued for dispatch',
      jsonb_build_object(
        'notification_id', inserted_notification.id,
        'push_subscription_id', inserted_push_deliveries.push_subscription_id
      )
    from inserted_push_deliveries
  )
  select
    inserted_notification.id,
    inserted_push_deliveries.id,
    active_subscriptions.id,
    active_subscriptions.endpoint,
    active_subscriptions.p256dh_key,
    active_subscriptions.auth_key,
    active_subscriptions.locale,
    inserted_notification.title,
    inserted_notification.body,
    inserted_notification.action_url,
    inserted_notification.payload
  from inserted_push_deliveries
  join active_subscriptions on active_subscriptions.id = inserted_push_deliveries.push_subscription_id

  union all

  select
    inserted_notification.id,
    null::uuid,
    null::uuid,
    null::text,
    null::text,
    null::text,
    null::text,
    inserted_notification.title,
    inserted_notification.body,
    inserted_notification.action_url,
    inserted_notification.payload
  where not exists (
    select 1
    from public.push_subscriptions ps
    where ps.user_id = p_recipient_user_id
      and ps.is_active = true
      and ps.permission_state = 'granted'
  );
end;
$$;

create or replace function public.update_push_delivery_status(
  p_delivery_id uuid,
  p_delivery_status text,
  p_response_code integer default null,
  p_provider_message_id text default null,
  p_response_payload jsonb default '{}'::jsonb,
  p_log_level text default 'info',
  p_log_message text default null,
  p_deactivate_subscription boolean default false,
  p_permission_state text default null
)
returns public.notification_deliveries
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  current_user uuid := auth.uid();
  delivery_row public.notification_deliveries;
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  if p_delivery_status not in ('pending', 'processing', 'sent', 'failed', 'read', 'clicked') then
    raise exception 'Unsupported delivery status %', p_delivery_status;
  end if;

  if not (
    public.is_platform_admin()
    or exists(
      select 1
      from public.notification_deliveries nd
      join public.notifications n on n.id = nd.notification_id
      where nd.id = p_delivery_id
        and (
          n.recipient_user_id = current_user
          or (
            n.tenant_id is not null
            and public.has_tenant_permission(n.tenant_id, 'notification:manage')
          )
        )
    )
  ) then
    raise exception 'Not enough permissions to update this delivery';
  end if;

  update public.notification_deliveries
  set delivery_status = p_delivery_status,
      provider_message_id = coalesce(p_provider_message_id, provider_message_id),
      response_code = coalesce(p_response_code, response_code),
      response_payload = coalesce(p_response_payload, '{}'::jsonb),
      attempt_count = case
        when p_delivery_status in ('processing', 'sent', 'failed') then attempt_count + 1
        else attempt_count
      end,
      last_attempt_at = case
        when p_delivery_status in ('processing', 'sent', 'failed') then timezone('utc', now())
        else last_attempt_at
      end,
      delivered_at = case
        when p_delivery_status = 'sent' then timezone('utc', now())
        when p_delivery_status in ('read', 'clicked') then coalesce(delivered_at, timezone('utc', now()))
        else delivered_at
      end,
      failed_at = case
        when p_delivery_status = 'failed' then timezone('utc', now())
        else failed_at
      end,
      updated_at = timezone('utc', now())
  where id = p_delivery_id
  returning * into delivery_row;

  if delivery_row.id is null then
    raise exception 'Delivery not found';
  end if;

  if coalesce(nullif(trim(coalesce(p_log_message, '')), ''), '') <> '' then
    insert into public.notification_delivery_logs (
      delivery_id,
      log_level,
      message,
      metadata
    )
    values (
      delivery_row.id,
      coalesce(nullif(trim(p_log_level), ''), 'info'),
      trim(p_log_message),
      jsonb_build_object(
        'response_code', p_response_code,
        'provider_message_id', p_provider_message_id,
        'response_payload', coalesce(p_response_payload, '{}'::jsonb),
        'delivery_status', p_delivery_status
      )
    );
  end if;

  if p_deactivate_subscription and delivery_row.push_subscription_id is not null then
    update public.push_subscriptions
    set is_active = false,
        permission_state = coalesce(nullif(trim(coalesce(p_permission_state, '')), ''), permission_state),
        updated_at = timezone('utc', now())
    where id = delivery_row.push_subscription_id;
  end if;

  return delivery_row;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  current_user uuid := auth.uid();
  notification_row public.notifications;
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_notification_id
    and recipient_user_id = current_user
  returning * into notification_row;

  if notification_row.id is null then
    raise exception 'Notification not found or not accessible';
  end if;

  update public.notification_deliveries
  set delivery_status = case
        when delivery_status = 'clicked' then delivery_status
        else 'read'
      end,
      updated_at = timezone('utc', now())
  where notification_id = notification_row.id
    and channel = 'in_app';

  insert into public.notification_delivery_logs (
    delivery_id,
    log_level,
    message,
    metadata
  )
  select
    nd.id,
    'info',
    'Notification marked as read by recipient',
    jsonb_build_object('notification_id', notification_row.id)
  from public.notification_deliveries nd
  where nd.notification_id = notification_row.id
    and nd.channel = 'in_app';

  return notification_row;
end;
$$;

create or replace function public.mark_notification_clicked(
  p_notification_id uuid,
  p_delivery_id uuid default null
)
returns public.notifications
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  current_user uuid := auth.uid();
  notification_row public.notifications;
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
  set clicked_at = coalesce(clicked_at, timezone('utc', now())),
      read_at = coalesce(read_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_notification_id
    and recipient_user_id = current_user
  returning * into notification_row;

  if notification_row.id is null then
    raise exception 'Notification not found or not accessible';
  end if;

  if p_delivery_id is not null then
    update public.notification_deliveries
    set delivery_status = 'clicked',
        updated_at = timezone('utc', now())
    where id = p_delivery_id
      and notification_id = notification_row.id;

    insert into public.notification_delivery_logs (
      delivery_id,
      log_level,
      message,
      metadata
    )
    values (
      p_delivery_id,
      'info',
      'Notification click tracked from client',
      jsonb_build_object('notification_id', notification_row.id)
    );
  end if;

  return notification_row;
end;
$$;

grant execute on function public.upsert_notification_preferences(text, boolean, boolean, boolean, jsonb, uuid) to authenticated;
grant execute on function public.queue_push_notification(uuid, text, text, text, text, jsonb, uuid) to authenticated;
grant execute on function public.update_push_delivery_status(uuid, text, integer, text, jsonb, text, text, boolean, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_notification_clicked(uuid, uuid) to authenticated;
