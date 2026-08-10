-- ─────────────────────────────────────────────────────────────────────────────
-- P1 TASK-276 — métricas del dashboard del workspace, agregadas en la base.
--
-- `fetchWorkspaceDashboardMetrics` descargaba **el tablero completo** —todas las
-- postulaciones del tenant con sus notas, calificaciones, perfil de candidato y
-- usuario anidados— **más todas las vacantes**, para calcular nueve números y
-- dos listas de treinta elementos. El coste crecía con el histórico del tenant
-- aunque la pantalla mostrara siempre lo mismo, y se pagaba en cada carga del
-- dashboard, que es la primera pantalla tras entrar al workspace.
--
-- Este RPC devuelve exactamente el contrato que la pantalla consume, ya
-- agregado. Tres decisiones que no son obvias:
--
--   1. **Las fronteras del periodo llegan como parámetro, no se calculan aquí.**
--      El cliente las derivaba de la medianoche **local** del navegador
--      (`start.setHours(0,0,0,0)`); calcularlas en SQL las movería a medianoche
--      UTC y, en República Dominicana (UTC-4), las cuatro primeras horas de cada
--      día caerían en el periodo equivocado. Pasarlas ya resueltas mantiene el
--      resultado idéntico al que la pantalla venía mostrando.
--   2. **La clasificación de etapa se replica tal cual**, incluida su tolerancia
--      bilingüe: el cliente concatena `code` y `name` con un espacio, pasa a
--      minúsculas y busca subcadena. `ilike` sobre la misma concatenación es el
--      mismo predicado. Se replica en vez de mejorarse a propósito: cambiar la
--      regla aquí movería los números sin que nadie lo pidiera.
--   3. **`security definer` con guarda de permiso explícita**, siguiendo a
--      `tenant_applications_page` (TASK-267). La identidad del candidato se
--      devuelve solo tras comprobar `application:read` sobre el tenant.
--
-- Nota sobre la identidad del candidato: el cliente resolvía el nombre con un
-- nested select que **RLS podía anular en silencio**, dejando el snapshot como
-- único valor. Aquí el orden es el mismo —`display_name`, `full_name`,
-- snapshot— pero se evalúa después de la guarda, así que deja de depender de si
-- la política alcanzaba a `users`.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.workspace_dashboard_metrics(
  p_tenant_id uuid,
  p_period_start timestamptz default null,
  p_previous_period_start timestamptz default null
)
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
    raise exception 'Insufficient permission to read workspace dashboard'
      using errcode = 'insufficient_privilege';
  end if;

  with stages as (
    select s.id, s.name, s.code, s.position
    from public.pipeline_stages s
    where s.tenant_id is null or s.tenant_id = p_tenant_id
  ),
  -- Toda postulación del tenant, ya clasificada. El `left join` a etapas importa:
  -- una postulación sin etapa asignada sigue contando en los totales.
  classified as (
    select
      a.id,
      a.submitted_at,
      a.status_public,
      a.current_stage_id,
      a.job_posting_id,
      a.candidate_profile_id,
      a.candidate_display_name_snapshot,
      s.name as stage_name,
      s.code as stage_code,
      a.status_public::text not in ('rejected', 'withdrawn', 'hired') as is_active,
      (
        a.status_public::text = 'interviewing'
        or coalesce(s.code, '') || ' ' || coalesce(s.name, '') ilike '%interview%'
        or coalesce(s.code, '') || ' ' || coalesce(s.name, '') ilike '%entrevista%'
      ) as is_interview,
      (
        a.status_public::text = 'offer'
        or coalesce(s.code, '') || ' ' || coalesce(s.name, '') ilike '%offer%'
        or coalesce(s.code, '') || ' ' || coalesce(s.name, '') ilike '%oferta%'
      ) as is_offer,
      (
        a.status_public::text = 'hired'
        or coalesce(s.code, '') || ' ' || coalesce(s.name, '') ilike '%hired%'
        or coalesce(s.code, '') || ' ' || coalesce(s.name, '') ilike '%contrat%'
      ) as is_hired
    from public.applications a
    join public.job_postings j on j.id = a.job_posting_id
    left join stages s on s.id = a.current_stage_id
    where j.tenant_id = p_tenant_id
  ),
  period_apps as (
    select * from classified
    where p_period_start is null or submitted_at >= p_period_start
  ),
  previous_apps as (
    select * from classified
    where p_period_start is not null
      and p_previous_period_start is not null
      and submitted_at >= p_previous_period_start
      and submitted_at < p_period_start
  ),
  -- Las vacantes solo aportan un conteo, así que nunca salen de la base.
  jobs as (
    select
      j.status::text as status,
      coalesce(j.published_at, j.updated_at) as effective_at
    from public.job_postings j
    where j.tenant_id = p_tenant_id
  ),
  totals as (
    select
      (select count(*) from period_apps) as period_total,
      (select count(*) from period_apps where is_active) as active_candidates,
      (select count(*) from period_apps where is_interview) as interviews,
      (select count(*) from period_apps where is_offer) as offers,
      (select count(*) from period_apps where is_hired) as hired,
      (select count(*) from previous_apps where is_active) as prev_active,
      (select count(*) from previous_apps where is_interview) as prev_interviews,
      (select count(*) from previous_apps where is_offer) as prev_offers,
      (
        select count(*) from jobs
        where status = 'published'
          and (p_period_start is null or effective_at >= p_period_start)
      ) as open_jobs,
      (
        select count(*) from jobs
        where status = 'published'
          and p_period_start is not null
          and p_previous_period_start is not null
          and effective_at >= p_previous_period_start
          and effective_at < p_period_start
      ) as prev_open_jobs
  ),
  funnel as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'stageId', s.id,
          'name', s.name,
          'count', c.stage_count,
          'percent', case
            when t.period_total > 0 then round(c.stage_count * 100.0 / t.period_total)::int
            else 0
          end
        )
        order by s.position, s.id
      ),
      '[]'::jsonb
    ) as items
    from stages s
    cross join totals t
    cross join lateral (
      select count(*) as stage_count
      from period_apps p
      where p.current_stage_id = s.id
    ) c
  ),
  -- Solo las 30 más recientes llegan a resolver identidad y promedio: el detalle
  -- se paga después de recortar, no antes.
  recent_ids as (
    select id, submitted_at
    from period_apps
    order by submitted_at desc, id desc
    limit 30
  ),
  recent_applications as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'applicationId', p.id,
          'candidateName', coalesce(u.display_name, u.full_name, p.candidate_display_name_snapshot),
          'avatarPath', u.avatar_path,
          'position', coalesce(j.title, 'Vacante'),
          'stageName', p.stage_name,
          'stageCode', p.stage_code,
          'score', r.score,
          'submittedAt', p.submitted_at
        )
        order by p.submitted_at desc, p.id desc
      ),
      '[]'::jsonb
    ) as items
    from recent_ids ri
    join period_apps p on p.id = ri.id
    left join public.job_postings j on j.id = p.job_posting_id
    left join public.candidate_profiles cp on cp.id = p.candidate_profile_id
    left join public.users u on u.id = cp.user_id
    left join lateral (
      select round(avg(ar.score) * 20)::int as score
      from public.application_ratings ar
      where ar.application_id = p.id
    ) r on true
  ),
  -- Las tres clases de evento comparten forma, así que se unen y se recortan una
  -- sola vez. El nombre y el título se resuelven aquí porque cada evento los
  -- muestra, y son los mismos para todos los eventos de una postulación.
  activity_source as (
    select
      p.id as application_id,
      coalesce(u.display_name, u.full_name, p.candidate_display_name_snapshot) as candidate_name,
      coalesce(j.title, 'Vacante') as job_title
    from period_apps p
    left join public.job_postings j on j.id = p.job_posting_id
    left join public.candidate_profiles cp on cp.id = p.candidate_profile_id
    left join public.users u on u.id = cp.user_id
  ),
  activity as (
    select 'app-' || p.id as id, 'application' as kind, s.candidate_name, s.job_title,
           'aplicó a una vacante' as summary, p.submitted_at as occurred_at
    from period_apps p
    join activity_source s on s.application_id = p.id
    union all
    select 'note-' || n.id, 'note', s.candidate_name, s.job_title,
           'recibió una nueva nota', n.created_at
    from public.application_notes n
    join activity_source s on s.application_id = n.application_id
    union all
    select 'rating-' || ar.id, 'rating', s.candidate_name, s.job_title,
           'fue calificado · ' || ar.score || '/5', ar.created_at
    from public.application_ratings ar
    join activity_source s on s.application_id = ar.application_id
  ),
  recent_activity as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'kind', a.kind,
          'candidateName', a.candidate_name,
          'jobTitle', a.job_title,
          'summary', a.summary,
          'occurredAt', a.occurred_at
        )
        order by a.occurred_at desc, a.id desc
      ),
      '[]'::jsonb
    ) as items
    from (
      select * from activity order by occurred_at desc, id desc limit 30
    ) a
  )
  select jsonb_build_object(
    'stats', jsonb_build_object(
      'openJobs', t.open_jobs,
      'activeCandidates', t.active_candidates,
      'interviews', t.interviews,
      'offers', t.offers,
      'hired', t.hired
    ),
    'deltas', jsonb_build_object(
      'openJobs', t.open_jobs - t.prev_open_jobs,
      'activeCandidates', t.active_candidates - t.prev_active,
      'interviews', t.interviews - t.prev_interviews,
      'offers', t.offers - t.prev_offers
    ),
    'funnel', f.items,
    'recentApplications', ra.items,
    'recentActivity', rac.items
  )
  into v_result
  from totals t
  cross join funnel f
  cross join recent_applications ra
  cross join recent_activity rac;

  return v_result;
end;
$$;

comment on function public.workspace_dashboard_metrics(uuid, timestamptz, timestamptz) is
  'Métricas agregadas del dashboard del workspace. Las fronteras del periodo llegan resueltas desde el cliente para conservar la medianoche local.';

-- El `revoke` va primero y **no es ceremonia**: `create function` sigue
-- concediendo EXECUTE al pseudo-rol PUBLIC, que todo rol hereda, así que sin él
-- la función nace invocable por `anon` por mucho que el grant nombre solo a
-- `authenticated`. Es la misma trampa que originó el P0 de TASK-256, y la probe
-- `p2_platform_grants` la volvió a cazar aquí.
revoke all on function public.workspace_dashboard_metrics(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.workspace_dashboard_metrics(uuid, timestamptz, timestamptz)
  to authenticated;
