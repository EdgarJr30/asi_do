-- ─────────────────────────────────────────────────────────────────────────────
-- Supresión de correos para el arnés de estrés (garantía sin condición de carrera).
--
-- Problema: los triggers de membresía llaman a system_create_notification, que
-- encola una entrega channel='email' (pending). Un cron (cada minuto) la envía.
-- Borrar las entregas "al final" del run no es seguro: el cron puede dispararse
-- a mitad de un run largo y enviar antes de la limpieza.
--
-- Solución: una bandera de supresión + un trigger BEFORE INSERT en
-- notification_deliveries que OMITE la entrega de email mientras la bandera está
-- activa. Es atómico (corre en la misma transacción del insert), así que NUNCA se
-- crea una entrega de email que el cron pueda enviar. in_app y push no se tocan.
--
-- La bandera se guarda en private.runtime_secrets (key/value, no expuesto por la
-- API), reutilizando la infraestructura del cron de correos. El arnés la enciende
-- antes de generar datos y la apaga al terminar. Auto-expira (2 h) para que una
-- bandera olvidada no silencie correos para siempre.
-- ─────────────────────────────────────────────────────────────────────────────

-- Limpieza por si un intento previo dejó una tabla a medias.
drop table if exists public.harness_email_suppression cascade;

-- ¿Está activa la supresión (y vigente dentro de la ventana de auto-expiración)?
create or replace function public.harness_email_suppressed()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(
    (
      select rs.value = 'on'
        and rs.updated_at > timezone('utc', now()) - interval '2 hours'
      from private.runtime_secrets rs
      where rs.key = 'harness_email_suppression'
    ),
    false
  );
$$;

-- Toggle: solo service_role (lo llama la Edge Function / CLI del arnés, server-side).
create or replace function public.set_harness_email_suppression(p_active boolean)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into private.runtime_secrets (key, value, updated_at)
  values (
    'harness_email_suppression',
    case when p_active then 'on' else 'off' end,
    timezone('utc', now())
  )
  on conflict (key) do update
    set value = excluded.value,
        updated_at = timezone('utc', now());
end;
$$;

revoke all on function public.set_harness_email_suppression(boolean) from public;
grant execute on function public.set_harness_email_suppression(boolean) to service_role;

-- Guarda atómica: omite la creación de entregas de email mientras hay supresión.
create or replace function public.suppress_email_delivery_when_harness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.channel = 'email' and public.harness_email_suppressed() then
    return null; -- cancela el insert de esta entrega de email; el cron no tendrá nada que enviar
  end if;
  return new;
end;
$$;

drop trigger if exists notification_deliveries_harness_email_guard on public.notification_deliveries;
create trigger notification_deliveries_harness_email_guard
before insert on public.notification_deliveries
for each row
execute function public.suppress_email_delivery_when_harness();
