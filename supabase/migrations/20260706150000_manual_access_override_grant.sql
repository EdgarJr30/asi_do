-- Activación manual de acceso ASI por super admin / platform_owner ------------
--
-- Un platform_owner, platform_admin o super_administrator puede conceder acceso
-- a los módulos gateados por membresía SIN exigir solicitud, pago ni aprobación
-- pastoral. Reutiliza las columnas manual_access_override_* de public.users, que
-- ya son respetadas por has_active_asi_access() (RLS server) y por el guard del
-- cliente (hasActiveAsiAccess). El override puede tener vencimiento (en meses) o
-- ser indefinido (fecha centinela lejana), y es revocable en cualquier momento.

-- 1. Asegurar que super_administrator alcance la consola de membresía y los RPC
--    gateados por membership_payment:verify (platform_owner/platform_admin ya la
--    tienen desde 20260621130000).
insert into public.platform_role_permissions (role_id, permission_id)
select pr.id, p.id
from public.platform_roles pr
join public.permissions p
  on p.code in ('membership_application:review', 'membership_payment:verify', 'user:activate')
where pr.code = 'super_administrator'
on conflict do nothing;

-- Fecha centinela para overrides "sin vencimiento" (indefinidos).
-- has_active_asi_access() sólo exige manual_access_override_until > now().

-- 2. Conceder / extender el override de acceso manual.
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

-- 3. Revocar el override de acceso manual (no toca la membresía "real" del
--    pipeline: sólo limpia el acceso concedido a mano).
create or replace function public.admin_clear_manual_access_override(
  p_user_id uuid,
  p_reason text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (public.is_platform_admin() or public.has_platform_permission('membership_payment:verify')) then
    raise exception 'Only a platform admin can revoke manual access';
  end if;

  update public.users
  set
    manual_access_override_until = null,
    manual_access_override_reason = null,
    manual_access_override_by_user_id = null
  where id = p_user_id
  returning * into v_user;

  if not found then
    raise exception 'User not found';
  end if;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'member.access_override_revoked',
    'user',
    v_user.id::text,
    jsonb_build_object('reason', nullif(trim(p_reason), ''))
  );

  return v_user;
end;
$$;

-- 4. Búsqueda de usuarios para el panel de activación manual. Devuelve el estado
--    de membresía y el override vigente para que la consola muestre a quién ya se
--    le concedió acceso a mano. Mismo gate que los RPC de arriba.
create or replace function public.admin_search_users_for_access(
  p_query text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (public.is_platform_admin() or public.has_platform_permission('membership_payment:verify')) then
    raise exception 'Only a platform admin can search users for access';
  end if;

  select coalesce(jsonb_agg(row_to_json(u)), '[]'::jsonb)
  into v_result
  from (
    select
      users.id,
      users.full_name,
      users.display_name,
      users.email,
      users.status,
      users.asi_membership_status,
      users.membership_expires_at,
      users.manual_access_override_until,
      users.manual_access_override_reason
    from public.users
    where v_query is null
      or users.full_name ilike '%' || v_query || '%'
      or users.display_name ilike '%' || v_query || '%'
      or users.email ilike '%' || v_query || '%'
    order by
      (users.manual_access_override_until is not null
        and users.manual_access_override_until > timezone('utc', now())) desc,
      users.full_name asc
    limit v_limit
  ) as u;

  return v_result;
end;
$$;

grant execute on function public.admin_set_manual_access_override(uuid, integer, text) to authenticated;
grant execute on function public.admin_clear_manual_access_override(uuid, text) to authenticated;
grant execute on function public.admin_search_users_for_access(text, integer) to authenticated;
