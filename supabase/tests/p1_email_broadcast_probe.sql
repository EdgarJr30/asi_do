-- Prueba de corrección del envío masivo de correos.
--
-- Esto le escribe a miles de personas de una lista cargada a mano, así que los
-- fallos que importan no son excepciones: son correos que salen cuando no
-- debían. Dos direcciones que son la misma con otra caja producen un envío
-- duplicado que el destinatario **sí** nota; un suprimido que se cuela es una
-- queja de spam; y una baja que no bloquea el envío convierte el enlace en
-- decoración.
--
-- Se comprueba además que la baja pública no sirva de oráculo: un token
-- inventado tiene que responder lo mismo que uno caducado.
--
-- Termina en RAISE EXCEPTION: la transacción se revierte y no queda ni una fila.
do $probe$
declare
  v_owner uuid := 'f1000000-0000-4000-a000-000000000001';
  v_sinpermiso uuid := 'f1000000-0000-4000-a000-000000000006';
  v_res jsonb;
  v_broadcast uuid;
  v_token uuid;
  v_delivery uuid;
  v_count int;
  v_out text := '';
  v_fail int := 0;
  v_denegado boolean := false;
begin
  if not exists (select 1 from public.users where id = v_owner) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | faltan los fixtures: carga supabase/tests/fixtures.sql';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  if not ( select public.has_platform_permission('email:broadcast') ) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | el owner del fixture no recibió email:broadcast';
  end if;

  -- Una dirección suprimida de antemano, para el caso 4.
  insert into public.email_suppressions (email, reason, source)
  values ('suprimido@probe.test', 'manual', 'probe')
  on conflict (email) do nothing;

  -- Lista con las cuatro trampas a la vez: repetida con otra caja, con espacios,
  -- inválida, y suprimida.
  v_res := public.email_broadcast_enqueue(
    'Probe campaña',
    'Asunto de la probe',
    'Cuerpo de la probe',
    array[
      'Uno@Probe.TEST',
      '  uno@probe.test  ',
      'dos@probe.test',
      'esto-no-es-un-correo',
      'suprimido@probe.test'
    ],
    true
  );
  v_broadcast := (v_res ->> 'broadcastId')::uuid;

  -- ── A. Encola solo a quien corresponde ────────────────────────────────────
  if (v_res ->> 'queued')::int <> 2 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A1 encoló %s, esperaba 2 (uno@ y dos@)', v_res ->> 'queued');
  else
    v_out := v_out || ' | A1 encolado ok';
  end if;

  select count(*) into v_count
  from public.notifications n
  join public.notification_deliveries d on d.notification_id = n.id
  where n.payload ->> 'broadcast_id' = v_broadcast::text
    and d.delivery_status = 'pending'
    and d.channel = 'email';
  if v_count <> 2 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A2 hay %s entregas pending, esperaba 2', v_count);
  else
    v_out := v_out || ' | A2 entregas ok';
  end if;

  -- ── B. La repetida con otra caja cuenta una vez ───────────────────────────
  select count(*) into v_count
  from public.notifications n
  where n.payload ->> 'broadcast_id' = v_broadcast::text
    and n.payload ->> 'to' = 'uno@probe.test';
  if v_count <> 1 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | B1 uno@probe.test aparece %s veces', v_count);
  else
    v_out := v_out || ' | B1 deduplicación ok';
  end if;

  if (v_res ->> 'duplicated')::int < 1 then
    v_fail := v_fail + 1;
    v_out := v_out || ' | B2 no reportó el duplicado descartado';
  else
    v_out := v_out || ' | B2 duplicado reportado ok';
  end if;

  -- ── C. La dirección inválida no se encola ─────────────────────────────────
  if exists (
    select 1 from public.notifications n
    where n.payload ->> 'broadcast_id' = v_broadcast::text
      and n.payload ->> 'to' = 'esto-no-es-un-correo'
  ) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C1 se encoló una dirección inválida';
  else
    v_out := v_out || ' | C1 inválida descartada ok';
  end if;

  -- ── D. El suprimido no recibe, y se dice cuántos ──────────────────────────
  if exists (
    select 1 from public.notifications n
    where n.payload ->> 'broadcast_id' = v_broadcast::text
      and n.payload ->> 'to' = 'suprimido@probe.test'
  ) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | D1 se encoló una dirección suprimida';
  else
    v_out := v_out || ' | D1 suprimido excluido ok';
  end if;

  if (v_res ->> 'suppressed')::int <> 1 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | D2 reportó %s suprimidos, esperaba 1', v_res ->> 'suppressed');
  else
    v_out := v_out || ' | D2 conteo de suprimidos ok';
  end if;

  -- ── E. La baja pública funciona y no es un oráculo ────────────────────────
  select (n.payload ->> 'unsubscribe_token')::uuid, d.id
  into v_token, v_delivery
  from public.notifications n
  join public.notification_deliveries d on d.notification_id = n.id
  where n.payload ->> 'broadcast_id' = v_broadcast::text
    and n.payload ->> 'to' = 'dos@probe.test';

  if v_token is null then
    v_fail := v_fail + 1;
    v_out := v_out || ' | E0 la notificación no lleva token de baja';
  end if;

  -- Sin sesión: es un enlace que se abre desde el cliente de correo.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  if not public.email_unsubscribe(v_token) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | E1 el token válido no dio de baja';
  else
    v_out := v_out || ' | E1 baja ok';
  end if;

  if not exists (select 1 from public.email_suppressions where email = 'dos@probe.test') then
    v_fail := v_fail + 1;
    v_out := v_out || ' | E2 la baja no llegó a email_suppressions';
  else
    v_out := v_out || ' | E2 supresión escrita ok';
  end if;

  select count(*) into v_count from public.email_suppressions;
  if public.email_unsubscribe(extensions.gen_random_uuid()) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | E3 un token inventado dijo que sí';
  elsif (select count(*) from public.email_suppressions) <> v_count then
    v_fail := v_fail + 1;
    v_out := v_out || ' | E3 un token inventado escribió una fila';
  else
    v_out := v_out || ' | E3 token inventado ok';
  end if;

  -- ── F. La baja posterior al encolado bloquea el envío ─────────────────────
  -- Es lo que hace que el enlace signifique algo: la entrega ya estaba en cola.
  if not public.email_delivery_is_suppressed(v_delivery) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | F1 una entrega ya encolada no quedó marcada como suprimida tras la baja';
  else
    v_out := v_out || ' | F1 guarda de última hora ok';
  end if;

  -- ── G. Sin el permiso, no se envía ────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sinpermiso, 'role', 'authenticated')::text, true);
  begin
    perform public.email_broadcast_enqueue('x', 'x', 'x', array['otro@probe.test'], true);
  exception when insufficient_privilege then
    v_denegado := true;
  end;
  if not v_denegado then
    v_fail := v_fail + 1;
    v_out := v_out || ' | G1 alguien sin email:broadcast encoló una campaña';
  else
    v_out := v_out || ' | G1 denegación ok';
  end if;

  -- ── H. `anon` no puede encolar ────────────────────────────────────────────
  if has_function_privilege('anon',
      'public.email_broadcast_enqueue(text,text,text,text[],boolean)', 'execute') then
    v_fail := v_fail + 1;
    v_out := v_out || ' | H1 anon puede encolar campañas';
  else
    v_out := v_out || ' | H1 anon sin execute ok';
  end if;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
