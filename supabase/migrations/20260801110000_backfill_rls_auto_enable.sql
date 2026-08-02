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

-- Definición tomada literalmente del proyecto desplegado (pg_get_functiondef).
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
     if cmd.schema_name is not null
        and cmd.schema_name in ('public')
        and cmd.schema_name not in ('pg_catalog', 'information_schema')
        and cmd.schema_name not like 'pg_toast%'
        and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)',
          cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
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
