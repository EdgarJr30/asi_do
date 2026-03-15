create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create index if not exists memberships_invited_by_user_id_idx on public.memberships (invited_by_user_id);
create index if not exists membership_roles_assigned_by_user_id_idx on public.membership_roles (assigned_by_user_id);
create index if not exists membership_roles_revoked_by_user_id_idx on public.membership_roles (revoked_by_user_id);
create index if not exists membership_roles_role_id_idx on public.membership_roles (role_id);
create index if not exists platform_role_permissions_permission_id_idx on public.platform_role_permissions (permission_id);
create index if not exists recruiter_requests_approved_tenant_id_idx on public.recruiter_requests (approved_tenant_id);
create index if not exists recruiter_requests_reviewed_by_user_id_idx on public.recruiter_requests (reviewed_by_user_id);
create index if not exists tenant_role_permissions_permission_id_idx on public.tenant_role_permissions (permission_id);
create index if not exists tenants_created_by_user_id_idx on public.tenants (created_by_user_id);
create index if not exists user_platform_roles_assigned_by_user_id_idx on public.user_platform_roles (assigned_by_user_id);
create index if not exists user_platform_roles_revoked_by_user_id_idx on public.user_platform_roles (revoked_by_user_id);
create index if not exists user_platform_roles_role_id_idx on public.user_platform_roles (role_id);

drop policy if exists "users_select_self_or_platform_admin" on public.users;
create policy "users_select_self_or_platform_admin"
on public.users
for select
to authenticated
using (((select auth.uid()) = id) or public.has_platform_permission('user:read'));

drop policy if exists "users_insert_self_only" on public.users;
create policy "users_insert_self_only"
on public.users
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "users_update_self_or_platform_admin" on public.users;
create policy "users_update_self_or_platform_admin"
on public.users
for update
to authenticated
using (((select auth.uid()) = id) or public.has_platform_permission('user:update'))
with check (((select auth.uid()) = id) or public.has_platform_permission('user:update'));

drop policy if exists "user_platform_roles_read_own_or_platform_admin" on public.user_platform_roles;
create policy "user_platform_roles_read_own_or_platform_admin"
on public.user_platform_roles
for select
to authenticated
using ((user_id = (select auth.uid())) or public.is_platform_admin());

drop policy if exists "memberships_read_own_or_tenant_authority" on public.memberships;
create policy "memberships_read_own_or_tenant_authority"
on public.memberships
for select
to authenticated
using (
  (user_id = (select auth.uid()))
  or public.has_platform_permission('tenant:read')
  or public.has_tenant_permission(tenant_id, 'member:read')
);

drop policy if exists "membership_roles_select_for_members_or_role_readers" on public.membership_roles;
create policy "membership_roles_select_for_members_or_role_readers"
on public.membership_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (
        m.user_id = (select auth.uid())
        or public.has_platform_permission('tenant:read')
        or public.has_tenant_permission(m.tenant_id, 'role:read')
      )
  )
);

drop policy if exists "recruiter_requests_select_self_or_platform_admin" on public.recruiter_requests;
create policy "recruiter_requests_select_self_or_platform_admin"
on public.recruiter_requests
for select
to authenticated
using (
  (requester_user_id = (select auth.uid()))
  or public.has_platform_permission('recruiter_request:read')
  or public.has_platform_permission('recruiter_request:review')
);

drop policy if exists "recruiter_requests_insert_self_only" on public.recruiter_requests;
create policy "recruiter_requests_insert_self_only"
on public.recruiter_requests
for insert
to authenticated
with check (
  (requester_user_id = (select auth.uid()))
  and status = 'submitted'
  and reviewed_by_user_id is null
  and reviewed_at is null
  and approved_tenant_id is null
);

drop policy if exists "recruiter_requests_update_self_or_platform_admin" on public.recruiter_requests;
create policy "recruiter_requests_update_self_or_platform_admin"
on public.recruiter_requests
for update
to authenticated
using (
  (requester_user_id = (select auth.uid()))
  or public.has_platform_permission('recruiter_request:review')
)
with check (
  (requester_user_id = (select auth.uid()))
  or public.has_platform_permission('recruiter_request:review')
);
