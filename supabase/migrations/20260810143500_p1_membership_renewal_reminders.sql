-- ─────────────────────────────────────────────────────────────────────────────
-- Recordatorios de renovación de membresía (TASK-255, F1).
--
-- Hoy no existe ninguno: `grep cron.schedule` solo devuelve correo, auditoría,
-- access logs y errores. Y el acceso **sí caduca por fecha** —`hasActiveAsiAccess`
-- exige `membership_expires_at > now`— así que un miembro pierde la plataforma el
-- día del vencimiento sin que nadie se lo haya avisado nunca. Ese es el agujero.
--
-- Tres decisiones que gobiernan el diseño:
--
--   1. **Sube por el outbox, no por Resend.** `system_create_notification` crea
--      la notificación in-app, encola el correo si la persona lo tiene activado
--      y reparte el push. Con eso hereda `claim_email_deliveries`, la
--      idempotencia por entrega, el aislamiento `is_test` y la visibilidad en
--      `/admin/correos`. Llamar a Resend aparte produciría un segundo historial
--      de correo que nadie mira.
--
--   2. **Una fila por (persona, vencimiento, ventana).** El cron corre a diario
--      y la condición de una ventana se cumple durante muchos días seguidos: sin
--      esta tabla, el aviso de "faltan 30 días" saldría veintitrés veces. La
--      clave incluye la **fecha de vencimiento**, de modo que renovar rearma los
--      recordatorios solos en vez de dejarlos consumidos para siempre.
--
--   3. **No se consulta `email_suppressions`.** Es la tabla de las campañas. Un
--      aviso de vencimiento es transaccional —sin él la persona pierde el acceso
--      y no sabe por qué— y `/correos/baja` promete exactamente eso: "seguirás
--      recibiendo los correos necesarios de tu cuenta, incluidos los avisos de
--      tu membresía". Filtrar aquí rompería esa promesa en la dirección que hace
--      daño.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A. Qué recordatorio ya salió ─────────────────────────────────────────────
create table if not exists public.membership_renewal_reminders (
  user_id uuid not null references public.users (id) on delete cascade,
  -- Fecha local del vencimiento que motivó el aviso. Parte de la clave: al
  -- renovar cambia, y la persona vuelve a ser elegible para los cuatro avisos.
  expires_on date not null,
  window_code text not null check (window_code in ('d30', 'd7', 'd1', 'overdue')),
  notification_id uuid references public.notifications (id) on delete set null,
  sent_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, expires_on, window_code)
);

comment on table public.membership_renewal_reminders is
  'Marca de qué aviso de renovación ya salió. Existe para que un cron diario no repita el mismo recordatorio cada día que la ventana sigue abierta.';

alter table public.membership_renewal_reminders enable row level security;

-- Sin políticas y sin grants: la escribe el cron y nadie la lee por PostgREST.
-- Lo que la consola necesita saber —cuándo vence cada quien— ya está en `users`.

