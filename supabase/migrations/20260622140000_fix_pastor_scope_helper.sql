-- ─────────────────────────────────────────────────────────────────────────────
-- Refactor (equivalente): pastor_has_scope_over_member hace el join directo contra
-- user_authority_scopes con auth.uid() en su propio cuerpo, en lugar de delegar en
-- la función anidada has_active_authority_scope. Mismo comportamiento; evita una
-- dependencia entre dos funciones SECURITY DEFINER y deja la lógica de scope a la
-- vista. (No corrige ningún bug: la versión anterior era correcta; un falso negativo
-- observado en pruebas se debió a datos sembrados con un usuario que fue eliminado.)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.pastor_has_scope_over_member(p_member_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_member_user_id is null then false
    when p_member_user_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then false
    else exists (
      select 1
      from public.institutional_membership_applications a
      join public.user_authority_scopes uas
        on uas.user_id = auth.uid()
       and uas.status = 'active'
       and uas.authority_role = 'pastor_administrator'
       and (
         coalesce(array_length(uas.church_ids, 1), 0) = 0
         or a.church_id = any (uas.church_ids)
       )
      where a.requester_user_id = p_member_user_id::uuid
        and a.church_id is not null
    )
  end;
$$;

grant execute on function public.pastor_has_scope_over_member(text) to authenticated;
