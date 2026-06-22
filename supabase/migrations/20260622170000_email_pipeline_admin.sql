-- ─────────────────────────────────────────────────────────────────────────────
-- Pipeline de correos /admin/correos — visor del outbox + modo de prueba aislado.
-- Reusa el pipeline existente (notifications + notification_deliveries +
-- process-email-deliveries + cron). NO crea una tabla nueva de email_log.
--
--  - Aislamiento: `is_test` en notifications y notification_deliveries. Las
--    métricas/outbox real filtran is_test = false; el módulo de prueba vive aparte.
--  - Permisos: email:read (ver) / email:resend (reenviar + modo prueba).
--  - RPCs admin: enviar prueba (send/fail/hang), forzar estado, limpiar pruebas,
--    reenviar una entrega, y disparar el procesador (sin exponer el secret).
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Aislamiento de pruebas ----------------------------------------------------
alter table public.notifications
  add column if not exists is_test boolean not null default false;
alter table public.notification_deliveries
  add column if not exists is_test boolean not null default false;
create index if not exists notification_deliveries_channel_test_status_idx
  on public.notification_deliveries (channel, is_test, delivery_status);

-- B. Permisos ------------------------------------------------------------------
insert into public.permissions (code, resource, action, scope, description)
values
  ('email:read', 'email', 'read', 'platform', 'Ver el pipeline de correos transaccionales y su estado'),
  ('email:resend', 'email', 'resend', 'platform', 'Reenviar correos y usar el modo de prueba del pipeline')
on conflict (code) do update
set resource = excluded.resource,
    action = excluded.action,
    scope = excluded.scope,
    description = excluded.description;

insert into public.platform_role_permissions (role_id, permission_id)
select pr.id, p.id
from public.platform_roles pr
join public.permissions p on p.code in ('email:read', 'email:resend')
where pr.code in ('platform_owner', 'platform_admin')
on conflict do nothing;

-- C. RPC: enviar correo de prueba (aislado, is_test) ---------------------------
-- 'send' deja la entrega en 'pending' para que el procesador la envíe de verdad
-- (E2E vía Resend); 'fail' la marca 'failed'; 'hang' la deja colgada en
-- 'processing' (el procesador solo toma 'pending', así que nunca la tocará).
create or replace function public.email_test_send(
  p_to text,
  p_subject text,
  p_message text,
  p_simulate text default 'send'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
  v_delivery_id uuid;
  v_status text;
begin
  if not public.has_platform_permission('email:resend') then
    raise exception 'forbidden';
  end if;

  if coalesce(nullif(trim(p_to), ''), '') = '' then
    raise exception 'Destinatario requerido';
  end if;

  if p_simulate not in ('send', 'fail', 'hang') then
    raise exception 'Escenario inválido: %', p_simulate;
  end if;

  insert into public.notifications (
    recipient_user_id, type, title, body, action_url, payload, is_test
  )
  values (
    auth.uid(),
    'email.test',
    coalesce(nullif(trim(p_subject), ''), 'Correo de prueba del pipeline'),
    coalesce(nullif(trim(p_message), ''), 'Este es un correo de prueba del pipeline de correos.'),
    '/admin/correos',
    jsonb_build_object('to', trim(p_to), 'simulate', p_simulate, 'test', true),
    true
  )
  returning id into v_notification_id;

  v_status := case p_simulate
                when 'fail' then 'failed'
                when 'hang' then 'processing'
                else 'pending'
              end;

  insert into public.notification_deliveries (
    notification_id, channel, delivery_status, provider_name, is_test,
    attempt_count, last_attempt_at, failed_at, response_payload
  )
  values (
    v_notification_id, 'email', v_status, 'resend', true,
    case when p_simulate in ('fail', 'hang') then 1 else 0 end,
    case when p_simulate in ('fail', 'hang') then timezone('utc', now()) else null end,
    case when p_simulate = 'fail' then timezone('utc', now()) else null end,
    case when p_simulate = 'fail'
         then jsonb_build_object('simulated', true, 'message', 'Fallo simulado desde el módulo de prueba')
         else '{}'::jsonb end
  )
  returning id into v_delivery_id;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(), 'email.test_send', 'notification_delivery', v_delivery_id::text,
    jsonb_build_object('to', trim(p_to), 'simulate', p_simulate)
  );

  return v_delivery_id;
end;
$$;

grant execute on function public.email_test_send(text, text, text, text) to authenticated;

-- D. RPC: forzar estado en una entrega de prueba (replica eventos del webhook) --
create or replace function public.email_test_force_status(p_delivery_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_found boolean;
begin
  if not public.has_platform_permission('email:resend') then
    raise exception 'forbidden';
  end if;

  if p_status not in ('pending', 'processing', 'sent', 'failed', 'read', 'clicked') then
    raise exception 'Estado inválido: %', p_status;
  end if;

  update public.notification_deliveries
  set
    delivery_status = p_status,
    delivered_at    = case when p_status in ('sent', 'read', 'clicked') then coalesce(delivered_at, v_now) else delivered_at end,
    failed_at       = case when p_status = 'failed' then v_now
                           when p_status in ('pending', 'processing', 'sent') then null
                           else failed_at end,
    last_attempt_at = case when p_status in ('processing', 'sent', 'failed') then v_now else last_attempt_at end,
    response_payload = case when p_status = 'failed'
                            then jsonb_build_object('simulated', true, 'message', 'Fallo forzado desde el módulo de prueba')
                            else response_payload end,
    updated_at = v_now
  where id = p_delivery_id and is_test = true;

  get diagnostics v_found = row_count;
  if not v_found then
    raise exception 'Entrega de prueba no encontrada (#%)', p_delivery_id;
  end if;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(), 'email.test_force_status', 'notification_delivery', p_delivery_id::text,
    jsonb_build_object('forced_status', p_status)
  );
end;
$$;

grant execute on function public.email_test_force_status(uuid, text) to authenticated;

-- E. RPC: limpiar todos los correos de prueba (no toca el pipeline real) --------
create or replace function public.email_test_clear()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.has_platform_permission('email:resend') then
    raise exception 'forbidden';
  end if;

  -- Borrar la notificación cascada elimina sus deliveries y logs.
  with del as (
    delete from public.notifications where is_test = true returning 1
  )
  select count(*) into v_count from del;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (auth.uid(), 'email.test_clear', 'notification', null, jsonb_build_object('deleted', v_count));

  return v_count;
end;
$$;

grant execute on function public.email_test_clear() to authenticated;

-- F. RPC: reenviar una entrega de email (la vuelve a 'pending') -----------------
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

grant execute on function public.email_resend_delivery(uuid) to authenticated;

-- G. RPC: disparar el procesador de email bajo demanda -------------------------
-- Reusa el despachador del cron (lee config de private.runtime_secrets y hace
-- net.http_post). Permite "enviar ahora" sin exponer el secret en el cliente.
create or replace function public.trigger_email_dispatch()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_platform_permission('email:resend') then
    raise exception 'forbidden';
  end if;

  perform private.dispatch_membership_emails();
end;
$$;

grant execute on function public.trigger_email_dispatch() to authenticated;
