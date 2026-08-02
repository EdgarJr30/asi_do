-- TASK-260 [P1][Datos] Reducir amplificacion y aplicar retencion a audit_logs.
--
-- Medicion previa (proyecto jgmojkzthfogynqixkob, 2026-08-02):
--   total 21 MB / heap 5280 kB / indices 9408 kB / toast 6960 kB / 3226 filas
--   request_headers 4304 kB, payload 1986 kB, new_record 1634 kB,
--   old_record 695 kB, jwt_claims 693 kB, changed_fields 437 kB
--
-- Cuatro problemas resueltos aqui:
--
--   1. FUGA DE CREDENCIALES. request_headers guardaba el header `authorization`
--      completo en 2768 filas: 2627 access tokens de usuario y, peor, 141 filas
--      con la service_role key en claro (HS256, exp 2036). Cualquier portador de
--      `audit_log:read` podia leer la tabla y quedarse con una llave que ignora
--      RLS. jwt_claims arrastraba ademas email, phone y los metadata del usuario.
--
--   2. AMPLIFICACION. Cada evento escribia la fila vieja y la nueva tres veces:
--      dentro de `payload` y otra vez en `old_record`/`new_record`. Y en un
--      UPDATE se copiaba la fila entera aunque solo cambiara un campo.
--
--   3. DATOS SENSIBLES SIN REDACTAR. Los snapshots copiaban tokens de invitacion,
--      llaves de push, numeros de cuenta y el payload crudo de AZUL (AuthHash).
--
--   4. SIN RETENCION. Nada purgaba ni movia la tabla.
--
-- Politica de eventos y campos (criterio de cierre 1):
--   * Se auditan TODAS las tablas de public, sin excepcion. El event trigger
--     `audit_auto_attach` sigue enganchando las tablas nuevas.
--   * De cada evento se persiste siempre: quien (actor_user_id, actor_membership_id),
--     cuando (created_at), sobre que (schema_name, entity_type, record_id),
--     que operacion (event_type), que campos cambiaron (changed_fields),
--     y contexto minimo de la peticion (ip, pais, user agent, origen).
--   * Del contenido de la fila se persiste solo el delta: en UPDATE unicamente
--     los campos que cambiaron, en INSERT/DELETE la fila completa. Siempre redactado.
--   * Las tablas que ya son su propio registro historico (ver
--     `private.audit_log_metadata_only_tables`) generan el evento pero no duplican
--     el snapshot: el contenido ya vive en la tabla de origen.
--
-- Retencion en dos niveles (criterio de cierre 4): nada se borra.
--   * public.audit_logs   = ventana caliente. Expuesta por PostgREST bajo RLS.
--   * private.audit_logs_archive = archivo frio. El esquema `private` no tiene
--     USAGE para `anon` ni `authenticated`, asi que PostgREST no puede alcanzarlo:
--     solo se consulta con una conexion directa a la base o con service_role SQL.
--   Corte: 180 dias para los eventos de trigger, 730 para los eventos de negocio
--   escritos a mano por las RPC (aprobaciones, pagos, RBAC, overrides de acceso).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helpers de redaccion
-- ─────────────────────────────────────────────────────────────────────────────

-- Headers que vale la pena conservar. Allowlist a proposito: lo que no este
-- aqui no se guarda, de modo que un header nuevo jamas entra por descuido.
create or replace function private.audit_allowed_headers()
returns text[]
language sql
immutable
as $$
  select array[
    'cf-connecting-ip',
    'cf-ipcountry',
    'x-forwarded-for',
    'user-agent',
    'x-client-info',
    'x-application-name',
    'origin',
    'referer',
    'accept-language'
  ]::text[]
$$;

-- Claims de sesion utiles para forense. Fuera quedan email, phone,
-- user_metadata, app_metadata y api_key_hash: son PII o ruido, y la identidad
-- ya esta en actor_user_id.
create or replace function private.audit_allowed_claims()
returns text[]
language sql
immutable
as $$
  select array['sub', 'role', 'session_id', 'aal', 'is_anonymous']::text[]
$$;

-- Columnas que nunca deben viajar a un snapshot de auditoria, en ninguna tabla.
create or replace function private.audit_sensitive_columns()
returns text[]
language sql
immutable
as $$
  select array[
    'token',              -- authority_request_invitations: canjea autoridad
    'claim_token',
    'auth_session_id',
    'account_number',
    'auth_key',           -- push_subscriptions: claves de cifrado web push
    'p256dh_key',
    'endpoint',
    'password',
    'password_hash',
    'secret',
    'secret_value',
    'api_key',
    'access_token',
    'refresh_token'
  ]::text[]
$$;

-- Claves sensibles anidadas dentro de payloads de pasarela (AZUL).
create or replace function private.audit_sensitive_payload_keys()
returns text[]
language sql
immutable
as $$
  select array[
    'AuthHash',
    'CardNumber',
    'DataVaultToken',
    'DataVaultExpiration',
    'DataVaultBrand',
    'CVC',
    'Expiration'
  ]::text[]
$$;

