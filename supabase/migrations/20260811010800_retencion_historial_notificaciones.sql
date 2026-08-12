-- Retención del historial de notificaciones y correos (R-153, cláusula «acumular»).
--
-- Las cuatro tablas por donde pasa el envío masivo crecían sin techo:
-- `notification_deliveries`, `notification_delivery_logs`, `email_delivery_events`
-- y `email_broadcasts`. A ritmo máximo del backpressure (200 destinatarios × 6
-- campañas/hora) son ~28.800 entregas al día, cada una con su log y entre 2 y 9
-- eventos de proveedor. El repo ya purga `app_error_logs`, `user_access_logs` y
-- archiva `audit_logs`; esta rama se quedó fuera.
--
-- ── Por qué esto toca también `notifications` y los tokens de baja ───────────
--
-- `notification_deliveries` cuelga de `notifications` una a una: purgar solo la
-- hija deja la madre creciendo al mismo ritmo, así que el techo sería falso.
--
-- Pero purgar `notifications` a secas rompe algo que no se ve: `email_unsubscribe`
-- resuelve el token del enlace de baja leyendo `notifications.payload`. Un correo
-- vive en la bandeja de entrada durante años, y quien pulsa «darme de baja» ocho
-- meses después recibiría `false` — el mismo valor que un token falso, porque esa
-- respuesta se hizo indistinguible a propósito para no ser un oráculo de tokens.
-- La persona pide no recibir, cree que lo hizo, y sigue recibiendo.
--
-- Por eso el token deja de vivir en la fila voluminosa y pasa a un registro
-- propio, diminuto y permanente. Recién entonces `notifications` es purgable.

-- ── A. Registro durable de tokens de baja ────────────────────────────────────

