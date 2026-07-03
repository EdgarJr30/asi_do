create or replace function public.deactivate_member(
  p_user_id uuid,
  p_notes text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.users;
  v_user public.users;
  v_now timestamptz := timezone('utc', now());
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can deactivate a member';
  end if;

  select * into v_previous
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Member user not found';
  end if;

  if v_previous.asi_membership_status <> 'active' then
    raise exception 'Only an active membership can be deactivated';
  end if;

  update public.users
  set
    asi_membership_status = 'suspended',
    user_subscription_status = 'ended',
    membership_expires_at = v_now,
    subscription_expires_at = v_now,
    updated_at = v_now
  where id = p_user_id
  returning * into v_user;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'member.deactivated',
    'user',
    v_user.id::text,
    jsonb_build_object(
      'previous_asi_membership_status', v_previous.asi_membership_status,
      'previous_user_subscription_status', v_previous.user_subscription_status,
      'previous_membership_expires_at', v_previous.membership_expires_at,
      'previous_subscription_expires_at', v_previous.subscription_expires_at,
      'deactivated_at', v_now,
      'notes', nullif(trim(p_notes), '')
    )
  );

  return v_user;
end;
$$;

grant execute on function public.deactivate_member(uuid, text) to authenticated;
