-- Close public registration intake while the platform remains in demo mode.

drop policy if exists "institutional_membership_applications_insert_public" on public.institutional_membership_applications;

create policy "institutional_membership_applications_insert_closed"
on public.institutional_membership_applications
for insert
to anon, authenticated
with check (false);

revoke insert on public.institutional_membership_applications from anon;
revoke insert on public.institutional_membership_applications from authenticated;

grant select, update on public.institutional_membership_applications to authenticated;
