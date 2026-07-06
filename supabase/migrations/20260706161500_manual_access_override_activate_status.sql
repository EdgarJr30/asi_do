-- El override de acceso manual sólo surte efecto si la cuenta está `status = 'active'`
-- (has_active_asi_access exige status='active' en AMBAS ramas). Para que un
-- platform_owner/platform_admin/super_administrator pueda conceder acceso a CUALQUIER
-- usuario —incluso uno cuya cuenta aún no esté activa— la concesión activa la cuenta,
-- igual que activate_member. Se conserva el resto de la semántica de override.

create or replace function public.admin_set_manual_access_override(
  p_user_id uuid,
  p_months integer default null,
  p_reason text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_now timestamptz := timezone('utc', now());
  v_until timestamptz;
  v_indefinite boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (public.is_platform_admin() or public.has_platform_permission('membership_payment:verify')) then
    raise exception 'Only a platform admin can grant manual access';
  end if;

  if p_months is not null and p_months < 1 then
    raise exception 'Membership months must be at least 1';
  end if;

  v_indefinite := p_months is null;
  v_until := case
    when v_indefinite then timestamptz '9999-12-31 00:00:00+00'
    else v_now + make_interval(months => p_months)
  end;

  update public.users
  set
    status = 'active',
    membership_activated_at = coalesce(membership_activated_at, v_now),
    manual_access_override_until = v_until,
    manual_access_override_reason = nullif(trim(p_reason), ''),
    manual_access_override_by_user_id = auth.uid()
  where id = p_user_id
  returning * into v_user;

  if not found then
    raise exception 'User not found';
  end if;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'member.access_override_granted',
    'user',
    v_user.id::text,
    jsonb_build_object(
      'until', v_until,
      'indefinite', v_indefinite,
      'months', p_months,
      'reason', nullif(trim(p_reason), '')
    )
  );

  return v_user;
end;
$$;

grant execute on function public.admin_set_manual_access_override(uuid, integer, text) to authenticated;
