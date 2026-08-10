-- ─────────────────────────────────────────────────────────────────────────────
-- Vista previa del envío masivo (J3) y separación de "inválido" de "duplicado".
--
-- La interfaz tiene que poder decir, **antes** de enviar, cuántas direcciones
-- van a salir y cuántas se descartan y por qué. Eso obliga a resolver dos cosas:
--
--   1. **Una sola normalización.** Si el cliente contara por su cuenta, la
--      previsualización y el envío podrían discrepar, y el número que alguien
--      mira para decidir "sí, mándalo" sería el que no manda. La normalización
--      se extrae a `email_broadcast_normalize` y la usan las dos rutas.
--
--   2. **Distinguir por qué se descarta.** `total_duplicated` se calculaba como
--      `pedidas - únicas`, que mete en el mismo cubo a la dirección repetida y a
--      la que no es una dirección. Son dos problemas distintos de la lista de
--      origen: uno es inocuo, el otro significa que el archivo viene mal y
--      alguien debería mirarlo. Ahora `total_duplicated` cuenta solo repetidas.
--
-- Las inválidas no ganan columna: salen de `total_requested - total_duplicated -
-- total_suppressed - total_queued`, porque las cuatro categorías son una
-- partición de la lista pedida.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A. Normalizador compartido ───────────────────────────────────────────────
-- `immutable`: mismas entradas, misma salida, sin tocar la base. Deja además que
-- el planificador la doble en línea.
create or replace function public.email_broadcast_normalize(p_emails text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct lower(trim(e))), '{}'::text[])
  from unnest(coalesce(p_emails, '{}'::text[])) as e
  where trim(e) <> ''
    and lower(trim(e)) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
$$;

comment on function public.email_broadcast_normalize(text[]) is
  'Minúsculas, sin espacios, sin inválidas y sin repetidas. Única fuente de verdad de qué direcciones entran en una campaña.';

-- Auxiliar interna: la llaman `email_broadcast_enqueue` y `email_broadcast_preview`,
-- que son `security definer` y corren como su dueño. Nadie más necesita ejecutarla,
-- así que no lleva grant para `authenticated`. El revoke no es ceremonia: `create
-- function` concede EXECUTE a PUBLIC pese al default privilege revocado.
revoke all on function public.email_broadcast_normalize(text[]) from public, anon;

