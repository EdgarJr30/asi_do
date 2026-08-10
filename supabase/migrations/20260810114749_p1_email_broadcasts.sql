-- ─────────────────────────────────────────────────────────────────────────────
-- Envío masivo de correos desde /admin/correos — base de datos.
--
-- Sube por el **outbox que ya existe** (`notifications` + `notification_deliveries`)
-- en vez de llamar a Resend directo. Con eso hereda, sin escribir una línea:
-- la idempotencia por entrega (TASK-266, un reintento no manda dos veces), el
-- lease recuperable, el tope de intentos, el aislamiento `is_test`, la supresión
-- del arnés y la visibilidad completa en `/admin/correos` con su cronología.
-- Llamar a Resend aparte habría producido un segundo historial de correo que
-- nadie mira.
--
-- Lo que sí hace falta añadir, y es el motivo de esta migración:
--
--   1. **Campañas.** Un envío masivo es una unidad que se nombra, se cuenta y se
--      audita. Las entregas cuelgan de ella por `payload.broadcast_id`.
--   2. **Supresión propia.** Una lista cargada a mano es exactamente donde
--      aparecen las direcciones muertas y las quejas de spam. Sin baja, cada
--      campaña arriesga la reputación de `asidominicana.do` — y por ese mismo
--      dominio salen la confirmación de cuenta y la recuperación de contraseña.
--      Perder esos dos correos es perder el acceso al producto.
--   3. **Un permiso propio.** `email:resend` reenvía un correo a una persona;
--      esto le escribe a miles. No es el mismo poder y no debe ser el mismo
--      permiso.
--
-- La direccion del destinatario viaja en `payload.to`, que es el mismo override
-- que ya usa el modo de prueba y que el procesador respeta (regla 2 de R3.2).
-- Por eso `notifications.recipient_user_id` puede quedar nulo: un destinatario
-- de campaña no tiene por qué ser un usuario de la plataforma.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A. Supresión ─────────────────────────────────────────────────────────────
-- Guarda la dirección normalizada. `email` es la clave: dos campañas que
-- suprimen la misma dirección no crean dos filas, y el motivo de la primera se
-- conserva (`do nothing`), que es el que explica por qué dejó de recibir.
create table if not exists public.email_suppressions (
  email text primary key,
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained', 'manual')),
  source text,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.email_suppressions is
  'Direcciones que no deben recibir correo masivo. La comprobación es en el encolado y otra vez al enviar: alguien puede darse de baja entre ambos momentos.';

alter table public.email_suppressions enable row level security;

-- Solo lectura, y solo para quien administra correos. Escribir es cosa de las
-- RPC: la baja pública llega sin sesión y no debe poder tocar la tabla directo.
drop policy if exists email_suppressions_read on public.email_suppressions;
create policy email_suppressions_read on public.email_suppressions
  for select
  to authenticated
  using ( ( select public.has_platform_permission('email:read') ) );

grant select on public.email_suppressions to authenticated;

-- ── B. Campañas ──────────────────────────────────────────────────────────────
create table if not exists public.email_broadcasts (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  subject text not null,
  body text not null,
  created_by_user_id uuid not null references public.users (id),
  is_test boolean not null default false,
  -- Cuentas del momento del encolado. El estado vivo de cada entrega se lee de
  -- `notification_deliveries`; esto es la foto de lo que se pidió enviar.
  total_requested integer not null default 0,
  total_queued integer not null default 0,
  total_suppressed integer not null default 0,
  total_duplicated integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.email_broadcasts is
  'Campañas de correo masivo. Las entregas cuelgan por payload.broadcast_id sobre el outbox normal.';

create index if not exists email_broadcasts_created_at_idx
  on public.email_broadcasts (created_at desc);

alter table public.email_broadcasts enable row level security;

drop policy if exists email_broadcasts_read on public.email_broadcasts;
create policy email_broadcasts_read on public.email_broadcasts
  for select
  to authenticated
  using ( ( select public.has_platform_permission('email:read') ) );

grant select on public.email_broadcasts to authenticated;

-- Índice para listar las entregas de una campaña sin recorrer el outbox entero.
create index if not exists notifications_broadcast_idx
  on public.notifications ((payload ->> 'broadcast_id'))
  where payload ? 'broadcast_id';

-- ── C. Permiso ───────────────────────────────────────────────────────────────
insert into public.permissions (code, resource, action, scope, description)
values ('email:broadcast', 'email', 'broadcast', 'platform',
        'Enviar correos masivos a una lista cargada desde /admin/correos')
on conflict (code) do update
set resource = excluded.resource,
    action = excluded.action,
    scope = excluded.scope,
    description = excluded.description;

-- Solo dueño de plataforma y super administrador. `platform_admin` conserva
-- `email:resend` pero no hereda este: reenviar a una persona y escribirle a
-- miles no son el mismo poder.
insert into public.platform_role_permissions (role_id, permission_id)
select pr.id, p.id
from public.platform_roles pr
join public.permissions p on p.code = 'email:broadcast'
where pr.code in ('platform_owner', 'super_administrator')
on conflict do nothing;

-- ── D. Encolar una campaña ───────────────────────────────────────────────────
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
  v_broadcast_id uuid;
  v_requested int;
  v_unicos int;
  v_suprimidos int;
  v_encolados int := 0;
begin
  if not ( select public.has_platform_permission('email:broadcast') ) then
    raise exception 'Insufficient permission to send email broadcasts'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(nullif(trim(p_name), ''), '') = ''
     or coalesce(nullif(trim(p_subject), ''), '') = ''
     or coalesce(nullif(trim(p_body), ''), '') = '' then
    raise exception 'La campaña necesita nombre, asunto y cuerpo';
  end if;

  if coalesce(array_length(p_emails, 1), 0) = 0 then
    raise exception 'La campaña no tiene destinatarios';
  end if;

  -- Normalizar, validar y deduplicar antes de contar nada. Se hace aquí y no en
  -- el cliente porque el cliente no es el único que puede llamar a esto, y
  -- porque una direccion repetida con otra caja (`Ana@` vs `ana@`) es un envío
  -- duplicado que el destinatario sí nota.
  create temporary table _broadcast_input on commit drop as
  select distinct lower(trim(e)) as email
  from unnest(p_emails) as e
  where trim(e) <> ''
    and lower(trim(e)) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  v_requested := coalesce(array_length(p_emails, 1), 0);
  select count(*) into v_unicos from _broadcast_input;

  select count(*) into v_suprimidos
  from _broadcast_input i
  join public.email_suppressions s on s.email = i.email;

  insert into public.email_broadcasts (
    name, subject, body, created_by_user_id, is_test,
    total_requested, total_suppressed, total_duplicated
  )
  values (
    trim(p_name), trim(p_subject), p_body, (select auth.uid()), coalesce(p_is_test, false),
    v_requested, v_suprimidos, greatest(v_requested - v_unicos, 0)
  )
  returning id into v_broadcast_id;

  -- Una notificación por destinatario vivo. `recipient_user_id` se resuelve
  -- cuando la dirección pertenece a un usuario —así el correo queda atribuido y
  -- visible en su historial— y queda nulo cuando no, que es el caso normal de
  -- una lista cargada.
  with destinatarios as (
    select i.email
    from _broadcast_input i
    left join public.email_suppressions s on s.email = i.email
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
        -- Token de baja por destinatario: la ruta pública lo canjea sin sesión,
        -- así que tiene que ser inadivinable y no revelar la dirección.
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
      'name', trim(p_name), 'is_test', coalesce(p_is_test, false),
      'requested', v_requested, 'queued', v_encolados, 'suppressed', v_suprimidos
    )
  );

  return jsonb_build_object(
    'broadcastId', v_broadcast_id,
    'requested', v_requested,
    'queued', v_encolados,
    'suppressed', v_suprimidos,
    'duplicated', greatest(v_requested - v_unicos, 0)
  );
end;
$$;

comment on function public.email_broadcast_enqueue(text, text, text, text[], boolean) is
  'Encola una campaña sobre el outbox. Normaliza, deduplica y descarta suprimidos antes de escribir.';

revoke all on function public.email_broadcast_enqueue(text, text, text, text[], boolean) from public, anon;
grant execute on function public.email_broadcast_enqueue(text, text, text, text[], boolean) to authenticated;

-- ── E. Baja pública ──────────────────────────────────────────────────────────
-- Se ejecuta **sin sesión**: quien se da de baja llega desde su cliente de
-- correo. Por eso la superficie es mínima —recibe un token y no dice nada de
-- quién es— y por eso el token es un uuid aleatorio por destinatario y no la
-- dirección: si fuera la dirección, cualquiera podría dar de baja a cualquiera.
create or replace function public.email_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select n.payload ->> 'to' into v_email
  from public.notifications n
  where n.payload ->> 'unsubscribe_token' = p_token::text
  limit 1;

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

comment on function public.email_unsubscribe(uuid) is
  'Da de baja la dirección asociada a un token de campaña. Ejecutable sin sesión: es un enlace de correo.';

revoke all on function public.email_unsubscribe(uuid) from public;
grant execute on function public.email_unsubscribe(uuid) to anon, authenticated;

-- ── F. Guarda de última hora ─────────────────────────────────────────────────
-- El encolado ya descarta suprimidos, pero entre encolar y enviar pueden pasar
-- minutos y alguien puede darse de baja justo ahí. Esta guarda es la que hace
-- que la baja signifique algo: bloquea la entrega en el momento del envío.
create or replace function public.email_delivery_is_suppressed(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notification_deliveries d
    join public.notifications n on n.id = d.notification_id
    join public.email_suppressions s on s.email = lower(n.payload ->> 'to')
    where d.id = p_delivery_id
  );
$$;

revoke all on function public.email_delivery_is_suppressed(uuid) from public, anon;
grant execute on function public.email_delivery_is_suppressed(uuid) to service_role;
