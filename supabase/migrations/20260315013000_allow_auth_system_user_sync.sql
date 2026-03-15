create or replace function public.guard_user_profile_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    if current_user in ('postgres', 'supabase_auth_admin', 'service_role') then
      return new;
    end if;

    raise exception 'Authentication required';
  end if;

  if auth.uid() = old.id and not public.has_platform_permission('user:update') then
    if new.email is distinct from old.email
      or new.status is distinct from old.status
      or new.last_sign_in_at is distinct from old.last_sign_in_at
      or new.created_at is distinct from old.created_at then
      raise exception 'You can only update your editable profile fields';
    end if;
  end if;

  return new;
end;
$$;
