-- ─────────────────────────────────────────────────────────────────────────────
-- P1 — Reparación de cuatro RPC rotas en producción (auditoría 2026-07-29).
--
-- `supabase db lint --linked` las reporta con error, no con advertencia: fallan
-- en tiempo de ejecución, no en compilación, así que el fallo solo aparece
-- cuando un usuario ejecuta la acción.
--
--   TASK-262 invite_tenant_member            42804 status/membership_status
--   TASK-263 review_pastor_authority_request 42804 scope_type/authority_scope_type
--   TASK-264 apply_moderation_action         42804 status/moderation_case_status
--   TASK-265 queue_push_notification         42702 push_subscription_id ambiguo
--
-- Los tres primeros comparten la misma causa: una expresión `case` produce
-- `text` y se asigna a una columna de tipo enum sin castear. El cuarto es una
-- colisión entre el parámetro OUT `push_subscription_id` (del `RETURNS TABLE`)
-- y la columna homónima dentro de un `RETURNING`.
--
-- Los cuerpos se reproducen tal cual están en el remoto, con el cast o la
-- calificación como único cambio; no se altera ninguna otra lógica.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── invite_tenant_member ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invite_tenant_member(p_tenant_id uuid, p_email text, p_role_id uuid DEFAULT NULL::uuid)
 RETURNS memberships
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_user public.users;
  v_membership public.memberships;
  v_existing_membership public.memberships;
  v_role public.tenant_roles;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_permission(p_tenant_id, 'member:invite')
  ) then
    raise exception 'Not enough permissions to invite members into this tenant';
  end if;

  select *
  into v_user
  from public.users
  where lower(email) = lower(trim(coalesce(p_email, '')))
  limit 1;

  if v_user.id is null then
    raise exception 'The invited email must belong to a registered platform user before it can join a workspace';
  end if;

  if p_role_id is not null then
    if not (
      public.is_platform_admin()
      or public.has_tenant_permission(p_tenant_id, 'role:assign')
    ) then
      raise exception 'Not enough permissions to assign roles in this tenant';
    end if;

    select *
    into v_role
    from public.tenant_roles
    where id = p_role_id
      and (tenant_id is null or tenant_id = p_tenant_id)
    limit 1;

    if v_role.id is null then
      raise exception 'The requested role does not belong to this tenant';
    end if;
  end if;

  select *
  into v_existing_membership
  from public.memberships
  where tenant_id = p_tenant_id
    and user_id = v_user.id
  for update;

  if v_existing_membership.id is null then
    insert into public.memberships (
      tenant_id,
      user_id,
      invited_by_user_id,
      status,
      joined_at
    )
    values (
      p_tenant_id,
      v_user.id,
      v_actor_user_id,
      'invited',
      timezone('utc', now())
    )
    returning * into v_membership;
  else
    update public.memberships
    set
      invited_by_user_id = v_actor_user_id,
      status = case
        when v_existing_membership.status = 'active' then 'active'
        else 'invited'
      end::public.membership_status,
      updated_at = timezone('utc', now())
    where id = v_existing_membership.id
    returning * into v_membership;
  end if;

  if p_role_id is not null then
    update public.membership_roles
    set
      revoked_at = timezone('utc', now()),
      revoked_by_user_id = v_actor_user_id
    where membership_id = v_membership.id
      and revoked_at is null
      and role_id <> p_role_id;

    insert into public.membership_roles (
      membership_id,
      role_id,
      assigned_by_user_id,
      revoked_at,
      revoked_by_user_id
    )
    values (
      v_membership.id,
      p_role_id,
      v_actor_user_id,
      null,
      null
    )
    on conflict (membership_id, role_id) do update
    set
      assigned_at = timezone('utc', now()),
      assigned_by_user_id = excluded.assigned_by_user_id,
      revoked_at = null,
      revoked_by_user_id = null;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    tenant_id,
    event_type,
    entity_type,
    entity_id,
    payload
  )
  values (
    v_actor_user_id,
    p_tenant_id,
    'member_invited',
    'memberships',
    v_membership.id::text,
    jsonb_build_object(
      'invited_user_id', v_user.id,
      'invited_email', v_user.email,
      'status', v_membership.status,
      'role_id', p_role_id
    )
  );

  return v_membership;
