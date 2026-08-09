-- Pruebas de deduplicacion, redaccion y retencion de audit_logs (TASK-260).
-- Termina en RAISE EXCEPTION: la transaccion se revierte y no queda ninguna
-- fila de prueba ni en audit_logs ni en el archivo.
do $probe$
declare
  v_out text := '';
  v_authority text;
  v_inv uuid;
  v_flag uuid;
  v_err uuid;
  v_log record;
  v_archived integer;
  v_old uuid := extensions.gen_random_uuid();
  v_still_hot integer;
  v_in_archive integer;
  v_actor uuid;
  v_fail int := 0;
begin
  -- El trigger resuelve el actor desde auth.uid() y audit_logs tiene FK a users,
  -- asi que la sesion simulada debe apuntar a un usuario real. Actor fijo del
  -- fixture: `order by created_at limit 1` dependia de quien se hubiera
  -- registrado primero, y sobre base vacia no habia ninguno.
  v_actor := 'f1000000-0000-4000-a000-000000000001';

  if not exists (select 1 from public.users where id = v_actor) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | falta el fixture %: carga supabase/tests/fixtures.sql', v_actor;
  end if;

  -- Simula una peticion real de PostgREST: headers con credenciales y claims con PII.
  perform set_config('request.headers', json_build_object(
    'authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secreto.firma',
    'apikey', 'eyJhbGciOiJIUzI1NiJ9.llave.firma',
    'cookie', 'sb-access-token=no-debe-quedar',
    'cf-connecting-ip', '190.80.1.1',
    'user-agent', 'ProbeAgent/1.0'
  )::text, true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_actor::text,
    'role', 'authenticated',
    'email', 'probe@example.com',
    'phone', '8095551234',
    'user_metadata', json_build_object('full_name', 'Probe User')
  )::text, true);

  -- ── 1. Redaccion de credenciales y PII del contexto de peticion ───────────
  insert into public.feature_flags (code, description, is_enabled)
  values ('probe.audit.flag', 'bandera de prueba', false)
  returning id into v_flag;

  select * into v_log from public.audit_logs
  where entity_type = 'feature_flags' and record_id = v_flag and event_type = 'insert';

  if (v_log.request_headers ? 'authorization')
     or (v_log.request_headers ? 'apikey')
     or (v_log.request_headers ? 'cookie')
     or v_log.request_headers ->> 'cf-connecting-ip' is distinct from '190.80.1.1'
     or v_log.request_headers ->> 'user-agent' is distinct from 'ProbeAgent/1.0'
     or (v_log.jwt_claims ?| array['email', 'phone', 'user_metadata'])
     or not (v_log.jwt_claims ? 'sub') then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format('1) contexto: sin_authorization=%s sin_apikey=%s sin_cookie=%s ip_conservada=%s ua_conservado=%s claims_sin_pii=%s claims_con_sub=%s',
    not (v_log.request_headers ? 'authorization'),
    not (v_log.request_headers ? 'apikey'),
    not (v_log.request_headers ? 'cookie'),
    v_log.request_headers ->> 'cf-connecting-ip' = '190.80.1.1',
    v_log.request_headers ->> 'user-agent' = 'ProbeAgent/1.0',
    not (v_log.jwt_claims ?| array['email', 'phone', 'user_metadata']),
    v_log.jwt_claims ? 'sub');

  -- ── 2. payload ya no duplica old_record / new_record ──────────────────────
  if v_log.payload is distinct from '{}'::jsonb or not (v_log.new_record ? 'code') then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format(' | 2) sin duplicacion: payload_vacio=%s new_record_presente=%s',
    v_log.payload = '{}'::jsonb,
    v_log.new_record ? 'code');

  -- ── 3. UPDATE guarda solo el delta, no la fila completa ───────────────────
  update public.feature_flags set is_enabled = true where id = v_flag;

  select * into v_log from public.audit_logs
  where entity_type = 'feature_flags' and record_id = v_flag and event_type = 'update';

  -- El delta es el corazon de la politica: si `new_record` trae campos que no
  -- cambiaron, el log deja de ser un delta redactado y pasa a ser una copia.
  if (v_log.new_record ? 'code')
     or v_log.old_record ->> 'is_enabled' is distinct from 'false'
     or v_log.new_record ->> 'is_enabled' is distinct from 'true' then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format(' | 3) delta: campos_new=%s changed=%s solo_cambiados=%s valores=%s->%s',
    (select count(*) from jsonb_object_keys(v_log.new_record)),
    v_log.changed_fields,
    -- new_record no debe traer campos que no cambiaron (p.ej. `code`)
    not (v_log.new_record ? 'code'),
    v_log.old_record ->> 'is_enabled',
    v_log.new_record ->> 'is_enabled');

  -- ── 4. Redaccion de columnas sensibles en el snapshot ─────────────────────
  v_authority := 'pastoral';

  insert into public.authority_request_invitations (token, authority_type, target_email, expires_at)
  values ('token-secreto-que-canjea-autoridad', v_authority, 'probe@example.com',
          timezone('utc', now()) + interval '7 days')
  returning id into v_inv;

  select * into v_log from public.audit_logs
  where entity_type = 'authority_request_invitations' and record_id = v_inv;

  -- El token canjea autoridad: si sobrevive en el snapshot, cualquiera con
  -- lectura de audit_logs puede escalar privilegios.
  if v_log.new_record ->> 'token' = 'token-secreto-que-canjea-autoridad'
     or v_log.new_record ->> 'target_email' is distinct from 'probe@example.com' then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format(' | 4) redaccion: token=%s campo_visible=%s email_conservado=%s',
    v_log.new_record ->> 'token',
    v_log.new_record ? 'token',
    v_log.new_record ->> 'target_email' = 'probe@example.com');

  -- ── 5. Tablas que ya son su propio log: evento si, snapshot no ────────────
  insert into public.app_error_logs (source, error_message, user_message)
  values ('probe.audit', 'error de prueba', 'algo salio mal')
  returning id into v_err;

  select * into v_log from public.audit_logs
  where entity_type = 'app_error_logs' and record_id = v_err;

  if v_log.id is null
     or v_log.new_record is not null or v_log.old_record is not null
     or coalesce(array_length(v_log.changed_fields, 1), 0) = 0 then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format(' | 5) metadata-only: evento_registrado=%s sin_snapshot=%s changed_fields=%s',
    v_log.id is not null,
    v_log.new_record is null and v_log.old_record is null,
    coalesce(array_length(v_log.changed_fields, 1), 0) > 0);

  -- ── 6. El job de archivado mueve, no borra ────────────────────────────────
  insert into public.audit_logs (id, event_type, entity_type, entity_id, source, created_at)
  values (v_old, 'update', 'probe_retencion', 'x', 'db_trigger',
          timezone('utc', now()) - interval '200 days');

  v_archived := private.archive_expired_audit_logs(100);

  select count(*) into v_still_hot from public.audit_logs where id = v_old;
  select count(*) into v_in_archive from private.audit_logs_archive where id = v_old;

  if v_archived < 1 or v_still_hot <> 0 or v_in_archive <> 1 then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format(' | 6) archivado: movidas=%s fuera_de_caliente=%s en_archivo=%s',
    v_archived, v_still_hot = 0, v_in_archive = 1);

  -- ── 7. Una fila reciente NO se archiva ────────────────────────────────────
  select count(*) into v_still_hot from public.audit_logs where record_id = v_flag;
  if v_still_hot < 1 then v_fail := v_fail + 1; end if;
  v_out := v_out || format(' | 7) ventana caliente intacta: filas_recientes=%s', v_still_hot);

  -- ── 8. El archivo es inalcanzable desde el frontend ───────────────────────
  -- `private` es lo que hace el archivo inalcanzable por PostgREST. Si algun rol
  -- del cliente gana USAGE, el archivo frio pasa a ser superficie publica.
  if has_schema_privilege('authenticated', 'private', 'USAGE')
     or has_schema_privilege('anon', 'private', 'USAGE') then
    v_fail := v_fail + 1;
  end if;
  v_out := v_out || format(' | 8) aislamiento: usage_authenticated=%s usage_anon=%s',
    has_schema_privilege('authenticated', 'private', 'USAGE'),
    has_schema_privilege('anon', 'private', 'USAGE'));

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
