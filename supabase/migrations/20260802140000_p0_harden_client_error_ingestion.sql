-- ─────────────────────────────────────────────────────────────────────────────
-- P0 TASK-261 — Proteger la ingesta anónima de app_error_logs.
--
-- Estado previo: `anon` insertaba directamente en la tabla vía PostgREST, sin
-- límite de tamaño, sin rate limit, sin deduplicación, sin redacción y sin
-- retención. Además los grants de tabla para `anon` incluían INSERT, UPDATE,
-- DELETE y TRUNCATE (el `grant all` por defecto de Supabase). DELETE y UPDATE
-- quedaban contenidos por RLS, pero TRUNCATE **no pasa por RLS**; no es
-- alcanzable desde PostgREST, así que era exposición latente más que explotable.
--
-- El cliente deja de escribir en la tabla. Toda la ingesta pasa por un RPC que
-- aplica los cinco controles que pide el criterio de cierre: límites, rate
-- limit, redacción de PII, deduplicación y retención.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Columnas de deduplicación y trazabilidad de repetición ────────────────

alter table public.app_error_logs
  add column if not exists fingerprint text,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists last_seen_at timestamptz not null default timezone('utc', now()),
  add column if not exists client_bucket text;

comment on column public.app_error_logs.fingerprint is
  'Huella de source+code+mensaje+ruta. Un error repetido incrementa occurrence_count en vez de crear filas nuevas.';
comment on column public.app_error_logs.occurrence_count is
  'Veces que se ha visto este error dentro de la ventana de deduplicación.';
comment on column public.app_error_logs.client_bucket is
  'Hash del origen del cliente (IP + user agent). Sirve para el rate limit sin almacenar la IP en claro.';

create index if not exists app_error_logs_fingerprint_idx
  on public.app_error_logs (fingerprint, last_seen_at desc);
create index if not exists app_error_logs_client_bucket_idx
  on public.app_error_logs (client_bucket, created_at desc);

-- ── 2. Redacción de PII ──────────────────────────────────────────────────────
-- Un stack o un mensaje de proveedor puede arrastrar el correo del usuario, un
-- token o un número largo. Se redacta en el momento de escribir: lo que no se
-- guarda no se puede filtrar después.

create or replace function private.redact_pii(p_text text)
returns text
language sql
immutable
as $$
  select case
    when p_text is null then null
    else
      regexp_replace(
        regexp_replace(
          regexp_replace(
            p_text,
            -- Correos electrónicos.
            '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email-redactado]', 'gi'
          ),
          -- JWT y tokens portadores (incluye las claves de Supabase).
          '(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*|[Bb]earer\s+[A-Za-z0-9._-]{16,})',
          '[token-redactado]', 'g'
        ),
        -- Secuencias largas de dígitos: teléfonos, documentos, tarjetas.
        '\d{9,}', '[numero-redactado]', 'g'
      )
  end;
$$;

-- ── 3. Ingesta controlada ────────────────────────────────────────────────────

