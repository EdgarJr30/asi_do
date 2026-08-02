-- ─────────────────────────────────────────────────────────────────────────────
-- P0 TASK-266 — Claim atómico e idempotencia del envío de correo.
--
-- `process-email-deliveries` seleccionaba los pendientes con un SELECT normal y
-- después iteraba enviando. Sin reserva, dos ejecuciones concurrentes (el cron
-- de cada minuto y una invocación manual vía trigger_email_dispatch) leen el
-- mismo conjunto y envían el mismo correo dos veces.
--
-- Cuatro defectos, no uno:
--   1. Sin reserva atómica: el SELECT no excluye a otros workers.
--   2. `incrementAttemptCount` era read-then-write sin guarda de estado, así que
--      además de perder incrementos marcaba 'processing' DESPUÉS de la lectura,
--      demasiado tarde para frenar al segundo worker.
--   3. Sin idempotency key hacia el proveedor: un timeout de red reenvía.
--   4. Sin recuperación de lease: si un worker moría en 'processing', la fila
--      quedaba atascada para siempre y nadie la reintentaba.
--
-- ── Sobre la idempotency key ────────────────────────────────────────────────
-- No puede ser el id de la entrega. `email_resend_delivery` **reutiliza la misma
-- fila** (la devuelve a 'pending'), así que una clave fija haría que el reenvío
-- deliberado del admin fuese descartado por la deduplicación del proveedor
-- durante su ventana de 24 h.
--
-- La clave vive en su propia columna y se regenera **solo** cuando alguien pide
-- un envío lógicamente nuevo. Un reintento automático (recuperación de lease)
-- conserva la clave y el proveedor deduplica; un reenvío del admin recibe clave
-- nueva y sale de verdad. Esa es justo la semántica que se quiere.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Columnas de reserva e idempotencia ────────────────────────────────────

alter table public.notification_deliveries
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_token uuid,
  add column if not exists idempotency_key uuid not null default gen_random_uuid();

comment on column public.notification_deliveries.claimed_at is
  'Inicio del lease de la reserva actual. Si vence, otro worker puede reclamar la fila.';
comment on column public.notification_deliveries.claim_token is
  'Identifica la reserva viva. Un worker zombi no puede escribir el resultado si el token ya cambió.';
comment on column public.notification_deliveries.idempotency_key is
  'Clave enviada al proveedor. Estable entre reintentos automáticos; se regenera en un reenvío deliberado.';

-- Índice de la consulta de reserva: solo filas reclamables de email.
create index if not exists notification_deliveries_email_claimable_idx
  on public.notification_deliveries (created_at)
  where channel = 'email' and delivery_status in ('pending', 'processing');

-- ── 2. Reserva atómica ───────────────────────────────────────────────────────
-- `for update skip locked` es lo que impide que dos workers tomen la misma fila:
-- el segundo salta las filas ya bloqueadas en vez de esperarlas.

