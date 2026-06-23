-- Habilita Supabase Realtime para las superficies "en vivo" de la plataforma.
--
-- Convención (ver docs/architecture/REALTIME.md):
-- React Query es la fuente de verdad de los datos; Realtime solo dispara
-- invalidateQueries en el cliente. Así, cuando una empresa publica una vacante,
-- entra una postulación, se mueve una etapa o un candidato cambia su visibilidad,
-- el resto de usuarios conectados lo ve sin recargar la página.
--
-- La seguridad la sigue dando RLS: Postgres Changes respeta las políticas, así
-- que cada cliente solo recibe los eventos de las filas que ya puede leer.

do $$
declare
  tbl text;
  realtime_tables text[] := array[
    'job_postings',
    'applications',
    'application_stage_history',
    'candidate_profiles',
    'company_profiles'
  ];
begin
  foreach tbl in array realtime_tables loop
    -- REPLICA IDENTITY FULL: incluye la fila completa en los eventos UPDATE/DELETE
    -- para que RLS y los filtros de Realtime puedan evaluarse sobre cualquier
    -- columna (no solo la primary key).
    execute format('alter table public.%I replica identity full', tbl);

    -- Añade la tabla a la publicación de Realtime solo si aún no está presente.
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
