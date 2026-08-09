-- Historial real de eventos de Resend. El `svix-id` es la clave idempotente:
-- Resend puede reintentar o reproducir eventos y no deben duplicarse.

alter table public.notification_deliveries
  add column if not exists latest_provider_event text,
  add column if not exists latest_provider_event_at timestamptz;

create table if not exists public.email_delivery_events (
  id uuid primary key default extensions.gen_random_uuid(),
  delivery_id uuid not null references public.notification_deliveries(id) on delete cascade,
  provider_event_id text not null unique,
  provider_message_id text not null,
  event_type text not null check (event_type in (
    'email.sent',
    'email.delivered',
    'email.delivery_delayed',
    'email.failed',
    'email.suppressed',
    'email.bounced',
    'email.complained',
    'email.opened',
    'email.clicked'
  )),
  event_created_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists email_delivery_events_delivery_created_idx
  on public.email_delivery_events(delivery_id, event_created_at desc);

create index if not exists email_delivery_events_type_created_idx
  on public.email_delivery_events(event_type, event_created_at desc);

alter table public.email_delivery_events enable row level security;

drop policy if exists email_delivery_events_platform_read on public.email_delivery_events;
create policy email_delivery_events_platform_read
on public.email_delivery_events
for select
to authenticated
using (public.has_platform_permission('email:read'));

revoke all on table public.email_delivery_events from public, anon, authenticated;
grant select on table public.email_delivery_events to authenticated;

-- Solo el backend privilegiado puede llamar este RPC. SECURITY INVOKER conserva
-- los límites del rol llamante y evita introducir otro bypass de RLS.
create or replace function public.record_resend_webhook_event(
  p_provider_event_id text,
  p_provider_message_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_delivery public.notification_deliveries%rowtype;
  v_event_id uuid;
  v_status text;
begin
  if p_provider_event_id is null or btrim(p_provider_event_id) = '' then
    raise exception 'provider_event_id requerido';
  end if;

  if p_provider_message_id is null or btrim(p_provider_message_id) = '' then
    raise exception 'provider_message_id requerido';
  end if;

  if p_event_type not in (
    'email.sent',
    'email.delivered',
    'email.delivery_delayed',
    'email.failed',
    'email.suppressed',
    'email.bounced',
    'email.complained',
    'email.opened',
    'email.clicked'
  ) then
    raise exception 'Evento de Resend no admitido: %', p_event_type;
  end if;

  select d.*
  into v_delivery
  from public.notification_deliveries d
  where d.channel = 'email'
    and d.provider_name = 'resend'
    and d.provider_message_id = p_provider_message_id
  for update;

  if not found then
    return jsonb_build_object(
      'recorded', false,
      'duplicate', false,
      'reason', 'delivery_not_found'
    );
  end if;

  insert into public.email_delivery_events (
    delivery_id,
    provider_event_id,
    provider_message_id,
    event_type,
    event_created_at,
    payload
  ) values (
    v_delivery.id,
    p_provider_event_id,
    p_provider_message_id,
    p_event_type,
    p_event_created_at,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object(
      'recorded', false,
      'duplicate', true,
      'delivery_id', v_delivery.id
    );
  end if;

  v_status := case
    when v_delivery.delivery_status = 'failed'
      or p_event_type in ('email.failed', 'email.suppressed', 'email.bounced', 'email.complained')
      then 'failed'
    when v_delivery.delivery_status = 'clicked' or p_event_type = 'email.clicked'
      then 'clicked'
    when v_delivery.delivery_status = 'read' or p_event_type = 'email.opened'
      then 'read'
    when p_event_type in ('email.sent', 'email.delivered')
      then 'sent'
    else v_delivery.delivery_status
  end;

  update public.notification_deliveries d
  set delivery_status = v_status,
      delivered_at = case
        when p_event_type in ('email.delivered', 'email.opened', 'email.clicked')
          then coalesce(d.delivered_at, p_event_created_at)
        else d.delivered_at
      end,
      failed_at = case
        when p_event_type in ('email.failed', 'email.suppressed', 'email.bounced', 'email.complained')
          then coalesce(d.failed_at, p_event_created_at)
        else d.failed_at
      end,
      latest_provider_event = case
        when d.latest_provider_event_at is null or p_event_created_at >= d.latest_provider_event_at
          then p_event_type
        else d.latest_provider_event
      end,
      latest_provider_event_at = greatest(d.latest_provider_event_at, p_event_created_at),
      updated_at = timezone('utc', now())
  where d.id = v_delivery.id;

  insert into public.notification_delivery_logs (delivery_id, log_level, message, metadata)
  values (
    v_delivery.id,
    case
      when p_event_type in ('email.failed', 'email.suppressed', 'email.bounced', 'email.complained') then 'error'
      when p_event_type = 'email.delivery_delayed' then 'warn'
      else 'info'
    end,
    'Resend webhook event recorded.',
    jsonb_build_object(
      'provider', 'resend',
      'providerEventId', p_provider_event_id,
      'providerMessageId', p_provider_message_id,
      'eventType', p_event_type,
      'eventCreatedAt', p_event_created_at
    )
  );

  return jsonb_build_object(
    'recorded', true,
    'duplicate', false,
    'delivery_id', v_delivery.id,
    'delivery_status', v_status
  );
end;
$$;

revoke all on function public.record_resend_webhook_event(text, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_resend_webhook_event(text, text, text, timestamptz, jsonb)
  to service_role;