create or replace function public.claim_email_deliveries(
  p_limit integer default 20,
  p_lease_seconds integer default 300,
  p_max_attempts integer default 5
)
returns table (
  delivery_id uuid,
  claim_token uuid,
  idempotency_key uuid,
  attempt_count integer,
  notification_id uuid,
  notification_type text,
  title text,
  body text,
  action_url text,
  payload jsonb,
  recipient_email text,
  recipient_display_name text,
  recipient_full_name text
)
language plpgsql
security definer
set search_path = public
as $$
-- Los parámetros OUT (claim_token, title, payload, ...) comparten nombre con
-- columnas de las tablas consultadas. Resolver a favor de la columna evita la
-- ambigüedad 42702 que rompía queue_push_notification (TASK-265).
#variable_conflict use_column
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_lease interval := make_interval(secs => greatest(coalesce(p_lease_seconds, 300), 30));
begin
  -- Agotadas: se cierran como fallidas en lugar de reclamarse indefinidamente,
  -- para que un mensaje envenenado no ocupe el worker en cada ciclo.
  update public.notification_deliveries d
  set delivery_status = 'failed',
      failed_at = coalesce(d.failed_at, timezone('utc', now())),
      claim_token = null,
      claimed_at = null,
      updated_at = timezone('utc', now())
  where d.channel = 'email'
    and d.delivery_status = 'processing'
    and d.claimed_at is not null
    and d.claimed_at < timezone('utc', now()) - v_lease
    and d.attempt_count >= greatest(coalesce(p_max_attempts, 5), 1);

  return query
  with claimable as (
    select d.id
    from public.notification_deliveries d
    where d.channel = 'email'
      and d.attempt_count < greatest(coalesce(p_max_attempts, 5), 1)
      and (
        d.delivery_status = 'pending'
        -- Recuperación de lease: el worker anterior murió sin cerrar la fila.
        or (
          d.delivery_status = 'processing'
          and d.claimed_at is not null
          and d.claimed_at < timezone('utc', now()) - v_lease
        )
      )
    order by d.created_at
    limit v_limit
    for update skip locked
  ),
  claimed as (
    update public.notification_deliveries d
    set delivery_status = 'processing',
        claimed_at = timezone('utc', now()),
        claim_token = gen_random_uuid(),
        attempt_count = d.attempt_count + 1,
        last_attempt_at = timezone('utc', now()),
        provider_name = 'resend',
        updated_at = timezone('utc', now())
    from claimable c
    where d.id = c.id
    returning d.id, d.claim_token, d.idempotency_key, d.attempt_count, d.notification_id
  )
  select
    cl.id,
    cl.claim_token,
    cl.idempotency_key,
    cl.attempt_count,
    cl.notification_id,
    n.type,
    n.title,
    n.body,
    n.action_url,
    n.payload,
    u.email,
    u.display_name,
    u.full_name
  from claimed cl
  join public.notifications n on n.id = cl.notification_id
  left join public.users u on u.id = n.recipient_user_id;
end;
$$;

revoke all on function public.claim_email_deliveries(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_email_deliveries(integer, integer, integer) to service_role;

-- ── 3. Cierre de la reserva ──────────────────────────────────────────────────
-- El token es la guarda: si el lease venció y otro worker ya reclamó la fila,
-- el worker viejo no puede pisar el resultado del nuevo. Devuelve si aplicó.

create or replace function public.complete_email_delivery(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_status text,
  p_response_code integer default null,
  p_provider_message_id text default null,
  p_response_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_applied integer;
begin
  if p_status not in ('sent', 'failed', 'pending') then
    raise exception 'Estado de cierre no admitido: %', p_status;
  end if;

  update public.notification_deliveries d
  set delivery_status = p_status,
      response_code = p_response_code,
      provider_message_id = p_provider_message_id,
      response_payload = coalesce(p_response_payload, '{}'::jsonb),
      delivered_at = case when p_status = 'sent' then timezone('utc', now()) else d.delivered_at end,
      failed_at = case when p_status = 'failed' then timezone('utc', now()) else null end,
      claim_token = null,
      claimed_at = null,
      updated_at = timezone('utc', now())
  where d.id = p_delivery_id
    and d.claim_token = p_claim_token;

  get diagnostics v_applied = row_count;
  return v_applied > 0;
end;
$$;

revoke all on function public.complete_email_delivery(uuid, uuid, text, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_email_delivery(uuid, uuid, text, integer, text, jsonb) to service_role;

-- ── 4. El reenvío deliberado estrena idempotency key ─────────────────────────
-- Sin esto el proveedor descartaría el reenvío como duplicado dentro de su
-- ventana de deduplicación. También libera cualquier reserva viva.

create or replace function public.email_resend_delivery(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found boolean;
begin
  if not public.has_platform_permission('email:resend') then
    raise exception 'forbidden';
  end if;

  update public.notification_deliveries
  set delivery_status = 'pending',
      failed_at = null,
      -- Envío lógicamente nuevo: clave nueva, reserva liberada y contador a cero
      -- para que el tope de intentos no lo bloquee de entrada.
      idempotency_key = gen_random_uuid(),
      claim_token = null,
      claimed_at = null,
      attempt_count = 0,
      updated_at = timezone('utc', now())
  where id = p_delivery_id and channel = 'email';

  get diagnostics v_found = row_count;
  if not v_found then
    raise exception 'Entrega de email no encontrada (#%)', p_delivery_id;
  end if;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (auth.uid(), 'email.resend', 'notification_delivery', p_delivery_id::text, '{}'::jsonb);
end;
$$;
