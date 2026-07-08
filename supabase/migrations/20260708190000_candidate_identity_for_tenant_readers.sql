-- La UI del empleador anida candidate_profiles -> users vía PostgREST para
-- mostrar nombre/foto del aplicante, pero users solo permitía select a uno
-- mismo o a platform admins y candidate_profiles solo al dueño: el nested
-- select volvía null y el avatar caía a iniciales en aplicaciones, pipeline
-- y dashboard. Estas políticas abren solo lectura y solo cuando el lector
-- ya puede leer la aplicación (can_read_application) o comparte tenant.

create or replace function public.is_applicant_visible_to_reader(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.candidate_profiles cp
    join public.applications a
      on a.candidate_profile_id = cp.id
    where cp.user_id = p_user_id
      and public.can_read_application(a.id)
  );
$$;

create or replace function public.can_read_candidate_profile_via_application(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    where a.candidate_profile_id = p_profile_id
      and public.can_read_application(a.id)
  );
$$;

create or replace function public.shares_active_tenant_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs
      on theirs.tenant_id = mine.tenant_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
      and mine.status = 'active'
      and theirs.status = 'active'
  );
$$;

drop policy if exists "users_select_applicants_for_application_readers" on public.users;
create policy "users_select_applicants_for_application_readers"
on public.users
for select
to authenticated
using (public.is_applicant_visible_to_reader(id));

drop policy if exists "users_select_shared_tenant_members" on public.users;
create policy "users_select_shared_tenant_members"
on public.users
for select
to authenticated
using (public.shares_active_tenant_with(id));

drop policy if exists "candidate_profiles_select_for_application_readers" on public.candidate_profiles;
create policy "candidate_profiles_select_for_application_readers"
on public.candidate_profiles
for select
to authenticated
using (public.can_read_candidate_profile_via_application(id));
