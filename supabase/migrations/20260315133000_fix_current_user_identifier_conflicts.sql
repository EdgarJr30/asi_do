create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh_key text,
  p_auth_key text,
  p_device_label text default null,
  p_device_kind text default null,
  p_locale text default 'es',
  p_user_agent text default null,
  p_tenant_id uuid default null
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_current_user_id uuid := auth.uid();
  subscription_row public.push_subscriptions;
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.push_subscriptions (
    user_id,
    tenant_id,
    endpoint,
    p256dh_key,
    auth_key,
    device_label,
    device_kind,
    user_agent,
    locale,
    permission_state,
    is_active,
    last_seen_at
  )
  values (
    v_current_user_id,
    p_tenant_id,
    p_endpoint,
    p_p256dh_key,
    p_auth_key,
    p_device_label,
    p_device_kind,
    p_user_agent,
    p_locale,
    'granted',
    true,
    timezone('utc', now())
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        tenant_id = excluded.tenant_id,
        p256dh_key = excluded.p256dh_key,
        auth_key = excluded.auth_key,
        device_label = excluded.device_label,
        device_kind = excluded.device_kind,
        user_agent = excluded.user_agent,
        locale = excluded.locale,
        permission_state = 'granted',
        is_active = true,
        last_seen_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
  returning * into subscription_row;

  return subscription_row;
end;
$$;

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
  v_current_user_id uuid := auth.uid();
  preference_row public.notification_preferences;
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.notification_preferences
  set locale = coalesce(nullif(trim(p_locale), ''), locale),
      email_enabled = p_email_enabled,
      push_enabled = p_push_enabled,
      in_app_enabled = p_in_app_enabled,
      quiet_hours_json = coalesce(p_quiet_hours_json, '{}'::jsonb),
      updated_at = timezone('utc', now())
  where user_id = v_current_user_id
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
      v_current_user_id,
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
  v_current_user_id uuid := auth.uid();
  inserted_notification public.notifications;
  in_app_delivery_id uuid;
  can_send boolean := false;
begin
  if v_current_user_id is null then
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
    v_current_user_id = p_recipient_user_id
    and (
      p_tenant_id is null
      or exists(
        select 1
        from public.memberships m
        where m.user_id = v_current_user_id
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
  v_current_user_id uuid := auth.uid();
  delivery_row public.notification_deliveries;
begin
  if v_current_user_id is null then
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
          n.recipient_user_id = v_current_user_id
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
  v_current_user_id uuid := auth.uid();
  notification_row public.notifications;
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_notification_id
    and recipient_user_id = v_current_user_id
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
  v_current_user_id uuid := auth.uid();
  notification_row public.notifications;
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
  set clicked_at = coalesce(clicked_at, timezone('utc', now())),
      read_at = coalesce(read_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_notification_id
    and recipient_user_id = v_current_user_id
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

create or replace function public.platform_ops_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_platform_permission('platform_dashboard:read')
    or public.has_platform_permission('plan:read')
  ) then
    raise exception 'Not enough permissions to read platform operations';
  end if;

  return jsonb_build_object(
    'activeTenants', (select count(*) from public.tenants where status = 'active'),
    'openModerationCases', (select count(*) from public.moderation_cases where status in ('open', 'under_review')),
    'pendingRecruiterRequests', (select count(*) from public.recruiter_requests where status in ('submitted', 'under_review')),
    'activeSubscriptions', (select count(*) from public.tenant_subscriptions where status in ('trialing', 'active', 'past_due')),
    'pendingEmailHooks', (select count(*) from public.notification_deliveries where channel = 'email' and delivery_status = 'pending'),
    'featureFlagsEnabled', (select count(*) from public.feature_flags where is_enabled = true)
  );
end;
$$;

create or replace function public.get_tenant_plan_snapshot(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_platform_permission('plan:read')
    or public.is_tenant_member(p_tenant_id)
  ) then
    raise exception 'Not enough permissions to read this plan snapshot';
  end if;

  return (
    select jsonb_build_object(
      'tenantId', ts.tenant_id,
      'planCode', sp.code,
      'planName', sp.name,
      'subscriptionStatus', ts.status,
      'seatCount', ts.seat_count,
      'limits', sp.limits_json,
      'usage', jsonb_build_object(
        'publishedJobs', (select count(*) from public.job_postings jp where jp.tenant_id = ts.tenant_id and jp.status = 'published'),
        'members', (select count(*) from public.memberships m where m.tenant_id = ts.tenant_id and m.status = 'active')
      )
    )
    from public.tenant_subscriptions ts
    join public.subscription_plans sp on sp.id = ts.plan_id
    where ts.tenant_id = p_tenant_id
      and ts.status in ('trialing', 'active', 'past_due')
    order by ts.created_at desc
    limit 1
  );
end;
$$;

create or replace function public.open_moderation_case(
  p_entity_type text,
  p_entity_id uuid,
  p_tenant_id uuid default null,
  p_reason text default '',
  p_severity text default 'medium',
  p_metadata jsonb default '{}'::jsonb
)
returns public.moderation_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  case_row public.moderation_cases;
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_platform_permission('moderation:act')
  ) then
    raise exception 'Not enough permissions to open moderation cases';
  end if;

  insert into public.moderation_cases (
    entity_type,
    entity_id,
    tenant_id,
    status,
    severity,
    reason,
    opened_by_user_id,
    metadata
  )
  values (
    trim(p_entity_type),
    p_entity_id,
    p_tenant_id,
    'open',
    p_severity,
    trim(coalesce(p_reason, '')),
    v_current_user_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into case_row;

  insert into public.moderation_actions (
    moderation_case_id,
    action_type,
    actor_user_id,
    note,
    payload
  )
  values (
    case_row.id,
    'note',
    v_current_user_id,
    'Case opened',
    jsonb_build_object('source', 'open_moderation_case')
  );

  return case_row;
end;
$$;

create or replace function public.apply_moderation_action(
  p_case_id uuid,
  p_action_type public.moderation_action_type,
  p_note text default null
)
returns public.moderation_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  case_row public.moderation_cases;
  updated_case public.moderation_cases;
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_platform_permission('moderation:act')
  ) then
    raise exception 'Not enough permissions to act on moderation cases';
  end if;

  select *
  into case_row
  from public.moderation_cases
  where id = p_case_id;

  if not found then
    raise exception 'Moderation case not found';
  end if;

  if p_action_type = 'close_job' and case_row.entity_type = 'job_posting' then
    update public.job_postings
    set status = 'closed',
        closed_at = coalesce(closed_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
    where id = case_row.entity_id;
  elsif p_action_type = 'suspend_tenant' and case_row.entity_type = 'tenant' then
    update public.tenants
    set status = 'suspended',
        updated_at = timezone('utc', now())
    where id = case_row.entity_id;
  elsif p_action_type = 'restore_tenant' and case_row.entity_type = 'tenant' then
    update public.tenants
    set status = 'active',
        updated_at = timezone('utc', now())
    where id = case_row.entity_id;
  end if;

  update public.moderation_cases
  set
    status = case
      when p_action_type = 'dismiss_case' then 'dismissed'
      when p_action_type in ('close_job', 'suspend_tenant', 'restore_tenant', 'warn') then 'resolved'
      else 'under_review'
    end,
    resolved_at = case
      when p_action_type in ('close_job', 'suspend_tenant', 'restore_tenant', 'warn', 'dismiss_case')
        then timezone('utc', now())
      else resolved_at
    end,
    resolved_by_user_id = case
      when p_action_type in ('close_job', 'suspend_tenant', 'restore_tenant', 'warn', 'dismiss_case')
        then v_current_user_id
      else resolved_by_user_id
    end,
    updated_at = timezone('utc', now())
  where id = case_row.id
  returning * into updated_case;

  insert into public.moderation_actions (
    moderation_case_id,
    action_type,
    actor_user_id,
    note,
    payload
  )
  values (
    updated_case.id,
    p_action_type,
    v_current_user_id,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object('entity_type', updated_case.entity_type, 'entity_id', updated_case.entity_id)
  );

  return updated_case;
end;
$$;
