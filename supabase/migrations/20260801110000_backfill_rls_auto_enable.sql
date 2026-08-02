-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: public.rls_auto_enable() y el event trigger `ensure_rls`.
--
-- Ambos existían solo en el proyecto desplegado: alguien los creó a mano y
-- ninguna migración los reproducía. El job de replay lo destapó al fallar en
-- `20260801120000_p0_revoke_public_execute_security_definer.sql`, que revoca
-- privilegios sobre `public.rls_auto_enable()`:
--
--     ERROR: function public.rls_auto_enable() does not exist (SQLSTATE 42883)
--
-- Consecuencia real del drift: un entorno nuevo construido desde las migraciones
-- se quedaba SIN la red de seguridad que activa RLS en cada tabla nueva de
-- `public`, y además el historial no se podía reproducir a partir de ese punto.
-- No es cosmético: es un control de seguridad que no viajaba.
--
-- El timestamp es deliberadamente anterior a 20260801120000 para que en una base
-- vacía la función exista antes de que aquella migración la referencie. En el
-- remoto los objetos ya están, así que esta migración se registra con
-- `supabase migration repair --status applied 20260801110000` y las guardas de
-- abajo la dejan idempotente por si se aplica igualmente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Definición copiada VERBATIM del proyecto desplegado (pg_proc.prosrc).
-- No reformatear: Postgres guarda el texto literal, así que cualquier cambio
-- de mayúsculas o sangría hace que `db diff` la reporte como drift eternamente.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- Los event triggers no admiten `create or replace`; se crea solo si falta para
-- no tocar el que ya está vivo en el remoto.
do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end;
$$;
