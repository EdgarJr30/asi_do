-- Corrige el alta del banco de talento.
--
-- La política original consultaba candidate_profiles directamente para
-- comprobar que el perfil fuera visible. Esa subconsulta heredaba el RLS de
-- candidate_profiles y devolvía false para reclutadores que acceden al
-- directorio mediante RPC security definer, aunque el perfil sí fuera visible.

create or replace function public.is_candidate_profile_visible_to_recruiters(
  p_candidate_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = p_candidate_profile_id
      and cp.is_visible_to_recruiters = true
  );
$$;

revoke all on function public.is_candidate_profile_visible_to_recruiters(uuid) from public;
grant execute on function public.is_candidate_profile_visible_to_recruiters(uuid) to authenticated;

drop policy if exists "talent_pool_entries_insert_for_tenant_members"
on public.talent_pool_entries;

create policy "talent_pool_entries_insert_for_tenant_members"
on public.talent_pool_entries
for insert
to authenticated
with check (
  public.has_tenant_permission(tenant_id, 'candidate_directory:read')
  and saved_by_user_id = auth.uid()
  and public.is_candidate_profile_visible_to_recruiters(candidate_profile_id)
);