create table if not exists public.email_unsubscribe_tokens (
  token uuid primary key,
  email text not null,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.email_unsubscribe_tokens is
  'Token de baja → dirección. Sobrevive a la purga de notifications porque el enlace de un correo se pulsa meses después de enviarlo.';

create index if not exists email_unsubscribe_tokens_email_idx
  on public.email_unsubscribe_tokens (email);

alter table public.email_unsubscribe_tokens enable row level security;

-- Sin políticas y sin grants: solo la alcanza `email_unsubscribe`, que es
-- `security definer`. Exponerla por PostgREST la convertiría en un listado de
-- direcciones y en un oráculo de tokens válidos.
revoke all on table public.email_unsubscribe_tokens from public, anon, authenticated;

-- Backfill de todo lo ya enviado: sin esto, los enlaces que hoy están en la
-- bandeja de entrada de alguien dejarían de funcionar en cuanto purgáramos.
insert into public.email_unsubscribe_tokens (token, email, created_at)
select
  (n.payload ->> 'unsubscribe_token')::uuid,
  lower(n.payload ->> 'to'),
  n.created_at
from public.notifications n
where n.payload ? 'unsubscribe_token'
  and n.payload ->> 'to' is not null
  and (n.payload ->> 'unsubscribe_token') ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (token) do nothing;

-- ── B. La baja lee del registro ──────────────────────────────────────────────

create or replace function public.email_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select t.email into v_email
  from public.email_unsubscribe_tokens t
  where t.token = p_token;

  if v_email is null then
    -- Reserva: una campaña encolada por una versión anterior de
    -- `email_broadcast_enqueue` pudo escribir el token solo en la notificación.
    -- Cuesta una consulta únicamente cuando el registro falla, y la alternativa
    -- es dejar suscrita a una persona que pidió no estarlo.
    select lower(n.payload ->> 'to') into v_email
    from public.notifications n
    where n.payload ->> 'unsubscribe_token' = p_token::text
    limit 1;
  end if;

  if v_email is null then
    -- Token desconocido o ya caducado. Se responde igual que en el caso bueno:
    -- distinguirlos convertiría esto en un oráculo de tokens válidos.
    return false;
  end if;

  insert into public.email_suppressions (email, reason, source)
  values (lower(v_email), 'unsubscribed', 'public_link')
  on conflict (email) do nothing;

  return true;
end;
$$;

revoke all on function public.email_unsubscribe(uuid) from public;
grant execute on function public.email_unsubscribe(uuid) to anon, authenticated;

-- ── C. Encolar registra el token ─────────────────────────────────────────────
-- Igual que la versión anterior salvo el CTE `tokens`: el token se guarda en el
-- registro dentro de la misma sentencia que crea la notificación, así que no
-- existe un instante en el que un correo salga con un enlace no resoluble.

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
    returning id, payload
  ),
  tokens as (
    -- El token se hace durable en la misma sentencia que lo crea: el correo no
    -- puede salir con un enlace que el registro todavía no conozca.
    insert into public.email_unsubscribe_tokens (token, email)
    select (c.payload ->> 'unsubscribe_token')::uuid, c.payload ->> 'to'
    from creadas c
    on conflict (token) do nothing
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

-- ── D. La purga ──────────────────────────────────────────────────────────────
--
-- Cinco niveles, del detalle al resumen. Se borra de hija a madre aunque el
-- CASCADE bastaría: así cada nivel tiene su propio plazo y su propia cuenta.
--
-- Dos guardas que no se pueden relajar:
--   · Nada vivo se toca. Una entrega `pending`/`processing` está en la cola;
--     borrarla perdería un correo que aún no ha salido.
--   · Los eventos de rebote y queja duran mucho más que el resto. Hoy son la
--     única evidencia de reputación de envío que existe: `email_suppressions`
--     solo la escribe el enlace de baja, no el webhook del proveedor.

create or replace function private.purge_notification_history(
  p_logs_days integer default 90,
  p_events_days integer default 180,
  p_reputation_days integer default 730,
  p_deliveries_days integer default 365,
  p_broadcasts_days integer default 730
)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_logs integer;
  v_events integer;
  v_deliveries integer;
  v_notifications integer;
  v_broadcasts integer;
  v_now timestamptz := timezone('utc', now());
begin
  -- Los plazos tienen suelo: un argumento a 0 vaciaría el historial entero.
  delete from public.notification_delivery_logs
  where created_at < v_now - make_interval(days => greatest(coalesce(p_logs_days, 90), 7));
  get diagnostics v_logs = row_count;

  delete from public.email_delivery_events
  where created_at < v_now - make_interval(
    days => case
      when event_type in ('email.bounced', 'email.complained', 'email.failed', 'email.suppressed')
        then greatest(coalesce(p_reputation_days, 730), 90)
      else greatest(coalesce(p_events_days, 180), 30)
    end
  );
  get diagnostics v_events = row_count;

  delete from public.notification_deliveries
  where created_at < v_now - make_interval(days => greatest(coalesce(p_deliveries_days, 365), 30))
    and delivery_status not in ('pending', 'processing');
  get diagnostics v_deliveries = row_count;

  -- La notificación se va detrás de su entrega, no antes: si le queda una viva,
  -- el CASCADE se llevaría por delante un correo que sigue en la cola.
  delete from public.notifications n
  where n.created_at < v_now - make_interval(days => greatest(coalesce(p_deliveries_days, 365), 30))
    and not exists (
      select 1
      from public.notification_deliveries d
      where d.notification_id = n.id
        and d.delivery_status in ('pending', 'processing')
    );
  get diagnostics v_notifications = row_count;

  delete from public.email_broadcasts
  where created_at < v_now - make_interval(days => greatest(coalesce(p_broadcasts_days, 730), 90));
  get diagnostics v_broadcasts = row_count;

  return jsonb_build_object(
    'deliveryLogs', v_logs,
    'providerEvents', v_events,
    'deliveries', v_deliveries,
    'notifications', v_notifications,
    'broadcasts', v_broadcasts,
    'ranAt', v_now
  );
end;
$$;

comment on function private.purge_notification_history(integer, integer, integer, integer, integer) is
  'Retención del historial de notificaciones y correo. No toca entregas vivas y conserva los eventos de reputación mucho más tiempo.';

revoke all on function private.purge_notification_history(integer, integer, integer, integer, integer)
  from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('purge-notification-history');
exception
  when others then null;
end;
$$;

-- 04:00 UTC, después de las purgas ya existentes (03:17, 03:30, 03:40, 03:50).
select cron.schedule(
  'purge-notification-history',
  '0 4 * * *',
  $cron$select private.purge_notification_history();$cron$
);