-- Tablas que ya son su propio registro historico: se audita el evento, no se
-- duplica el contenido de la fila.
create or replace function private.audit_log_metadata_only_tables()
returns text[]
language sql
immutable
as $$
  select array[
    'app_error_logs',
    'user_access_logs',
    'notifications',
    'notification_deliveries',
    'notification_delivery_logs',
    'stress_harness_runs'
  ]::text[]
$$;

create or replace function private.audit_redact_headers(headers jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_object_agg(k, headers -> k)
      from unnest(private.audit_allowed_headers()) as k
      where headers ? k
    ),
    '{}'::jsonb
  )
$$;

create or replace function private.audit_redact_claims(claims jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_object_agg(k, claims -> k)
      from unnest(private.audit_allowed_claims()) as k
      where claims ? k
    ),
    '{}'::jsonb
  )
$$;

-- Sustituye el valor por el marcador "[redacted]" en vez de eliminar la clave:
-- asi el auditor sigue viendo QUE campo cambio, sin ver el contenido.
create or replace function private.audit_redact_row(row_data jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when row_data is null then null
    else (
      select jsonb_object_agg(
        e.key,
        case
          when e.key = any (private.audit_sensitive_columns()) and e.value <> 'null'::jsonb
            then '"[redacted]"'::jsonb
          when jsonb_typeof(e.value) = 'object'
            then coalesce(
              (
                select jsonb_object_agg(
                  n.key,
                  case
                    when n.key = any (private.audit_sensitive_payload_keys()) and n.value <> 'null'::jsonb
                      then '"[redacted]"'::jsonb
                    else n.value
                  end
                )
                from jsonb_each(e.value) as n
              ),
              e.value
            )
          else e.value
        end
      )
      from jsonb_each(row_data) as e
    )
  end
$$;

-- Deja en el snapshot unicamente los campos que aparecen en `keys`.
create or replace function private.audit_slice_row(row_data jsonb, keys text[])
returns jsonb
language sql
immutable
as $$
  select case
    when row_data is null then null
    when coalesce(array_length(keys, 1), 0) = 0 then '{}'::jsonb
    else coalesce(
      (
        select jsonb_object_agg(k, row_data -> k)
        from unnest(keys) as k
        where row_data ? k
      ),
      '{}'::jsonb
    )
  end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger de auditoria sin duplicacion y con redaccion
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_id uuid := private.current_user_id();
  new_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  old_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  resolved_record_id uuid := coalesce((new_row ->> 'id')::uuid, (old_row ->> 'id')::uuid);
  resolved_tenant_id uuid := private.resolve_audit_tenant_id(tg_table_name, new_row, old_row);
  changed text[] := private.jsonb_changed_fields(old_row, new_row);
  metadata_only boolean := tg_table_name = any (private.audit_log_metadata_only_tables());
  stored_old jsonb;
  stored_new jsonb;
begin
  if metadata_only then
    -- El contenido ya vive en la tabla de origen; aqui solo el rastro del evento.
    stored_old := null;
    stored_new := null;
  elsif tg_op = 'UPDATE' then
    -- Solo el delta: copiar la fila entera por un campo que cambio era el
    -- grueso de la amplificacion (candidate_profiles/update = 2645 kB).
    stored_old := private.audit_redact_row(private.audit_slice_row(old_row, changed));
    stored_new := private.audit_redact_row(private.audit_slice_row(new_row, changed));
  else
    stored_old := private.audit_redact_row(old_row);
    stored_new := private.audit_redact_row(new_row);
  end if;

  insert into public.audit_logs (
    actor_user_id,
    actor_membership_id,
    tenant_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    source,
    schema_name,
    record_id,
    changed_fields,
    old_record,
    new_record,
    request_headers,
    jwt_claims,
    transaction_id,
    created_at
  )
  values (
    actor_id,
    private.current_membership_id(resolved_tenant_id),
    resolved_tenant_id,
    lower(tg_op),
    tg_table_name,
    coalesce(resolved_record_id::text, old_row ->> 'id', new_row ->> 'id', 'unknown'),
    -- payload queda vacio a proposito: schema_name, table_name, changed_fields,
    -- old_record y new_record ya tienen columna propia. Se conserva la columna
    -- porque las RPC que escriben a mano si la usan.
    '{}'::jsonb,
    'db_trigger',
    tg_table_schema,
    resolved_record_id,
    changed,
    stored_old,
    stored_new,
    private.audit_redact_headers(private.current_request_headers()),
    private.audit_redact_claims(private.current_jwt_claims()),
    txid_current(),
    timezone('utc', now())
  );

  return coalesce(new, old);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Archivo frio en el esquema private (inalcanzable desde el frontend)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists private.audit_logs_archive (
  like public.audit_logs including defaults
);

alter table private.audit_logs_archive
  add column if not exists archived_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.audit_logs_archive'::regclass
      and contype = 'p'
  ) then
    alter table private.audit_logs_archive
      add constraint audit_logs_archive_pkey primary key (id);
  end if;
end
$$;

create index if not exists audit_logs_archive_created_idx
  on private.audit_logs_archive (created_at desc);
create index if not exists audit_logs_archive_record_idx
  on private.audit_logs_archive (record_id, created_at desc);

