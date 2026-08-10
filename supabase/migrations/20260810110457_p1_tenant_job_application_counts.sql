-- ─────────────────────────────────────────────────────────────────────────────
-- P1 TASK-277 (primera mitad) — contador de postulaciones por vacante.
--
-- `jobs-overview-page` mostraba cuántas postulaciones tiene cada vacante
-- llamando a `fetchPipelineBoard`: **el tablero completo del tenant**, con las
-- notas, las calificaciones, el perfil del candidato y su usuario anidados, para
-- después recorrerlo en memoria y quedarse con un `Map<jobId, number>`.
--
-- Dos agravantes que no se ven leyendo la pantalla:
--
--   * Es la **misma** consulta que ya hacía el dashboard, así que entrar al
--     workspace y abrir vacantes descargaba el histórico dos veces.
--   * `useRealtimeSync` invalida esa clave ante **cualquier** evento de
--     `applications`. Cada postulación nueva de cualquier vacante volvía a
--     bajar el tablero entero a todos los reclutadores con la pantalla abierta.
--     El coste no crecía con lo que se muestra, sino con la actividad del tenant.
--
-- Un `group by` devuelve exactamente lo que la pantalla usa. La guarda es la
-- misma que la del resto del workspace (`application:read`), y el conteo se hace
-- sobre las postulaciones del tenant, no sobre las que el llamante podría leer
-- una a una: es un agregado, no un listado.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.tenant_job_application_counts(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not (
    ( select public.is_platform_admin() )
    or (
      ( select public.has_active_asi_access((select auth.uid())) )
      and ( select public.has_tenant_permission(p_tenant_id, 'application:read') )
    )
  ) then
    raise exception 'Insufficient permission to read tenant application counts'
      using errcode = 'insufficient_privilege';
  end if;

  -- `jsonb_object_agg` sobre cero filas devuelve null, no '{}': el coalesce evita
  -- que un tenant sin postulaciones llegue al cliente como ausencia de dato.
  select coalesce(jsonb_object_agg(t.job_posting_id, t.total), '{}'::jsonb)
  into v_result
  from (
    select a.job_posting_id, count(*) as total
    from public.applications a
    join public.job_postings j on j.id = a.job_posting_id
    where j.tenant_id = p_tenant_id
    group by a.job_posting_id
  ) t;

  return v_result;
end;
$$;

comment on function public.tenant_job_application_counts(uuid) is
  'Postulaciones por vacante del tenant, como objeto {job_id: total}. Sustituye al recorrido del tablero completo en el cliente.';

-- El `revoke` va primero: `create function` concede EXECUTE a PUBLIC y todo rol
-- lo hereda, así que sin él la función nace invocable por `anon` por mucho que
-- el grant nombre solo a `authenticated` (la trampa del P0 de TASK-256).
revoke all on function public.tenant_job_application_counts(uuid) from public, anon;
grant execute on function public.tenant_job_application_counts(uuid) to authenticated;