create or replace function public.log_client_error(
  p_source text,
  p_error_message text,
  p_user_message text,
  p_route text default null,
  p_severity text default 'error',
  p_error_code text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Topes de tamaño. Nada de lo que llega del cliente entra sin recortar.
  c_max_source     constant integer := 120;
  c_max_route      constant integer := 300;
  c_max_code       constant integer := 100;
  c_max_message    constant integer := 2000;
  c_max_user_msg   constant integer := 500;
  c_max_metadata   constant integer := 8000;
  -- Rate limit.
  c_window         constant interval := interval '5 minutes';
  c_max_per_client constant integer := 20;
  c_max_global     constant integer := 500;
  -- Ventana de deduplicación.
  c_dedupe_window  constant interval := interval '60 minutes';

  v_uid uuid := auth.uid();
  v_headers jsonb;
  v_bucket text;
  v_source text;
  v_route text;
  v_code text;
  v_message text;
  v_user_message text;
  v_severity text;
  v_metadata jsonb;
  v_fingerprint text;
  v_existing uuid;
  v_recent integer;
  v_id uuid;
begin
  -- Identidad del cliente para el rate limit. Se guarda hasheada: sirve para
  -- agrupar sin conservar la IP en claro.
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;

  v_bucket := encode(
    extensions.digest(
      coalesce(v_uid::text, '') || '|' ||
      coalesce(v_headers ->> 'x-forwarded-for', 'sin-ip') || '|' ||
      left(coalesce(v_headers ->> 'user-agent', 'sin-ua'), 120),
      'sha256'
    ),
    'hex'
  );

  -- Rate limit por cliente y cortafuegos global. Se cuenta sobre la propia
  -- tabla, que ya tiene retención, en lugar de mantener otro contador.
  select count(*) into v_recent
  from public.app_error_logs
  where client_bucket = v_bucket
    and created_at > timezone('utc', now()) - c_window;

  if v_recent >= c_max_per_client then
    return null;
  end if;

  select count(*) into v_recent
  from public.app_error_logs
  where created_at > timezone('utc', now()) - c_window;

  if v_recent >= c_max_global then
    return null;
  end if;

  -- Normalización, recorte y redacción.
  v_source       := left(coalesce(nullif(trim(p_source), ''), 'desconocido'), c_max_source);
  v_route        := left(private.redact_pii(nullif(trim(p_route), '')), c_max_route);
  v_code         := left(nullif(trim(p_error_code), ''), c_max_code);
  v_message      := left(private.redact_pii(coalesce(nullif(trim(p_error_message), ''), 'sin mensaje')), c_max_message);
  v_user_message := left(private.redact_pii(coalesce(nullif(trim(p_user_message), ''), 'sin mensaje')), c_max_user_msg);

  v_severity := lower(coalesce(nullif(trim(p_severity), ''), 'error'));
  if v_severity not in ('info', 'warning', 'error', 'fatal') then
    v_severity := 'error';
  end if;

  -- El metadata se redacta entero y se descarta si excede el tope, dejando
  -- constancia del descarte en lugar de guardar un blob arbitrario.
  v_metadata := coalesce(p_metadata, '{}'::jsonb);
  if length(v_metadata::text) > c_max_metadata then
    v_metadata := jsonb_build_object(
      'truncated', true,
      'originalSize', length(v_metadata::text)
    );
  else
    v_metadata := private.redact_pii(v_metadata::text)::jsonb;
  end if;

  v_fingerprint := encode(
    extensions.digest(
      v_source || '|' || coalesce(v_code, '') || '|' || left(v_message, 200) || '|' || coalesce(v_route, ''),
      'sha256'
    ),
    'hex'
  );

  -- Deduplicación: el mismo error repetido suma en su fila en vez de generar
  -- una nueva. Es el control de volumen que más aporta en la práctica.
  select id into v_existing
  from public.app_error_logs
  where fingerprint = v_fingerprint
    and last_seen_at > timezone('utc', now()) - c_dedupe_window
    and is_resolved = false
  order by last_seen_at desc
  limit 1;

  if v_existing is not null then
    update public.app_error_logs
    set occurrence_count = occurrence_count + 1,
        last_seen_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where id = v_existing;
    return v_existing;
  end if;

  insert into public.app_error_logs (
    user_id, route, source, severity, error_code, error_message, user_message,
    metadata, fingerprint, client_bucket, last_seen_at
  )
  values (
    -- Nunca se acepta el user_id del cliente: se toma de la sesión.
    v_uid, v_route, v_source, v_severity, v_code, v_message, v_user_message,
    v_metadata, v_fingerprint, v_bucket, timezone('utc', now())
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_client_error(text, text, text, text, text, text, jsonb)
  from public;
grant execute on function public.log_client_error(text, text, text, text, text, text, jsonb)
  to anon, authenticated;

-- ── 4. El cliente deja de escribir en la tabla ───────────────────────────────
-- Con la ingesta detrás del RPC, ningún rol de cliente necesita escritura
-- directa. Se conservan SELECT y UPDATE para `authenticated` porque la consola
-- de /admin de errores los usa, y la RLS ya los limita a admins de plataforma.

revoke insert, delete, truncate, references, trigger on public.app_error_logs from anon, authenticated;
revoke select, update on public.app_error_logs from anon;

drop policy if exists app_error_logs_insertable_by_clients on public.app_error_logs;

-- ── 5. Retención ─────────────────────────────────────────────────────────────

create or replace function private.purge_app_error_logs(p_retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.app_error_logs
  where created_at < timezone('utc', now()) - make_interval(days => greatest(coalesce(p_retention_days, 90), 7));

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

do $$
begin
  perform cron.unschedule('purge-app-error-logs');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'purge-app-error-logs',
  '30 3 * * *',
  $cron$select private.purge_app_error_logs(90);$cron$
);
