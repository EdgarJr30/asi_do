-- ─────────────────────────────────────────────────────────────────────────────
-- Formulario de contacto: reglas de contenido, no solo de longitud.
--
-- La versión anterior (20260810195845) solo exigía 10 caracteres en el mensaje,
-- así que `..........`, `aaaaaaaaaa` o `1234567890` pasaban limpios. Eso llena
-- el buzón institucional de consultas que no dicen nada y que igual hay que
-- abrir para descartarlas.
--
-- Lo que se añade aquí es qué tiene que **contener** cada campo:
--
--   nombre  — empieza por letra y sigue con letras, espacios, guiones, puntos y
--             apóstrofos. Como efecto útil, deja fuera el `http://…` que es el
--             relleno habitual del spam automatizado.
--   correo  — TLD alfabético de dos letras o más: `a@a.a` y `x@y` dejan de valer.
--   motivo  — al menos tres letras (no un guion ni un espacio).
--   mensaje — al menos 10 caracteres alfanuméricos, dos palabras de dos letras o
--             más, y prohibido que sea un solo carácter repetido de punta a
--             punta. Las tres a la vez: 10 alfanuméricos sin palabras deja pasar
--             `1234567890`, y la prueba de repetición sola deja pasar `.a.a.a.`.
--
-- El espejo en el cliente vive en `src/experiences/institutional/lib/
-- contact-validation.ts` y existe solo para el error inmediato; la autoridad es
-- esta función, que es la única que `anon` puede ejecutar.
--
-- `create or replace` conserva los grants y los límites de abuso de la
-- migración original: aquí solo cambia la validación de entrada.
-- ─────────────────────────────────────────────────────────────────────────────

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

  -- Un nombre: empieza por letra y sigue con letras, espacios y los signos que
  -- de verdad aparecen en un nombre. `[[:alpha:]]` cubre acentos y ñ en UTF-8.
  c_re_nombre constant text := '^[[:alpha:]][[:alpha:] .''’-]*$';
  -- Dirección con TLD alfabético de dos letras o más.
  c_re_correo constant text := '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$';
  -- Un único carácter repetido de principio a fin.
  c_re_repetido constant text := '^(.)\1*$';

  c_min_alnum_mensaje constant integer := 10;
  c_min_palabras_mensaje constant integer := 2;

  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_topic text := nullif(btrim(coalesce(p_topic, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_recientes integer;
  v_palabras integer;
  v_notification_id uuid;
  v_delivery_id uuid;
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Escribe tu nombre (entre 2 y 120 caracteres).'
      using errcode = 'check_violation';
  end if;

  if v_name !~ c_re_nombre
     or length(regexp_replace(v_name, '[^[:alpha:]]', '', 'g')) < 2 then
    raise exception 'El nombre solo puede llevar letras, espacios, guiones y apóstrofos.'
      using errcode = 'check_violation';
  end if;

  if v_email is null or length(v_email) > 254 or v_email !~ c_re_correo then
    raise exception 'Escribe un correo válido para que podamos responderte.'
      using errcode = 'check_violation';
  end if;

  if v_topic is null or length(v_topic) > 80
     or length(regexp_replace(v_topic, '[^[:alpha:]]', '', 'g')) < 3 then
    raise exception 'Selecciona un motivo válido.'
      using errcode = 'check_violation';
  end if;

  if v_message is null or length(v_message) < 10 or length(v_message) > 4000 then
    raise exception 'El mensaje debe tener entre 10 y 4000 caracteres.'
      using errcode = 'check_violation';
  end if;

  -- Un solo carácter repetido, ignorando espacios: `..........`, `a a a a a a`.
  if regexp_replace(v_message, '\s', '', 'g') ~ c_re_repetido then
    raise exception 'Cuéntanos en qué podemos ayudarte: el mensaje está vacío de contenido.'
      using errcode = 'check_violation';
  end if;

  -- Contenido real: alfanuméricos suficientes y no solo signos de puntuación.
  if length(regexp_replace(v_message, '[^[:alnum:]]', '', 'g')) < c_min_alnum_mensaje then
    raise exception 'Cuéntanos en qué podemos ayudarte: el mensaje está vacío de contenido.'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_palabras
  from regexp_matches(v_message, '[[:alpha:]]{2,}', 'g');

  if v_palabras < c_min_palabras_mensaje then
    raise exception 'Escribe tu consulta en al menos dos palabras.'
      using errcode = 'check_violation';
  end if;

  -- Los caracteres de control en nombre y motivo terminarían en el asunto del
  -- correo; un salto de línea ahí es inyección de cabeceras. El regex del
  -- nombre ya los excluye, pero el motivo se valida solo por longitud.
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
  'Encola la consulta del formulario público de contacto hacia el buzón institucional. El destinatario está fijado en la función; el cliente solo aporta nombre, correo, motivo y mensaje. Exige contenido real (nombre con forma de nombre, correo con TLD, mensaje con dos palabras y 10 alfanuméricos) y limita a 3 envíos por correo y 60 globales por hora.';
