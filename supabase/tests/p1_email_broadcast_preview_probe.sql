-- Prueba de corrección de la vista previa del envío masivo (J3).
--
-- La previsualización existe para que alguien decida "sí, mándalo" mirando un
-- número. Si ese número no es el que se va a enviar, es peor que no tenerlo: da
-- confianza falsa. Así que lo que se comprueba aquí no es que cuente, sino que
-- cuente **lo mismo** que el encolado sobre la misma lista, y que no escriba.
--
-- Se comprueba además la separación que introduce esta migración: inválida y
-- duplicada dejan de ser el mismo cubo. Antes, una lista con basura reportaba
-- "duplicadas", que es exactamente el diagnóstico que hace que nadie mire el
-- archivo.
--
-- Termina en RAISE EXCEPTION: la transacción se revierte y no queda ni una fila.
do $probe$
declare
  v_owner uuid := 'f1000000-0000-4000-a000-000000000001';
  v_sinpermiso uuid := 'f1000000-0000-4000-a000-000000000006';
  v_lista text[] := array[
    'Uno@Preview.TEST',      -- válida
    '  uno@preview.test  ',  -- la misma con otra caja y espacios → duplicada
    'dos@preview.test',      -- válida
    'esto-no-es-un-correo',  -- inválida
    'tampoco@sinpunto',      -- inválida
    'suprimido@preview.test' -- válida pero dada de baja
  ];
  v_prev jsonb;
  v_enq jsonb;
  v_broadcasts_antes int;
  v_broadcasts_despues int;
  v_notifs_antes int;
  v_notifs_despues int;
  v_out text := '';
  v_fail int := 0;
  v_denegado boolean := false;
