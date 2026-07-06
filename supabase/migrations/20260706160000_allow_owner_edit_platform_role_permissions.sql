-- Permite al platform_owner ajustar permisos de cualquier rol de plataforma.
-- Los roles bloqueados conservan su identidad; solo cambia su matriz de permisos.

create or replace function public.admin_update_platform_role(
  p_role_id uuid,
  p_name text,
  p_description text,
  p_permission_codes text[] default '{}'::text[]
)
returns public.platform_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.platform_roles;
  v_role public.platform_roles;
  v_requested_name text := trim(coalesce(p_name, ''));
  v_requested_description text := trim(coalesce(p_description, ''));
  v_name text;
  v_description text;
  v_missing text[];
  v_invalid_scope text[];
  v_permissions text[];
  v_previous_permission_codes text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_owner() then
    raise exception 'Only platform_owner can update platform roles';
  end if;

  select *
  into v_previous
  from public.platform_roles
  where id = p_role_id
  for update;

  if v_previous.id is null then
    raise exception 'Platform role not found';
  end if;

  if v_previous.is_locked then
    if v_requested_name <> coalesce(v_previous.name, '') or v_requested_description <> coalesce(v_previous.description, '') then
      raise exception 'Locked platform role metadata cannot be edited from this module';
    end if;

    v_name := v_previous.name;
    v_description := v_previous.description;
  else
    v_name := nullif(v_requested_name, '');
    v_description := nullif(v_requested_description, '');

    if v_name is null or v_description is null then
      raise exception 'Role name and description are required';
    end if;
  end if;

  select coalesce(array_agg(distinct requested.code order by requested.code), '{}'::text[])
  into v_permissions
  from (
    select nullif(trim(code), '') as code
    from unnest(coalesce(p_permission_codes, '{}'::text[])) as input(code)
  ) requested
  where requested.code is not null;

  select array_agg(requested.code)
  into v_missing
  from unnest(v_permissions) as requested(code)
  where not exists (
    select 1 from public.permissions p where p.code = requested.code
  );

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'Unknown permissions: %', array_to_string(v_missing, ', ');
  end if;

  select array_agg(p.code)
  into v_invalid_scope
  from public.permissions p
  where p.code = any(v_permissions)
    and p.scope <> 'platform';

  if coalesce(array_length(v_invalid_scope, 1), 0) > 0 then
    raise exception 'Only platform permissions can be assigned to platform roles: %', array_to_string(v_invalid_scope, ', ');
  end if;

  select coalesce(array_agg(p.code order by p.code), '{}'::text[])
  into v_previous_permission_codes
  from public.platform_role_permissions prp
  join public.permissions p on p.id = prp.permission_id
  where prp.role_id = p_role_id;

  update public.platform_roles
  set
    name = v_name,
    description = v_description,
    updated_at = timezone('utc', now())
  where id = p_role_id
  returning * into v_role;

  delete from public.platform_role_permissions
  where role_id = p_role_id
    and permission_id not in (
      select p.id
      from public.permissions p
      where p.code = any(v_permissions)
    );

  insert into public.platform_role_permissions (role_id, permission_id)
  select p_role_id, p.id
  from public.permissions p
  where p.code = any(v_permissions)
  on conflict do nothing;

  insert into public.audit_logs (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    source,
    schema_name,
    record_id,
    old_record,
    new_record
  )
  values (
    auth.uid(),
    'platform_role.updated',
    'platform_roles',
    v_role.id::text,
    jsonb_build_object(
      'role_code', v_role.code,
      'metadata_locked', v_previous.is_locked,
      'previous_permission_codes', v_previous_permission_codes,
      'permission_codes', v_permissions
    ),
    'platform_rbac',
    'public',
    v_role.id,
    to_jsonb(v_previous),
    to_jsonb(v_role)
  );

  return v_role;
end;
$$;

grant execute on function public.admin_update_platform_role(uuid, text, text, text[]) to authenticated;
