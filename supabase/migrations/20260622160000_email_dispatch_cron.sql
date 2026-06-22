-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5 — Scheduler del procesador de email.
-- La Edge Function process-email-deliveries solo envía cuando alguien la invoca;
-- no había cron, así que los emails quedaban en `pending`. Aquí un job pg_cron
-- (cada minuto) la llama vía pg_net cuando hay pendientes.
--
-- Los secretos (URL, anon key, processor secret) NO se commitean: viven en una
-- tabla del schema `private` (no expuesto por la API) y se cargan fuera de banda
-- con public.set_runtime_secret(...) (solo service_role) tras aplicar la migración.
-- ─────────────────────────────────────────────────────────────────────────────

create schema if not exists private;

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Config en runtime (clave/valor); el schema private no se expone por PostgREST.
create table if not exists private.runtime_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Setter: solo service_role (lo llamamos por MCP/PostgREST), mantiene el secreto fuera de git.
create or replace function public.set_runtime_secret(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into private.runtime_secrets (key, value, updated_at)
  values (p_key, p_value, timezone('utc', now()))
  on conflict (key) do update
    set value = excluded.value,
        updated_at = timezone('utc', now());
end;
$$;

revoke all on function public.set_runtime_secret(text, text) from public;
grant execute on function public.set_runtime_secret(text, text) to service_role;

-- Despachador: si hay emails pendientes, hace POST a la Edge Function (fire-and-forget).
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
begin
  select count(*) into v_pending
  from public.notification_deliveries
  where channel = 'email' and delivery_status = 'pending';

  if coalesce(v_pending, 0) = 0 then
    return;
  end if;

  select value into v_url from private.runtime_secrets where key = 'email_dispatch_url';
  select value into v_anon from private.runtime_secrets where key = 'email_dispatch_anon_key';
  select value into v_secret from private.runtime_secrets where key = 'email_processor_secret';

  if v_url is null or v_secret is null then
    return; -- aún no configurado
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_anon, ''),
      'x-email-processor-secret', v_secret
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Agenda el job cada minuto (idempotente: re-crea por nombre).
do $$
begin
  perform cron.unschedule('dispatch-membership-emails');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'dispatch-membership-emails',
  '* * * * *',
  $cron$select private.dispatch_membership_emails();$cron$
);
