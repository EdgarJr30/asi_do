-- Paginación real de servidor para el directorio de candidatos.
-- Añade offset, orden server-side y total_count (via window) para alimentar el
-- scroll infinito del módulo de candidatos, en línea con `listPublicJobsPage`.

drop function if exists public.search_candidate_profiles(uuid, text, text, text, text, integer);

create or replace function public.search_candidate_profiles(
  p_tenant_id uuid,
  p_query text default null,
  p_country_code text default null,
  p_language text default null,
  p_skill text default null,
  p_limit integer default 24,
  p_offset integer default 0,
  p_sort text default 'relevance'
)
returns table (
  candidate_profile_id uuid,
  user_id uuid,
  full_name text,
  display_name text,
  avatar_path text,
  headline text,
  desired_role text,
  city_name text,
  country_code text,
  summary text,
  completeness_score integer,
  latest_role_title text,
  total_experiences bigint,
  skill_names text[],
  language_names text[],
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_query text := nullif(trim(p_query), '');
  normalized_skill text := nullif(trim(p_skill), '');
  normalized_language text := nullif(trim(p_language), '');
  normalized_country text := nullif(upper(trim(p_country_code)), '');
  bounded_limit integer := greatest(1, least(coalesce(p_limit, 24), 50));
  bounded_offset integer := greatest(0, coalesce(p_offset, 0));
  normalized_sort text := lower(coalesce(nullif(trim(p_sort), ''), 'relevance'));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_tenant_permission(p_tenant_id, 'candidate_directory:read') then
    raise exception 'Permission denied to search the candidate directory';
  end if;

  return query
  with base as (
    select
      cp.id as candidate_profile_id,
      cp.user_id,
      u.full_name,
      coalesce(u.display_name, u.full_name) as display_name,
      u.avatar_path,
      cp.headline,
      cp.desired_role,
      cp.city_name,
      cp.country_code,
      cp.summary,
      cp.completeness_score,
      cp.updated_at,
      (
        select ce.role_title
        from public.candidate_experiences ce
        where ce.candidate_profile_id = cp.id
        order by ce.is_current desc, ce.start_date desc, ce.sort_order asc
        limit 1
      ) as latest_role_title,
      (
        select count(*)
        from public.candidate_experiences ce
        where ce.candidate_profile_id = cp.id
      ) as total_experiences,
      coalesce(
        (
          select array_agg(cs.skill_name order by cs.sort_order asc)
          from public.candidate_skills cs
          where cs.candidate_profile_id = cp.id
        ),
        array[]::text[]
      ) as skill_names,
      coalesce(
        (
          select array_agg(cl.language_name order by cl.sort_order asc)
          from public.candidate_languages cl
          where cl.candidate_profile_id = cp.id
        ),
        array[]::text[]
      ) as language_names,
      count(*) over() as total_count
    from public.candidate_profiles cp
    join public.users u
      on u.id = cp.user_id
    where cp.is_visible_to_recruiters = true
      and (
        normalized_query is null
        or cp.desired_role ilike '%' || normalized_query || '%'
        or cp.headline ilike '%' || normalized_query || '%'
        or cp.summary ilike '%' || normalized_query || '%'
        or exists (
          select 1
          from public.candidate_experiences ce
          where ce.candidate_profile_id = cp.id
            and (
              ce.role_title ilike '%' || normalized_query || '%'
              or ce.company_name ilike '%' || normalized_query || '%'
              or coalesce(ce.summary, '') ilike '%' || normalized_query || '%'
            )
        )
        or exists (
          select 1
          from public.candidate_skills cs
          where cs.candidate_profile_id = cp.id
            and cs.skill_name ilike '%' || normalized_query || '%'
        )
      )
      and (
        normalized_country is null
        or cp.country_code = normalized_country
      )
      and (
        normalized_skill is null
        or exists (
          select 1
          from public.candidate_skills cs
          where cs.candidate_profile_id = cp.id
            and cs.skill_name ilike '%' || normalized_skill || '%'
        )
      )
      and (
        normalized_language is null
        or exists (
          select 1
          from public.candidate_languages cl
          where cl.candidate_profile_id = cp.id
            and cl.language_name ilike '%' || normalized_language || '%'
        )
      )
  )
  select
    base.candidate_profile_id,
    base.user_id,
    base.full_name,
    base.display_name,
    base.avatar_path,
    base.headline,
    base.desired_role,
    base.city_name,
    base.country_code,
    base.summary,
    base.completeness_score,
    base.latest_role_title,
    base.total_experiences,
    base.skill_names,
    base.language_names,
    base.total_count
  from base
  order by
    (case when normalized_sort = 'name' then lower(base.display_name) end) asc nulls last,
    (case when normalized_sort = 'experience' then base.total_experiences end) desc nulls last,
    base.completeness_score desc,
    base.updated_at desc
  limit bounded_limit
  offset bounded_offset;
end;
$$;

grant execute on function public.search_candidate_profiles(uuid, text, text, text, text, integer, integer, text) to authenticated;
