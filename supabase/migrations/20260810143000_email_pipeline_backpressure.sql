-- Defensa en profundidad del pipeline de correos.
--
-- Incidente 2026-08-10: PostgreSQL dejó de aceptar conexiones; PostgREST/Auth
-- devolvían 522 y los webhooks de Resend quedaron vivos 90-150 segundos. La
-- seguridad no puede depender del tamaño del formulario ni de mirar logs a mano:
-- los límites viven en PostgreSQL, el despachador es single-flight y el estado
-- operativo queda consultable por administradores.

create index if not exists notification_deliveries_resend_message_idx
  on public.notification_deliveries (provider_message_id)
  where channel = 'email'
    and provider_name = 'resend'
    and provider_message_id is not null;

create index if not exists notification_deliveries_email_inflight_idx
  on public.notification_deliveries (created_at)
  where channel = 'email'
    and delivery_status in ('pending', 'processing');

create table if not exists private.email_pipeline_control (
  singleton boolean primary key default true check (singleton),
  dispatch_lease_token uuid,
  dispatch_lease_until timestamptz,
  last_dispatch_started_at timestamptz,
  last_dispatch_finished_at timestamptz,
  last_queue_depth integer not null default 0,
  last_request_id bigint,
  last_error text,
  updated_at timestamptz not null default timezone('utc', now())
);

revoke all on table private.email_pipeline_control from public, anon, authenticated;

insert into private.email_pipeline_control (singleton)
values (true)
on conflict (singleton) do nothing;

create or replace function public.release_email_dispatch_lease(p_lease_token uuid)
returns boolean
language plpgsql
security definer
set search_path = private, public
as $$
begin
  update private.email_pipeline_control
  set dispatch_lease_token = null,
      dispatch_lease_until = null,
      last_dispatch_finished_at = timezone('utc', now()),
      last_error = null,
      updated_at = timezone('utc', now())
  where singleton = true
    and dispatch_lease_token = p_lease_token;

  return found;
end;
$$;

revoke all on function public.release_email_dispatch_lease(uuid) from public, anon, authenticated;
grant execute on function public.release_email_dispatch_lease(uuid) to service_role;

-- Un cron, un clic manual y otro cron no pueden abrir workers simultáneos. El
-- lease se libera al terminar la Edge Function; si esta muere, vence solo.
create or replace function private.dispatch_membership_emails()
returns void
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_url text;
  v_anon text;
  v_secret text;
  v_pending integer;
  v_lease_token uuid;
  v_request_id bigint;
  v_now timestamptz := timezone('utc', now());
begin
  select count(*)
  into v_pending
  from (
    select 1
    from public.notification_deliveries
    where channel = 'email'
      and delivery_status = 'pending'
    limit 501
  ) pending_sample;

  if coalesce(v_pending, 0) = 0 then
    return;
  end if;

  select value into v_url from private.runtime_secrets where key = 'email_dispatch_url';
  select value into v_anon from private.runtime_secrets where key = 'email_dispatch_anon_key';
  select value into v_secret from private.runtime_secrets where key = 'email_processor_secret';

  if v_url is null or v_secret is null then
    update private.email_pipeline_control
    set last_queue_depth = v_pending,
        last_error = 'email_dispatch_not_configured',
        updated_at = v_now
    where singleton = true;
    return;
  end if;

  update private.email_pipeline_control
  set dispatch_lease_token = extensions.gen_random_uuid(),
      dispatch_lease_until = v_now + interval '5 minutes',
      last_dispatch_started_at = v_now,
      last_queue_depth = v_pending,
      last_error = null,
      updated_at = v_now
  where singleton = true
    and (dispatch_lease_until is null or dispatch_lease_until <= v_now)
  returning dispatch_lease_token into v_lease_token;

  if v_lease_token is null then
    return;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_anon, ''),
      'x-email-processor-secret', v_secret
    ),
    body := jsonb_build_object('leaseToken', v_lease_token),
    timeout_milliseconds := 10000
  ) into v_request_id;

  update private.email_pipeline_control
  set last_request_id = v_request_id,
      updated_at = timezone('utc', now())
  where singleton = true
    and dispatch_lease_token = v_lease_token;
