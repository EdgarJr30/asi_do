-- ─────────────────────────────────────────────────────────────────────────────
-- Corrección de `email_broadcast_enqueue` (20260810114749): fuera la tabla
-- temporal.
--
-- `supabase db lint --linked` dejó la función en rojo:
--
--   relation "_broadcast_input" does not exist  (42P01)
--
-- No es un fallo en ejecución —la tabla se crea unas líneas antes— sino que el
-- analizador estático de plpgsql no ve tablas creadas en tiempo de ejecución.
-- Da igual: el contrato del repo es que `db lint` diga *No schema errors found*,
-- porque un lint en rojo permanente es exactamente como estas alertas dejan de
-- servir. Y la alternativa es más simple que lo que sustituye.
--
-- La lista normalizada vive ahora en una variable `text[]`. Se calcula una vez y
-- las tres lecturas —únicos, suprimidos e inserción— salen de ella, así que
-- además desaparece la posibilidad de que dos de esos tres pasos vean conjuntos
-- distintos.
--
-- Nada más cambia: mismos parámetros, mismo contrato de salida, mismas guardas.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_normalizados text[];
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
  -- porque una dirección repetida con otra caja (`Ana@` vs `ana@`) es un envío
  -- duplicado que el destinatario sí nota.
  select coalesce(array_agg(distinct lower(trim(e))), '{}')
  into v_normalizados
  from unnest(p_emails) as e
  where trim(e) <> ''
    and lower(trim(e)) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  v_requested := coalesce(array_length(p_emails, 1), 0);
  v_unicos := coalesce(array_length(v_normalizados, 1), 0);

  -- El alias explícito no es cosmético: sin él, `s.email = email` deja el lado
  -- derecho ambiguo entre la columna de `email_suppressions` y el elemento del
  -- array, y Postgres resuelve a la columna — la condición sería `s.email =
  -- s.email`, siempre cierta, y el conteo de suprimidos daría la lista entera.
  select count(*) into v_suprimidos
  from unnest(v_normalizados) as t(email)
  join public.email_suppressions s on s.email = t.email;

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

revoke all on function public.email_broadcast_enqueue(text, text, text, text[], boolean) from public, anon;
grant execute on function public.email_broadcast_enqueue(text, text, text, text[], boolean) to authenticated;