begin
  if not exists (select 1 from public.users where id = v_owner) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | faltan los fixtures: carga supabase/tests/fixtures.sql';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  insert into public.email_suppressions (email, reason, source)
  values ('suprimido@preview.test', 'manual', 'probe')
  on conflict (email) do nothing;

  select count(*) into v_broadcasts_antes from public.email_broadcasts;
  select count(*) into v_notifs_antes from public.notifications;

  v_prev := public.email_broadcast_preview(v_lista);

  -- ── A. Los cinco números ──────────────────────────────────────────────────
  -- 6 pedidas = 1 enviable (dos@) + 1 enviable (uno@) … es decir 2 enviables,
  -- 1 duplicada, 2 inválidas y 1 suprimida. Las cuatro categorías particionan
  -- la lista, así que la suma tiene que dar exactamente las pedidas.
  if (v_prev ->> 'requested')::int <> 6 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A1 requested=%s, se esperaban 6', v_prev ->> 'requested');
  else
    v_out := v_out || ' | A1 requested ok';
  end if;

  if (v_prev ->> 'invalid')::int <> 2 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A2 invalid=%s, se esperaban 2', v_prev ->> 'invalid');
  else
    v_out := v_out || ' | A2 invalid ok';
  end if;

  if (v_prev ->> 'duplicated')::int <> 1 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A3 duplicated=%s, se esperaba 1 (la repetida, no las inválidas)', v_prev ->> 'duplicated');
  else
    v_out := v_out || ' | A3 duplicated ok';
  end if;

  if (v_prev ->> 'suppressed')::int <> 1 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A4 suppressed=%s, se esperaba 1', v_prev ->> 'suppressed');
  else
    v_out := v_out || ' | A4 suppressed ok';
  end if;

  if (v_prev ->> 'deliverable')::int <> 2 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A5 deliverable=%s, se esperaban 2', v_prev ->> 'deliverable');
  else
    v_out := v_out || ' | A5 deliverable ok';
  end if;

  if (v_prev ->> 'invalid')::int + (v_prev ->> 'duplicated')::int
     + (v_prev ->> 'suppressed')::int + (v_prev ->> 'deliverable')::int
     <> (v_prev ->> 'requested')::int then
    v_fail := v_fail + 1;
    v_out := v_out || ' | A6 las categorías no suman las pedidas: alguna dirección se cuenta dos veces o ninguna';
  else
    v_out := v_out || ' | A6 partición ok';
  end if;

  -- ── B. No escribe nada ────────────────────────────────────────────────────
  -- Es la pantalla previa y se pulsa varias veces mientras se corrige la lista.
  select count(*) into v_broadcasts_despues from public.email_broadcasts;
  select count(*) into v_notifs_despues from public.notifications;
  if v_broadcasts_despues <> v_broadcasts_antes or v_notifs_despues <> v_notifs_antes then
    v_fail := v_fail + 1;
    v_out := v_out || ' | B1 la vista previa dejó filas escritas';
  else
    v_out := v_out || ' | B1 sin escritura ok';
  end if;

  -- ── C. Coincide con el encolado ───────────────────────────────────────────
  -- El aserto que da sentido a los demás: previsualizar y enviar tienen que
  -- estar de acuerdo sobre la misma lista.
  v_enq := public.email_broadcast_enqueue(
    'Probe vista previa', 'Asunto', 'Cuerpo', v_lista, true
  );

  if (v_enq ->> 'queued')::int <> (v_prev ->> 'deliverable')::int then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | C1 la vista previa dijo %s enviables y se encolaron %s',
      v_prev ->> 'deliverable', v_enq ->> 'queued');
  else
    v_out := v_out || ' | C1 previa = encolado ok';
  end if;

  if (v_enq ->> 'duplicated')::int <> (v_prev ->> 'duplicated')::int
     or (v_enq ->> 'invalid')::int <> (v_prev ->> 'invalid')::int
     or (v_enq ->> 'suppressed')::int <> (v_prev ->> 'suppressed')::int then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C2 los descartes de la vista previa no coinciden con los del encolado';
  else
    v_out := v_out || ' | C2 descartes coinciden ok';
  end if;

  -- ── D. Una lista sin nadie a quien enviar no crea campaña ─────────────────
  -- Si se dejara pasar, el historial mostraría una campaña con 0 enviados y el
  -- nombre sugeriría que salió algo.
  select count(*) into v_broadcasts_antes from public.email_broadcasts;
  begin
    perform public.email_broadcast_enqueue(
      'Probe lista muerta', 'Asunto', 'Cuerpo',
      array['no-es-correo', 'suprimido@preview.test'], true
    );
    v_fail := v_fail + 1;
    v_out := v_out || ' | D1 una lista sin enviables creó una campaña';
  exception when others then
    select count(*) into v_broadcasts_despues from public.email_broadcasts;
    if v_broadcasts_despues <> v_broadcasts_antes then
      v_fail := v_fail + 1;
      v_out := v_out || ' | D1 la campaña vacía quedó escrita pese al error';
    else
      v_out := v_out || ' | D1 lista sin enviables rechazada ok';
    end if;
  end;

  -- ── E. Sin el permiso, ni contar ──────────────────────────────────────────
  -- Contar una lista contra `email_suppressions` es una consulta de pertenencia:
  -- de una en una revela quién se dio de baja. Por eso pide `email:broadcast` y
  -- no `email:read`.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sinpermiso, 'role', 'authenticated')::text, true);
  begin
    perform public.email_broadcast_preview(array['otro@preview.test']);
  exception when insufficient_privilege then
    v_denegado := true;
  end;
  if not v_denegado then
    v_fail := v_fail + 1;
    v_out := v_out || ' | E1 alguien sin email:broadcast pudo previsualizar';
  else
    v_out := v_out || ' | E1 denegación ok';
  end if;

  -- ── F. `anon` no puede previsualizar ni normalizar ────────────────────────
  if has_function_privilege('anon', 'public.email_broadcast_preview(text[])', 'execute') then
    v_fail := v_fail + 1;
    v_out := v_out || ' | F1 anon puede previsualizar campañas';
  else
    v_out := v_out || ' | F1 anon sin execute ok';
  end if;

  if has_function_privilege('anon', 'public.email_broadcast_normalize(text[])', 'execute')
     or has_function_privilege('authenticated', 'public.email_broadcast_normalize(text[])', 'execute') then
    v_fail := v_fail + 1;
    v_out := v_out || ' | F2 el normalizador interno quedó expuesto al cliente';
  else
    v_out := v_out || ' | F2 normalizador interno ok';
  end if;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
