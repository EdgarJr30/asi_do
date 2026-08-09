-- Pruebas de abuso de la ingesta de errores (TASK-261).
-- Termina en RAISE EXCEPTION: la transacción se revierte y no queda ninguna
-- fila de prueba en app_error_logs.
do $probe$
declare
  v_out text := '';
  v_id uuid;
  v_id2 uuid;
  v_msg text;
  v_meta jsonb;
  v_occ integer;
  v_n integer;
  v_user uuid;
  i integer;
  v_fail int := 0;
begin
  -- ── 1. Redacción de PII ───────────────────────────────────────────────────
  v_id := public.log_client_error(
    'probe.pii',
    'fallo al enviar a juan.perez@example.com con Bearer abcdefghijklmnopqrst y tel 8095551234',
    'algo salió mal',
    '/probe',
    'error',
    'PII',
    jsonb_build_object('detalle', 'contacto maria@correo.do')
  );
  select error_message, metadata into v_msg, v_meta from public.app_error_logs where id = v_id;
  if v_msg like '%example.com%' or v_msg like '%abcdefghijklmnopqrst%'
     or v_msg like '%8095551234%' or v_meta::text like '%maria@correo.do%' then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format('1) PII redactada: email=%s token=%s tel=%s meta=%s',
    (v_msg not like '%example.com%'),
    (v_msg not like '%abcdefghijklmnopqrst%'),
    (v_msg not like '%8095551234%'),
    (v_meta::text not like '%maria@correo.do%'));

  -- ── 2. Deduplicación: el mismo error no crea filas nuevas ─────────────────
  v_id2 := public.log_client_error('probe.dup', 'error repetido', 'mensaje', '/probe', 'error', 'D1', '{}'::jsonb);
  perform public.log_client_error('probe.dup', 'error repetido', 'mensaje', '/probe', 'error', 'D1', '{}'::jsonb);
  perform public.log_client_error('probe.dup', 'error repetido', 'mensaje', '/probe', 'error', 'D1', '{}'::jsonb);
  select count(*), max(occurrence_count) into v_n, v_occ
  from public.app_error_logs where source = 'probe.dup';
  if v_n <> 1 or v_occ <> 3 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 2) dedupe: filas=%s occurrences=%s (esperado 1/3)', v_n, v_occ);

  -- ── 3. Límites de tamaño ──────────────────────────────────────────────────
  v_id := public.log_client_error(
    repeat('s', 500),
    repeat('m', 50000),
    repeat('u', 5000),
    repeat('r', 2000),
    'error',
    repeat('c', 500),
    jsonb_build_object('blob', repeat('x', 20000))
  );
  select length(error_message), metadata into v_n, v_meta from public.app_error_logs where id = v_id;
  if v_n > 2000 or coalesce(v_meta ->> 'truncated', 'false') <> 'true' then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format(' | 3) limites: msg=%s (<=2000) meta_truncado=%s',
    v_n, coalesce(v_meta ->> 'truncated', 'false'));

  -- ── 4. Severidad inválida se normaliza ────────────────────────────────────
  v_id := public.log_client_error('probe.sev', 'x', 'y', '/p', 'CATASTROFICO', 'S1', '{}'::jsonb);
  select severity into v_msg from public.app_error_logs where id = v_id;
  if v_msg <> 'error' then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 4) severidad invalida -> %s (esperado error)', v_msg);

  -- ── 5. No se acepta un user_id falsificado ────────────────────────────────
  -- La función no expone parámetro de usuario: lo toma de auth.uid(), que en
  -- esta sesión es null. Una fila anónima nunca queda atribuida a un usuario.
  select user_id into v_user from public.app_error_logs where id = v_id;
  if v_user is not null then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 5) user_id anonimo=%s (esperado null)', coalesce(v_user::text, 'null'));

  -- ── 6. Rate limit por cliente ─────────────────────────────────────────────
  -- Mismo bucket (misma sesión) y mensajes distintos para esquivar el dedupe:
  -- a partir del tope la función deja de insertar y devuelve null.
  for i in 1..30 loop
    perform public.log_client_error('probe.rate', 'error numero ' || i, 'm', '/p', 'error', 'R' || i, '{}'::jsonb);
  end loop;
  select count(*) into v_n from public.app_error_logs where source = 'probe.rate';
  if v_n > 20 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 6) rate limit: 30 intentos -> %s filas (esperado <=20)', v_n);

  -- ── 7. La retención borra lo viejo ────────────────────────────────────────
  update public.app_error_logs
  set created_at = timezone('utc', now()) - interval '200 days'
  where source = 'probe.dup';
  select private.purge_app_error_logs(90) into v_n;
  if v_n < 1 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 7) retencion borro %s fila(s) antiguas (esperado >=1)', v_n);

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