-- ── B. Encolar los que tocan hoy ─────────────────────────────────────────────
create or replace function private.enqueue_membership_renewal_reminders(
  p_now timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = private, public
as $$
declare
  -- El parámetro existe para poder probar las cuatro ventanas sin esperar un
  -- mes. En producción siempre entra nulo y manda el reloj.
  v_now timestamptz := coalesce(p_now, timezone('utc', now()));
  -- Los días se cuentan en hora de Santo Domingo y no en UTC: "vence mañana"
  -- tiene que significar mañana para quien lo lee. Con UTC, un vencimiento a
  -- las 21:00 hora local cae al día siguiente y el aviso llega tarde por uno.
  v_hoy date := (v_now at time zone 'America/Santo_Domingo')::date;
  r record;
  v_ventana text;
  v_titulo text;
  v_cuerpo text;
  v_notificacion uuid;
  v_enviados int := 0;
begin
  for r in
    select
      u.id,
      (u.membership_expires_at at time zone 'America/Santo_Domingo')::date as vence_el,
      ((u.membership_expires_at at time zone 'America/Santo_Domingo')::date - v_hoy) as dias
    from public.users u
    where u.status = 'active'
      and u.asi_membership_status = 'active'
      and u.membership_expires_at is not null
  loop
    -- Se elige **la ventana más urgente ya alcanzada**, no la que coincide
    -- exacto con el día. Dos consecuencias, las dos buscadas: si el cron no
    -- corrió durante una semana el aviso sale igual —tarde, pero sale— y a
    -- alguien que está a 5 días no se le manda "faltan 30".
    v_ventana := case
      when r.dias < 0 then 'overdue'
      when r.dias <= 1 then 'd1'
      when r.dias <= 7 then 'd7'
      when r.dias <= 30 then 'd30'
      else null
    end;

    if v_ventana is null then
      continue;
    end if;

    -- El bloque tiene manejador propio para que un destinatario roto no aborte
    -- la corrida entera: en un cron, un fallo que se lleva por delante a los
    -- demás es la diferencia entre "faltó un aviso" y "no salió ninguno".
    -- Como la marca se inserta dentro, la excepción también la revierte y el
    -- caso se reintenta mañana.
    begin
      insert into public.membership_renewal_reminders (user_id, expires_on, window_code)
      values (r.id, r.vence_el, v_ventana)
      on conflict do nothing;

      -- Ya había salido: la ventana lleva días abierta y esto es la corrida
      -- número N.
      if not found then
        continue;
      end if;

      -- El texto sale de los días reales, no de la etiqueta de la ventana: si
      -- `d30` se dispara con 22 días por un cron caído, el correo dice 22.
      if v_ventana = 'overdue' then
        v_titulo := 'Tu membresía venció';
        v_cuerpo := format(
          'Tu membresía de ASI Rep. Dominicana venció el %s y tu acceso a la plataforma quedó suspendido. Renuévala desde tu panel de membresía para recuperarlo.',
          to_char(r.vence_el, 'DD/MM/YYYY')
        );
      elsif r.dias = 0 then
        v_titulo := 'Tu membresía vence hoy';
        v_cuerpo := 'Tu membresía de ASI Rep. Dominicana vence hoy. Renuévala desde tu panel de membresía para no perder el acceso a la plataforma.';
      elsif r.dias = 1 then
        v_titulo := 'Tu membresía vence mañana';
        v_cuerpo := 'Tu membresía de ASI Rep. Dominicana vence mañana. Renuévala desde tu panel de membresía para no perder el acceso a la plataforma.';
      else
        v_titulo := format('Tu membresía vence en %s días', r.dias);
        v_cuerpo := format(
          'Tu membresía de ASI Rep. Dominicana vence el %s, en %s días. Renuévala desde tu panel de membresía para mantener tu acceso sin interrupciones.',
          to_char(r.vence_el, 'DD/MM/YYYY'), r.dias
        );
      end if;

      v_notificacion := public.system_create_notification(
        r.id,
        'membership.renewal_reminder',
        v_titulo,
        v_cuerpo,
        '/account/membership',
        jsonb_build_object('expires_on', r.vence_el, 'days_left', r.dias, 'window', v_ventana),
        null
      );

      update public.membership_renewal_reminders
      set notification_id = v_notificacion
      where user_id = r.id and expires_on = r.vence_el and window_code = v_ventana;

      v_enviados := v_enviados + 1;
    exception when others then
      -- Al log de Postgres y a seguir. Silenciarlo del todo dejaría un cron que
      -- no avisa a nadie y tampoco lo dice.
      raise warning 'recordatorio de renovación fallido para % (%): %', r.id, v_ventana, sqlerrm;
    end;
  end loop;

  return v_enviados;
end;
$$;

comment on function private.enqueue_membership_renewal_reminders(timestamptz) is
  'Encola los avisos de renovación que tocan hoy (30/7/1 días y vencida), uno por persona y ventana. Idempotente por membership_renewal_reminders.';

-- Vive en `private`, que PostgREST no expone, pero `create function` concede
-- EXECUTE a PUBLIC igual: sin este revoke quedaría al alcance de cualquier rol
-- que llegue a la base por otra vía.
revoke all on function private.enqueue_membership_renewal_reminders(timestamptz)
  from public, anon, authenticated;

-- ── C. Una corrida al día ────────────────────────────────────────────────────
-- 13:00 UTC = 9:00 de la mañana en Santo Domingo. A diario y no cada hora
-- porque la unidad del aviso es el día: correr más seguido no adelanta nada y
-- multiplica las oportunidades de que un fallo parcial se note tarde.
do $$
begin
  perform cron.unschedule('membership-renewal-reminders');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'membership-renewal-reminders',
  '0 13 * * *',
  $cron$select private.enqueue_membership_renewal_reminders();$cron$
);
