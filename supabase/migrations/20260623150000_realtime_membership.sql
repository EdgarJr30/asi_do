-- Habilita Supabase Realtime para el pipeline de membresía, de modo que el panel
-- del miembro (/account/membership) se actualice EN VIVO al pagar, al revisar la
-- solicitud y al activar la cuenta, sin recargar la app.
--
-- Convención (docs/architecture/REALTIME.md): React Query es la fuente de verdad;
-- Realtime solo dispara invalidateQueries / refresh de sesión en el cliente.
-- La seguridad la sigue dando RLS: cada cliente recibe solo los eventos de las
-- filas que ya puede leer (su propio pago, su solicitud, su usuario).

do $$
declare
  tbl text;
  realtime_tables text[] := array[
    'membership_payments',
    'institutional_membership_applications',
    'users'
  ];
begin
  foreach tbl in array realtime_tables loop
    -- REPLICA IDENTITY FULL: incluye la fila completa en UPDATE/DELETE para que
    -- RLS y los filtros de Realtime puedan evaluarse sobre cualquier columna.
    execute format('alter table public.%I replica identity full', tbl);

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
