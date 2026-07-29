-- Banco de talento (candidatos guardados) dentro del módulo de Candidatos.
--
-- Antes existía un item de menú "Banco de talento" que apuntaba a un placeholder
-- sin modelo de datos. Aquí se crea el modelo real y se fusiona la funcionalidad
-- dentro de /workspace/talent como una pestaña "Guardados": la empresa marca
-- candidatos del directorio y los recupera después para futuras vacantes.
--
-- Alcance por tenant, no por usuario: lo que guarda un reclutador lo ve todo el
-- equipo del workspace (es el banco de talento de la empresa, no un favorito
-- privado). Se conserva `saved_by_user_id` para saber quién lo guardó.

create table if not exists public.talent_pool_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  candidate_profile_id uuid not null references public.candidate_profiles (id) on delete cascade,
  saved_by_user_id uuid references public.users (id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, candidate_profile_id)
);

create index if not exists talent_pool_entries_tenant_idx
  on public.talent_pool_entries (tenant_id, created_at desc);

create index if not exists talent_pool_entries_candidate_idx
  on public.talent_pool_entries (candidate_profile_id);

alter table public.talent_pool_entries enable row level security;

-- Leer / guardar / quitar requiere el mismo permiso que ver el directorio:
-- quien puede descubrir candidatos puede curar el banco de talento del workspace.
create policy "talent_pool_entries_select_for_tenant_members"
on public.talent_pool_entries
for select
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_permission(tenant_id, 'candidate_directory:read')
);

create policy "talent_pool_entries_insert_for_tenant_members"
on public.talent_pool_entries
for insert
to authenticated
with check (
  public.has_tenant_permission(tenant_id, 'candidate_directory:read')
  and saved_by_user_id = auth.uid()
  and exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_profile_id
      and cp.is_visible_to_recruiters = true
  )
);

create policy "talent_pool_entries_update_for_tenant_members"
on public.talent_pool_entries
for update
to authenticated
using (public.has_tenant_permission(tenant_id, 'candidate_directory:read'))
with check (public.has_tenant_permission(tenant_id, 'candidate_directory:read'));

create policy "talent_pool_entries_delete_for_tenant_members"
on public.talent_pool_entries
for delete
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_permission(tenant_id, 'candidate_directory:read')
);

drop trigger if exists talent_pool_entries_set_updated_at on public.talent_pool_entries;
create trigger talent_pool_entries_set_updated_at
before update on public.talent_pool_entries
for each row execute procedure public.set_row_updated_at();

-- Realtime: si un compañero guarda o quita un candidato, la pestaña "Guardados"
-- del resto del equipo se actualiza sola (convención docs/architecture/REALTIME.md).
do $$
begin
  execute 'alter table public.talent_pool_entries replica identity full';

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'talent_pool_entries'
  ) then
    execute 'alter publication supabase_realtime add table public.talent_pool_entries';
  end if;
end $$;

-- El buscador del directorio ahora permite filtrar solo los guardados
-- (`p_saved_only`), para que la pestaña "Guardados" reutilice los mismos
-- filtros, orden y paginación del directorio.
drop function if exists public.search_candidate_profiles(uuid, text, text, text, text, integer, integer, text);

create or replace function public.search_candidate_profiles(
  p_tenant_id uuid,
  p_query text default null,
  p_country_code text default null,
  p_language text default null,
  p_skill text default null,
  p_limit integer default 24,
  p_offset integer default 0,
  p_sort text default 'relevance',
  p_saved_only boolean default false
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
  saved_only boolean := coalesce(p_saved_only, false);
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
      tpe.created_at as saved_at,
      count(*) over() as total_count
    from public.candidate_profiles cp
    join public.users u
      on u.id = cp.user_id
    left join public.talent_pool_entries tpe
      on tpe.candidate_profile_id = cp.id
     and tpe.tenant_id = p_tenant_id
    where cp.is_visible_to_recruiters = true
      and (saved_only = false or tpe.id is not null)
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
    -- En "Guardados" manda el orden de guardado más reciente salvo que se pida otro.
    (case when saved_only and normalized_sort = 'relevance' then base.saved_at end) desc nulls last,
    (case when normalized_sort = 'name' then lower(base.display_name) end) asc nulls last,
    (case when normalized_sort = 'experience' then base.total_experiences end) desc nulls last,
    base.completeness_score desc,
    base.updated_at desc
  limit bounded_limit
  offset bounded_offset;
end;
$$;

grant execute on function public.search_candidate_profiles(uuid, text, text, text, text, integer, integer, text, boolean) to authenticated;
