-- Habilita Supabase Realtime para las superficies de revisión/colas compartidas que
-- todavía requerían recargar la página para verse actualizadas entre usuarios:
--   * Notas y calificaciones de aplicaciones (actividad del workspace) — los watches
--     ya existían en la UI pero las tablas no estaban publicadas, así que los eventos
--     nunca llegaban.
--   * Casos de moderación — varios moderadores/admins actúan sobre la misma cola.
--   * Solicitudes de reclutador y de autoridad (pastor / administrador regional) — el
--     admin ve solicitudes nuevas al instante y el solicitante ve la aprobación en vivo.
--   * Invitaciones de autoridad — la consola de admin se actualiza al emitir/revocar.
--
-- Convención (docs/architecture/REALTIME.md): React Query es la fuente de verdad;
-- Realtime solo dispara invalidateQueries en el cliente. La seguridad la sigue dando
-- RLS: cada cliente recibe solo los eventos de las filas que ya puede leer (el admin
-- ve todas las de su alcance; el solicitante solo las suyas).

do $$
declare
  tbl text;
  realtime_tables text[] := array[
    'application_notes',
    'application_ratings',
    'moderation_cases',
    'recruiter_requests',
    'pastor_authority_requests',
    'regional_administrator_authority_requests',
    'authority_request_invitations'
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