end;
$function$
;

-- ── review_pastor_authority_request ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_pastor_authority_request(p_request_id uuid, p_decision review_workflow_status, p_review_notes text DEFAULT NULL::text)
 RETURNS pastor_authority_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_request public.pastor_authority_requests;
  v_scope public.user_authority_scopes;
  v_role_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_permission('pastor_authority_request:review') then
    raise exception 'Only authorized reviewers can review pastor authority requests';
  end if;

  if p_decision not in ('approved', 'rejected', 'needs_more_info') then
    raise exception 'Pastor authority requests may only be approved, rejected, or marked as needing more information';
  end if;

  select *
  into v_request
  from public.pastor_authority_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Pastor authority request not found';
  end if;

  if v_request.status not in ('submitted', 'under_review', 'needs_more_info') then
    raise exception 'Pastor authority request is not pending review';
  end if;

  if p_decision = 'approved' then
    insert into public.user_authority_scopes (
      user_id,
      authority_role,
      scope_type,
      union_id,
      association_id,
      district_id,
      church_ids,
      source_request_type,
      source_request_id,
      notes,
      granted_by_user_id
    )
    values (
      v_request.requester_user_id,
      'pastor_administrator',
      case
        when coalesce(array_length(v_request.church_ids, 1), 0) > 0 then 'church'
        else 'district'
      end::public.authority_scope_type,
      v_request.union_id,
      v_request.association_id,
      v_request.district_id,
      v_request.church_ids,
      'pastor_authority_request',
      v_request.id,
      nullif(trim(p_review_notes), ''),
      auth.uid()
    )
    on conflict do nothing
    returning * into v_scope;

    if v_scope.id is null then
      select *
      into v_scope
      from public.user_authority_scopes
      where user_id = v_request.requester_user_id
        and authority_role = 'pastor_administrator'
        and status = 'active'
        and district_id is not distinct from v_request.district_id
      order by created_at desc
      limit 1;
    end if;

    select id
    into v_role_id
    from public.platform_roles
    where code = 'pastor_administrator';

    if v_role_id is null then
      raise exception 'Pastor administrator role not found';
    end if;

    insert into public.user_platform_roles (user_id, role_id, assigned_by_user_id)
    values (v_request.requester_user_id, v_role_id, auth.uid())
    on conflict (user_id, role_id) do update
    set
      assigned_at = timezone('utc', now()),
      assigned_by_user_id = excluded.assigned_by_user_id,
      revoked_at = null,
      revoked_by_user_id = null;
  end if;

  update public.pastor_authority_requests
  set
    status = p_decision,
    review_notes = nullif(trim(p_review_notes), ''),
    reviewed_at = timezone('utc', now()),
    reviewed_by_user_id = auth.uid(),
    approved_scope_id = case when p_decision = 'approved' then v_scope.id else approved_scope_id end,
    updated_at = timezone('utc', now())
  where id = p_request_id
  returning * into v_request;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    concat('pastor_authority_request_', p_decision::text),
    'pastor_authority_requests',
    v_request.id::text,
    jsonb_build_object(
      'requester_user_id', v_request.requester_user_id,
      'approved_scope_id', v_scope.id
    )
  );

  return v_request;
end;
$function$
;

-- ── apply_moderation_action ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_moderation_action(p_case_id uuid, p_action_type moderation_action_type, p_note text DEFAULT NULL::text)
 RETURNS moderation_cases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    end::public.moderation_case_status,
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
$function$
;

-- ── queue_push_notification ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.queue_push_notification(p_recipient_user_id uuid, p_type text, p_title text, p_body text, p_action_url text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb, p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(notification_id uuid, push_delivery_id uuid, push_subscription_id uuid, subscription_endpoint text, p256dh_key text, auth_key text, subscription_locale text, notification_title text, notification_body text, notification_action_url text, notification_payload jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    returning notification_deliveries.id, notification_deliveries.push_subscription_id
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
$function$
;