-- Cinturon y tirantes: el esquema private ya carece de USAGE para anon y
-- authenticated, pero dejamos el revoke explicito por si alguna migracion
-- futura lo concede a nivel de esquema.
revoke all on private.audit_logs_archive from public;
revoke all on private.audit_logs_archive from anon;
revoke all on private.audit_logs_archive from authenticated;

alter table private.audit_logs_archive enable row level security;

comment on table private.audit_logs_archive is
  'Archivo frio de audit_logs (TASK-260). Nada se borra: los eventos que salen de '
  'la ventana caliente se mueven aqui. Solo consultable por SQL directo o '
  'service_role; PostgREST no expone el esquema private.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Job de archivado
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function private.audit_log_retention_interval(p_source text)
returns interval
language sql
immutable
as $$
  select case when p_source = 'db_trigger' then interval '180 days' else interval '730 days' end
$$;

-- Mueve un lote de la ventana caliente al archivo. Devuelve cuantas filas movio.
create or replace function private.archive_expired_audit_logs(p_batch integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moved integer;
begin
  with expired as (
    select a.id
    from public.audit_logs a
    -- Cota externa constante para que audit_logs_created_at_idx pueda podar;
    -- la funcion por-source afina despues sobre el subconjunto ya reducido.
    where a.created_at < timezone('utc', now()) - interval '180 days'
      and a.created_at < timezone('utc', now()) - private.audit_log_retention_interval(a.source)
    order by a.created_at
    limit greatest(p_batch, 1)
    for update skip locked
  ),
  moved as (
    delete from public.audit_logs a
    using expired e
    where a.id = e.id
    returning a.*
  )
  insert into private.audit_logs_archive
  select m.*, timezone('utc', now())
  from moved m;

  get diagnostics v_moved = row_count;
  return v_moved;
end;
$$;

-- Envoltura que el cron invoca: agota el trabajo pendiente en lotes, con tope
-- para no monopolizar la conexion del scheduler.
create or replace function private.run_audit_log_archival()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch integer;
  v_total integer := 0;
  v_rounds integer := 0;
begin
  loop
    v_batch := private.archive_expired_audit_logs(5000);
    v_total := v_total + v_batch;
    v_rounds := v_rounds + 1;
    exit when v_batch = 0 or v_rounds >= 20;
  end loop;

  return v_total;
end;
$$;

revoke all on function private.archive_expired_audit_logs(integer) from public;
revoke all on function private.run_audit_log_archival() from public;

do $$
begin
  perform cron.unschedule('archive-audit-logs');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'archive-audit-logs',
  '40 3 * * *',
  $cron$select private.run_audit_log_archival();$cron$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Saneamiento de las filas ya escritas
-- ─────────────────────────────────────────────────────────────────────────────

-- 5.1 Purga de credenciales. Prioritario: aqui viven los 2768 bearer tokens y
--     las 141 copias de la service_role key.
update public.audit_logs
set request_headers = private.audit_redact_headers(request_headers)
where request_headers <> private.audit_redact_headers(request_headers);

update public.audit_logs
set jwt_claims = private.audit_redact_claims(jwt_claims)
where jwt_claims <> private.audit_redact_claims(jwt_claims);

-- 5.2 Elimina la copia duplicada que vivia dentro de payload.
update public.audit_logs
set payload = '{}'::jsonb
where source = 'db_trigger'
  and (payload ? 'new_record' or payload ? 'old_record');

-- 5.3 Reduce los UPDATE historicos al delta y redacta los snapshots existentes.
update public.audit_logs
set
  old_record = private.audit_redact_row(private.audit_slice_row(old_record, changed_fields)),
  new_record = private.audit_redact_row(private.audit_slice_row(new_record, changed_fields))
where event_type = 'update'
  and source = 'db_trigger'
  and (old_record is not null or new_record is not null);

update public.audit_logs
set
  old_record = private.audit_redact_row(old_record),
  new_record = private.audit_redact_row(new_record)
where event_type <> 'update'
  and source = 'db_trigger'
  and (old_record is not null or new_record is not null);

-- 5.4 Las tablas de metadata-only pierden el snapshot historico: su contenido
--     sigue estando en la tabla de origen.
update public.audit_logs
set old_record = null, new_record = null
where source = 'db_trigger'
  and entity_type = any (private.audit_log_metadata_only_tables())
  and (old_record is not null or new_record is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Indices segun uso real
-- ─────────────────────────────────────────────────────────────────────────────
--
-- pg_stat_user_indexes al 2026-08-02:
--   audit_logs_actor_idx         719 scans  -> se mantiene
--   audit_logs_tenant_idx        395 scans  -> se mantiene
--   audit_logs_event_lookup_idx    4 scans  -> se mantiene (forense por entidad)
--   audit_logs_record_lookup_idx   0 scans  -> se elimina, lo cubre event_lookup
--   audit_logs_source_lookup_idx   0 scans  -> se elimina, source solo tiene 4 valores
-- Se agrega created_at, que es el predicado del job de archivado.

drop index if exists public.audit_logs_source_lookup_idx;
drop index if exists public.audit_logs_record_lookup_idx;

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at);
