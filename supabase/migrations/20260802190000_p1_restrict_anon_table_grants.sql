-- ─────────────────────────────────────────────────────────────────────────────
-- P1 — Restringir los grants de tabla del rol `anon` a la superficie pública real.
--
-- Lo medido en el remoto antes de tocar nada:
--   * 52 tablas de `public` con GRANT ALL para `anon` (363 grants), incluidos
--     INSERT, UPDATE, DELETE y TRUNCATE sobre `users`, `applications`,
--     `audit_logs`, `membership_payments` y el resto.
--   * 5 políticas RLS dirigidas explícitamente a `anon`, todas de SELECT.
--
-- Es decir: la superficie pública deliberada son 5 tablas de solo lectura, y el
-- resto son los default privileges que Supabase concede a nivel de plataforma.
-- Ninguna tabla alcanzable por `anon` carece de RLS —eso ya se verificó—, así
-- que hoy RLS es lo único que separa a un visitante anónimo de esas tablas.
--
-- Por qué no basta con RLS:
--   * **TRUNCATE no pasa por RLS.** No es alcanzable desde PostgREST, así que es
--     exposición latente más que explotable, pero no tiene por qué estar ahí.
--     Es el mismo hallazgo que cerró TASK-261 en `app_error_logs`.
--   * Un grant sin política que lo respalde es peso muerto: revocarlo no cambia
--     el comportamiento de la aplicación y elimina la superficie por debajo de
--     RLS. Deja de haber "una policy mal escrita" entre un anónimo y los datos.
--
-- Verificado antes de revocar que ningún camino público lee estas tablas como
-- `anon`: `/donate` opera por RPC `SECURITY DEFINER`, y las dos lecturas
-- directas de `donations` en el cliente son de administrador y de usuario
-- autenticado. `authenticated` no se toca en esta migración.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Retirar todo el acceso de tabla de `anon` ─────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon', r.tablename);
  end loop;
end;
$$;

-- ── 2. Devolver únicamente la superficie pública deliberada ──────────────────
-- Cada una tiene una política `..._readable_to_anon` / `_select_active` que
-- existe a propósito: el formulario de membresía necesita la jerarquía de
-- iglesias antes de iniciar sesión, y `/donate` necesita los montos.
grant select on public.church_unions to anon;
grant select on public.church_associations to anon;
grant select on public.church_districts to anon;
grant select on public.churches to anon;
grant select on public.donation_amount_options to anon;

-- ── 3. Cortar la fuente para tablas futuras ──────────────────────────────────
-- Mismo criterio que la Fase A aplicó a las funciones: sin esto, cada tabla
-- nueva vuelve a nacer con GRANT ALL para `anon`. Consecuencia intencional para
-- el equipo: una tabla nueva que deba leerse sin sesión necesita su
-- `grant select ... to anon` explícito, o fallará en desarrollo.
alter default privileges in schema public revoke all on tables from anon;
