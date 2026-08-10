-- ─────────────────────────────────────────────────────────────────────────────
-- Formulario público de contacto: envío real en vez de `mailto:`.
--
-- Hasta ahora "Déjanos tu mensaje" solo construía un enlace `mailto:` y abría
-- el cliente de correo del visitante. Eso deja la consulta en manos del
-- visitante (si no tiene cliente configurado, se pierde) y no queda rastro en
-- la plataforma. Aquí el mensaje entra al outbox existente
-- (`notifications` + `notification_deliveries`), que el cron de
-- `process-email-deliveries` despacha por Resend, con lo que además aparece en
-- /admin/correos con su estado, sus reintentos y su log.
--
-- Por qué una RPC `security definer` abierta a `anon`:
--   El formulario es público y no hay sesión. La RPC es el único punto de
--   entrada y **el destinatario está fijado aquí dentro**, nunca llega del
--   cliente: eso es lo que impide que esto se convierta en un relay de correo
--   abierto saliendo por el dominio verificado de ASI (mismo riesgo que
--   documenta 20260802150000 para `system_create_notification`).
--
-- Los frenos al abuso son tres: validación de longitud y formato, límite por
-- correo (3/hora) y techo global (60/hora). El techo global es deliberadamente
-- generoso para el volumen real de un formulario institucional y barato de
-- subir si algún día molesta.
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice para que el conteo de la ventana de una hora no escanee la tabla
-- entera de notificaciones. Parcial: solo interesan las del formulario.
create index if not exists notifications_contact_message_idx
  on public.notifications (created_at desc)
  where type = 'contact.message';

create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_topic text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Buzón institucional. Único destino posible: si esto viniera del cliente,
  -- cualquiera podría enviar correo arbitrario desde el dominio de ASI.
  c_destino constant text := 'hola@asidominicana.do';
  c_ventana constant interval := interval '1 hour';
  c_limite_por_correo constant integer := 3;
  c_limite_global constant integer := 60;

  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_topic text := nullif(btrim(coalesce(p_topic, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_recientes integer;
  v_notification_id uuid;
  v_delivery_id uuid;
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Escribe tu nombre (entre 2 y 120 caracteres).'
      using errcode = 'check_violation';
  end if;

  if v_email is null or length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Escribe un correo válido para que podamos responderte.'
      using errcode = 'check_violation';
  end if;

  if v_topic is null or length(v_topic) > 80 then
    raise exception 'Selecciona un motivo válido.'
      using errcode = 'check_violation';
  end if;

  if v_message is null or length(v_message) < 10 or length(v_message) > 4000 then
    raise exception 'El mensaje debe tener entre 10 y 4000 caracteres.'
      using errcode = 'check_violation';
  end if;

  -- Los caracteres de control en nombre y motivo terminarían en el asunto del
  -- correo; un salto de línea ahí es inyección de cabeceras.
  if v_name ~ '[[:cntrl:]]' or v_topic ~ '[[:cntrl:]]' or v_email ~ '[[:cntrl:]]' then
    raise exception 'Los datos de contacto no pueden contener saltos de línea.'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_recientes
  from public.notifications n
  where n.type = 'contact.message'
    and n.created_at > timezone('utc', now()) - c_ventana
    and n.payload ->> 'from_email' = v_email;

  if v_recientes >= c_limite_por_correo then
    raise exception 'Ya recibimos varias consultas desde este correo. Te responderemos pronto.'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_recientes
  from public.notifications n
  where n.type = 'contact.message'
    and n.created_at > timezone('utc', now()) - c_ventana;

  if v_recientes >= c_limite_global then
    raise exception 'Estamos recibiendo muchas consultas ahora mismo. Intenta de nuevo en unos minutos.'
      using errcode = 'check_violation';
  end if;

  -- `recipient_user_id` nulo: el destinatario es un buzón, no una persona con
  -- cuenta. El despachador resuelve la dirección desde `payload.to`, igual que
  -- en las campañas y en los comprobantes de donación anónima.
  insert into public.notifications (
    recipient_user_id, type, title, body, payload
  )
  values (
    null,
    'contact.message',
    format('Consulta desde el sitio (%s) — %s', v_topic, v_name),
    format(
      E'%s\n\n—\nNombre: %s\nCorreo: %s\nMotivo: %s',
      v_message, v_name, v_email, v_topic
    ),
    jsonb_build_object(
      'to', c_destino,
      'recipientName', 'Equipo ASI',
      'reply_to', v_email,
      'from_email', v_email,
      'from_name', v_name,
      'topic', v_topic,
      'source', 'contact_form'
    )
  )
  returning id into v_notification_id;

  insert into public.notification_deliveries (
    notification_id, channel, delivery_status, provider_name
  )
  values (v_notification_id, 'email', 'pending', 'resend')
  returning id into v_delivery_id;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, entity_id, payload
  )
  values (
    (select auth.uid()), 'contact.message_submitted', 'notification_delivery',
    v_delivery_id::text,
    jsonb_build_object('from_email', v_email, 'topic', v_topic)
  );

  return v_delivery_id;
end;
$$;

comment on function public.submit_contact_message(text, text, text, text) is
  'Encola la consulta del formulario público de contacto hacia el buzón institucional. El destinatario está fijado en la función; el cliente solo aporta nombre, correo, motivo y mensaje. Limitada a 3 envíos por correo y 60 globales por hora.';

revoke all on function public.submit_contact_message(text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text) to anon, authenticated;