exception
  when others then
    update private.email_pipeline_control
    set dispatch_lease_token = null,
        dispatch_lease_until = null,
        last_error = left(sqlstate || ': ' || sqlerrm, 500),
        updated_at = timezone('utc', now())
    where singleton = true
      and dispatch_lease_token = v_lease_token;
    raise;
end;
$$;

create or replace function public.email_pipeline_guard_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_pending integer;
  v_processing integer;
  v_oldest_pending timestamptz;
  v_control private.email_pipeline_control%rowtype;
begin
  if not public.has_platform_permission('email:read') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  select
    count(*) filter (where delivery_status = 'pending'),
    count(*) filter (where delivery_status = 'processing'),
    min(created_at) filter (where delivery_status = 'pending')
  into v_pending, v_processing, v_oldest_pending
  from public.notification_deliveries
  where channel = 'email'
    and delivery_status in ('pending', 'processing');

  select * into v_control
  from private.email_pipeline_control
  where singleton = true;

  return jsonb_build_object(
    'pending', coalesce(v_pending, 0),
    'processing', coalesce(v_processing, 0),
    'oldestPendingAt', v_oldest_pending,
    'queueCapacity', 500,
    'maxBroadcastRecipients', 200,
    'broadcastCooldownMinutes', 10,
    'dispatchLeaseUntil', v_control.dispatch_lease_until,
    'lastDispatchStartedAt', v_control.last_dispatch_started_at,
    'lastDispatchFinishedAt', v_control.last_dispatch_finished_at,
    'lastQueueDepth', v_control.last_queue_depth,
    'lastError', v_control.last_error,
    'saturated', coalesce(v_pending, 0) + coalesce(v_processing, 0) >= 500
  );
end;
$$;

revoke all on function public.email_pipeline_guard_status() from public, anon;
grant execute on function public.email_pipeline_guard_status() to authenticated;