-- ── B. Cuántas valen y cuántas se caen ───────────────────────────────────────
-- Solo cuenta. No escribe campaña, no escribe entregas y no deja rastro: es la
-- pantalla previa, y se puede pulsar varias veces mientras se corrige el archivo.
--
-- Devuelve conteos, nunca la lista de suprimidas. Quien prepara una campaña no
-- necesita saber **quién** se dio de baja —sabría que esa persona es cliente y
-- que se quejó—, solo cuántos correos menos van a salir.
create or replace function public.email_broadcast_preview(p_emails text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_normalizados text[];
  v_requested int;
  v_validos int;
  v_unicos int;
  v_suprimidos int;
begin
  -- Mismo permiso que enviar. Contar una lista contra `email_suppressions` es
  -- una consulta de pertenencia: con `email:read` bastaría para ir probando
  -- direcciones de una en una y averiguar quién se dio de baja.
  if not ( select public.has_platform_permission('email:broadcast') ) then
    raise exception 'Insufficient permission to preview email broadcasts'
      using errcode = 'insufficient_privilege';
  end if;

  v_requested := coalesce(array_length(p_emails, 1), 0);

  -- Válidas **con** repeticiones: es la diferencia contra las únicas lo que da
  -- el número de duplicadas.
  select count(*) into v_validos
  from unnest(coalesce(p_emails, '{}'::text[])) as e
  where trim(e) <> ''
    and lower(trim(e)) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  v_normalizados := public.email_broadcast_normalize(p_emails);
  v_unicos := coalesce(array_length(v_normalizados, 1), 0);

  select count(*) into v_suprimidos
  from unnest(v_normalizados) as t(email)
  join public.email_suppressions s on s.email = t.email;

  return jsonb_build_object(
    'requested', v_requested,
    'invalid', greatest(v_requested - v_validos, 0),
    'duplicated', greatest(v_validos - v_unicos, 0),
    'suppressed', v_suprimidos,
    'deliverable', greatest(v_unicos - v_suprimidos, 0)
  );
end;
$$;

comment on function public.email_broadcast_preview(text[]) is
  'Cuenta enviables, inválidas, duplicadas y suprimidas de una lista sin escribir nada. Misma normalización que el encolado.';

revoke all on function public.email_broadcast_preview(text[]) from public, anon;
grant execute on function public.email_broadcast_preview(text[]) to authenticated;

-- ── C. El encolado usa el normalizador y cuenta duplicadas de verdad ─────────
-- Reemplazo íntegro de la versión de `20260810115927`. Cambia solo el cálculo de
-- las dos cifras y de dónde sale la lista; el contrato de entrada y salida es el
-- mismo, más `invalid` en la respuesta, que antes no se podía saber.
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
  v_validos int;
  v_unicos int;
  v_duplicados int;
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

  v_requested := coalesce(array_length(p_emails, 1), 0);

  select count(*) into v_validos
  from unnest(p_emails) as e
  where trim(e) <> ''
    and lower(trim(e)) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  v_normalizados := public.email_broadcast_normalize(p_emails);
  v_unicos := coalesce(array_length(v_normalizados, 1), 0);
  v_duplicados := greatest(v_validos - v_unicos, 0);

  -- El alias explícito no es cosmético: sin él, `s.email = email` deja el lado
  -- derecho ambiguo entre la columna de `email_suppressions` y el elemento del
  -- array, y Postgres resuelve a la columna — la condición sería `s.email =
  -- s.email`, siempre cierta, y el conteo de suprimidos daría la lista entera.
  select count(*) into v_suprimidos
  from unnest(v_normalizados) as t(email)
  join public.email_suppressions s on s.email = t.email;

  -- Una lista que solo trae basura o gente dada de baja no debe dejar una
  -- campaña vacía en el historial: no se envió nada y el nombre sugeriría que sí.
  if v_unicos - v_suprimidos <= 0 then
    raise exception 'La campaña no tiene destinatarios enviables: % pedidas, % inválidas, % duplicadas, % suprimidas',
      v_requested, greatest(v_requested - v_validos, 0), v_duplicados, v_suprimidos;
  end if;

  insert into public.email_broadcasts (
    name, subject, body, created_by_user_id, is_test,
    total_requested, total_suppressed, total_duplicated
  )
  values (
    trim(p_name), trim(p_subject), p_body, (select auth.uid()), coalesce(p_is_test, false),
    v_requested, v_suprimidos, v_duplicados
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
    'duplicated', v_duplicados,
    'invalid', greatest(v_requested - v_validos, 0)
  );
end;
$$;

revoke all on function public.email_broadcast_enqueue(text, text, text, text[], boolean) from public, anon;
grant execute on function public.email_broadcast_enqueue(text, text, text, text[], boolean) to authenticated;

-- ── D. Cierre de una fuga ajena que la probe cazó de paso ────────────────────
-- `enforce_initial_membership_period_after_activation` (20260810010000) se creó
-- sin su `revoke`, así que quedó ejecutable por PUBLIC y por tanto por `anon`:
-- `p2_platform_grants_probe` pasó de 22/24 a 23/25.
--
-- Es una función de trigger, de modo que llamarla suelta falla por falta de
-- contexto y el daño real es acotado. Lo que no es acotado es dejar el número
-- en rojo: el valor de esa probe está entero en que cualquier subida obligue a
-- justificarla, y una en rojo permanente deja de leerse. Se corrige aquí porque
-- las migraciones aplicadas son inmutables y hace falta una encima.
revoke all on function public.enforce_initial_membership_period_after_activation() from public, anon;
