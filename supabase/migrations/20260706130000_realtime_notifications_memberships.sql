-- Habilita Supabase Realtime para el inbox de notificaciones y las membresías de
-- workspace, de modo que TODA la app reaccione en vivo a cambios del usuario actual
-- sin recargar: una notificación nueva aparece (y avisa) al instante, y el acceso al
-- ATS/permisos se actualiza en cuanto un admin da de alta/baja al usuario.
--
-- Convención (docs/architecture/REALTIME.md): React Query es la fuente de verdad;
-- Realtime solo dispara invalidateQueries / refresh de sesión en el cliente.
-- La seguridad la sigue dando RLS: cada cliente recibe solo los eventos de las filas
-- que ya puede leer (sus propias notificaciones, sus propias membresías).

do $$
declare
  tbl text;
  realtime_tables text[] := array[
    'notifications',
    'memberships'
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