create or replace function public.email_broadcast_enqueue(
  p_name text,
  p_subject text,
  p_body text,
  p_emails text[],
  p_is_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_broadcast_recipients constant integer := 200;
  v_queue_capacity constant integer := 500;
  v_broadcast_cooldown constant interval := interval '10 minutes';
  v_broadcast_id uuid;
  v_normalizados text[];
  v_requested integer;
  v_validos integer;
  v_unicos integer;
  v_duplicados integer;
  v_suprimidos integer;
  v_encolados integer := 0;
  v_queue_depth integer;
  v_last_broadcast_at timestamptz;
begin
  if not (select public.has_platform_permission('email:broadcast')) then
    raise exception 'Insufficient permission to send email broadcasts'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(nullif(trim(p_name), ''), '') = ''
     or coalesce(nullif(trim(p_subject), ''), '') = ''
     or coalesce(nullif(trim(p_body), ''), '') = '' then
    raise exception 'La campaña necesita nombre, asunto y cuerpo';
  end if;

  v_requested := coalesce(array_length(p_emails, 1), 0);
  if v_requested = 0 then
    raise exception 'La campaña no tiene destinatarios';
  end if;

  -- Se rechaza antes de UNNEST: una entrada enorme no puede consumir memoria y
  -- CPU para luego descubrir que excedía el límite.
  if v_requested > v_max_broadcast_recipients then
    raise exception 'EMAIL_BROADCAST_LIMIT: máximo % destinatarios por campaña; recibidos %',
      v_max_broadcast_recipients, v_requested;
  end if;

  -- Serializa la decisión de cupo; dos admins no pueden observar el mismo
  -- espacio libre y llenarlo simultáneamente.
  perform pg_advisory_xact_lock(hashtextextended('email_pipeline_enqueue', 0));

  select max(created_at) into v_last_broadcast_at
  from public.email_broadcasts;

  if v_last_broadcast_at is not null
     and v_last_broadcast_at > timezone('utc', now()) - v_broadcast_cooldown then
    raise exception 'EMAIL_BROADCAST_RATE_LIMITED: espere 10 minutos entre campañas';
  end if;

  select count(*) into v_validos
  from unnest(p_emails) as e
  where trim(e) <> ''
    and lower(trim(e)) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  select coalesce(array_agg(distinct lower(trim(e))), '{}')
  into v_normalizados
  from unnest(p_emails) as e
  where trim(e) <> ''
    and lower(trim(e)) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  v_unicos := coalesce(array_length(v_normalizados, 1), 0);
  v_duplicados := greatest(v_validos - v_unicos, 0);

  select count(*) into v_suprimidos
  from unnest(v_normalizados) as t(email)
  join public.email_suppressions s on s.email = t.email;

  if v_unicos - v_suprimidos <= 0 then
    raise exception 'La campaña no tiene destinatarios enviables';
  end if;

  select count(*)
  into v_queue_depth
  from (
    select 1
    from public.notification_deliveries
    where channel = 'email'
      and delivery_status in ('pending', 'processing')
    limit 501
  ) inflight_sample;

  if v_queue_depth + (v_unicos - v_suprimidos) > v_queue_capacity then
    raise exception 'EMAIL_PIPELINE_BACKPRESSURE: cola % + campaña % supera capacidad %',
      v_queue_depth, (v_unicos - v_suprimidos), v_queue_capacity;
  end if;

  insert into public.email_broadcasts (
    name, subject, body, created_by_user_id, is_test,
    total_requested, total_suppressed, total_duplicated
  ) values (
    trim(p_name), trim(p_subject), p_body, (select auth.uid()), coalesce(p_is_test, false),
    v_requested, v_suprimidos, v_duplicados
  ) returning id into v_broadcast_id;

  with destinatarios as (
    select e.email
    from unnest(v_normalizados) as e(email)
    left join public.email_suppressions s on s.email = e.email
    where s.email is null
  ),
  creadas as (
    insert into public.notifications (
      recipient_user_id, type, title, body, action_url, payload, is_test
    )
    select
      u.id,
      'email.broadcast',
      trim(p_subject),
      p_body,
      null,
      jsonb_build_object(
        'to', d.email,
        'broadcast_id', v_broadcast_id,
        'unsubscribe_token', extensions.gen_random_uuid()
      ),
      coalesce(p_is_test, false)
    from destinatarios d
    left join public.users u on lower(u.email) = d.email
    returning id
  )
  insert into public.notification_deliveries (
    notification_id, channel, delivery_status, provider_name, is_test
  )
  select c.id, 'email', 'pending', 'resend', coalesce(p_is_test, false)
  from creadas c;

  get diagnostics v_encolados = row_count;

  update public.email_broadcasts
  set total_queued = v_encolados
  where id = v_broadcast_id;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    (select auth.uid()), 'email.broadcast_enqueued', 'email_broadcast', v_broadcast_id::text,
    jsonb_build_object(
      'name', trim(p_name),
      'is_test', coalesce(p_is_test, false),
      'requested', v_requested,
      'queued', v_encolados,
      'queueDepthBefore', v_queue_depth,
      'queueCapacity', v_queue_capacity,
      'suppressed', v_suprimidos
    )
  );

  return jsonb_build_object(
    'broadcastId', v_broadcast_id,
    'requested', v_requested,
    'queued', v_encolados,
    'suppressed', v_suprimidos,
    'duplicated', v_duplicados,
    'invalid', greatest(v_requested - v_validos, 0),
    'queueDepthAfter', v_queue_depth + v_encolados,
    'queueCapacity', v_queue_capacity
  );
end;
$$;

revoke all on function public.email_broadcast_enqueue(text, text, text, text[], boolean)
  from public, anon;
grant execute on function public.email_broadcast_enqueue(text, text, text, text[], boolean)
  to authenticated;
