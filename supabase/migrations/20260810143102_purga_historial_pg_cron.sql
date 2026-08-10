-- El historial de pg_cron era la última tabla del proyecto que crecía sin techo.
--
-- Incidente 2026-08-10: al revisar por qué PostgreSQL dejó de aceptar conexiones
-- entre las 12:06 y las 14:14 UTC, `cron.job_run_details` tenía 70.502 filas y
-- nadie las borraba nunca. El repo ya purga `user_access_logs`, `app_error_logs`
-- y archiva `audit_logs`; el historial del propio planificador se quedó fuera
-- porque lo crea la extensión, no una migración nuestra.
--
-- Con un job por minuto son ~525.000 filas al año, cada una escrita tres veces
-- (insert + dos updates de estado). No es lo que tumbó la base, pero es la misma
-- clase de fallo: trabajo periódico sin tope. R-152.
--
-- 14 días bastan: es historial de diagnóstico, y la ventana de un incidente se
-- revisa en horas. Lo que debe sobrevivir a un incidente son `audit_logs` y
-- `app_error_logs`, que tienen su propia retención.

create or replace function private.purge_cron_run_details(p_retention_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_deleted integer;
begin
  delete from cron.job_run_details
  where end_time < timezone('utc', now()) - make_interval(days => greatest(coalesce(p_retention_days, 14), 2))
    -- Una corrida sin `end_time` sigue viva; borrarla dejaría al planificador
    -- sin el registro de algo en curso.
    and end_time is not null;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function private.purge_cron_run_details(integer) from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('purge-cron-run-details');
exception
  when others then null;
end;
$$;

-- A las 03:50 UTC, después de las otras purgas (03:17, 03:30, 03:40), para no
-- competir con ellas por el mismo hueco de mantenimiento.
select cron.schedule(
  'purge-cron-run-details',
  '50 3 * * *',
  $cron$select private.purge_cron_run_details();$cron$
);

-- Recorte inicial: el histórico acumulado desde que existe el proyecto no se
-- purga solo esperando al primer cron.
select private.purge_cron_run_details(14);
