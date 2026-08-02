-- ─────────────────────────────────────────────────────────────────────────────
-- TASK-259 (afinado de 20260802150000).
--
-- La prueba de abuso encontró un hueco en la guarda: contaba cualquier frame
-- PL/pgSQL como "llamador legítimo", y un bloque DO anónimo produce un frame
-- (`inline_code_block`). Es decir, `do $$ begin perform
-- system_create_notification(...); end $$;` pasaba la guarda.
--
-- No es explotable desde el cliente — PostgREST invoca la función como sentencia
-- de nivel superior y no permite enviar bloques DO, y quien pueda ejecutar SQL
-- arbitrario ya podría insertar en `notifications` directamente. Pero el frame
-- anónimo no acredita nada: el uso legítimo siempre viene de una función con
-- nombre (un trigger o una RPC de negocio). Se excluyen del conteo.
--
-- Efecto lateral útil: la prueba de abuso puede ejercitar la guarda desde un
-- bloque DO y obtener el mismo veredicto que una llamada real de PostgREST.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function private.notification_caller_is_trusted(p_stack text)
returns boolean
language sql
immutable
as $$
  -- Frames de funciones PL/pgSQL con nombre, descontando los bloques DO
  -- anónimos y el frame de la propia función que consulta la pila.
  select (
    (array_length(string_to_array(p_stack, 'PL/pgSQL function'), 1) - 1)
    - (array_length(string_to_array(p_stack, 'PL/pgSQL function inline_code_block'), 1) - 1)
  ) > 1;
$$;

revoke all on function private.notification_caller_is_trusted(text) from public, anon, authenticated;

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
  v_role text;
  v_stack text;
  v_type text;
  v_title text;
  v_body text;
  v_action_url text;
  v_payload jsonb;
begin
  -- ── Autorización ───────────────────────────────────────────────────────────
  -- El uso legítimo es siempre desde un trigger u otra función SECURITY DEFINER.
  -- Una llamada directa (RPC de PostgREST) deja un solo frame con nombre.
  get diagnostics v_stack = pg_context;

  -- auth.role() refleja el claim del JWT vía PostgREST; en conexiones directas
  -- (cron, psql de mantenimiento) cae a session_user.
  v_role := coalesce(nullif(auth.role(), ''), session_user::text);

  if not private.notification_caller_is_trusted(v_stack)
     and v_role not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception
      'system_create_notification solo puede invocarse desde el servidor o desde otra función (rol recibido: %)', v_role
      using errcode = 'insufficient_privilege';
  end if;

  -- ── Destinatario ───────────────────────────────────────────────────────────
  -- La columna admite NULL por los comprobantes de donación anónima, pero esos
  -- se insertan en `notifications` directamente. Por esta vía siempre hay una
  -- persona concreta a la que notificar.
  if p_recipient_user_id is null then
    raise exception 'system_create_notification exige un destinatario'
      using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.users u where u.id = p_recipient_user_id) then
    raise exception 'system_create_notification: el destinatario % no existe', p_recipient_user_id
      using errcode = 'check_violation';
  end if;

  if p_tenant_id is not null
     and not exists (select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception 'system_create_notification: el tenant % no existe', p_tenant_id
      using errcode = 'check_violation';
  end if;

  -- ── Contenido ──────────────────────────────────────────────────────────────
  v_type := nullif(trim(coalesce(p_type, '')), '');
  v_title := nullif(trim(coalesce(p_title, '')), '');
  v_body := nullif(trim(coalesce(p_body, '')), '');
  v_action_url := nullif(trim(coalesce(p_action_url, '')), '');
  v_payload := coalesce(p_payload, '{}'::jsonb);

  if v_type is null or v_title is null or v_body is null then
    raise exception 'system_create_notification exige type, title y body no vacíos'
      using errcode = 'check_violation';
  end if;

  -- Los tipos son identificadores de evento, no texto libre.
  if v_type !~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$' or length(v_type) > 100 then
    raise exception 'system_create_notification: type inválido (%)', v_type
      using errcode = 'check_violation';
  end if;

  if length(v_title) > 200 or length(v_body) > 4000 then
    raise exception 'system_create_notification: title o body exceden el límite (200 / 4000)'
      using errcode = 'check_violation';
  end if;

  -- action_url es siempre una ruta interna de la app. Se rechazan absolutas y
  -- protocolo-relativas (`//host`, `/\host`), que llevarían al usuario fuera del
  -- sitio desde una notificación con la marca de ASI.
  if v_action_url is not null then
    if length(v_action_url) > 500
       or v_action_url !~ '^/'
       or v_action_url ~ '^//'
       or v_action_url ~ '^/\\'
       or v_action_url ~ '[[:cntrl:]]' then
      raise exception 'system_create_notification: action_url debe ser una ruta interna (%)', v_action_url
        using errcode = 'check_violation';
    end if;
  end if;

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'system_create_notification: payload debe ser un objeto JSON'
      using errcode = 'check_violation';
  end if;

  -- Claves reservadas del despachador de correo: permitirlas aquí convertiría
  -- la RPC en un relay hacia direcciones arbitrarias.
  if v_payload ?| array['to', 'cc', 'bcc', 'replyTo', 'recipientName'] then
    raise exception 'system_create_notification: el payload no puede redirigir el destinatario del correo'
      using errcode = 'check_violation';
  end if;

  if length(v_payload::text) > 8192 then
    raise exception 'system_create_notification: payload demasiado grande (% bytes, máx 8192)', length(v_payload::text)
      using errcode = 'check_violation';
  end if;

  -- ── Cuerpo original ────────────────────────────────────────────────────────
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
    v_type,
    v_title,
    v_body,
    v_action_url,
    v_payload
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

revoke all on function public.system_create_notification(uuid, text, text, text, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.system_create_notification(uuid, text, text, text, text, jsonb, uuid)
  to service_role;

create or replace function public.notify_membership_admins(
  p_type text,
  p_title text,
  p_body text,
  p_action_url text default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_role text;
  v_stack text;
begin
  get diagnostics v_stack = pg_context;

  v_role := coalesce(nullif(auth.role(), ''), session_user::text);

  if not private.notification_caller_is_trusted(v_stack)
     and v_role not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception
      'notify_membership_admins solo puede invocarse desde el servidor o desde otra función (rol recibido: %)', v_role
      using errcode = 'insufficient_privilege';
  end if;

  for v_admin in
    select distinct upr.user_id
    from public.user_platform_roles upr
    join public.platform_roles pr on pr.id = upr.role_id
    where upr.revoked_at is null
      and pr.code in ('platform_owner', 'platform_admin')
  loop
    -- No notificar al propio actor (p. ej. un admin subiendo comprobante).
    if v_admin is not null
       and v_admin <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
      perform public.system_create_notification(
        v_admin, p_type, p_title, p_body, p_action_url, p_payload, null
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.notify_membership_admins(text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.notify_membership_admins(text, text, text, text, jsonb)
  to service_role;
