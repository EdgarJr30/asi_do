-- Plataforma RBAC admin: modulo owner-only para roles, asignaciones y auditoria.
-- Este flujo complementa bootstrap_first_platform_owner(): despues del primer
-- owner, toda administracion de roles de plataforma debe pasar por RPCs auditadas.

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_platform_roles upr
    join public.platform_roles pr
      on pr.id = upr.role_id
    where upr.user_id = auth.uid()
      and upr.revoked_at is null
      and pr.code = 'platform_owner'
  );
$$;

create or replace function public.admin_platform_rbac_snapshot(
  p_user_query text default null,
  p_user_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(lower(trim(coalesce(p_user_query, ''))), '');
  v_limit integer := least(greatest(coalesce(p_user_limit, 50), 1), 100);
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_owner() then
    raise exception 'Only platform_owner can inspect platform RBAC';
  end if;

  with role_rows as (
    select
      pr.*,
      (
        select count(*)::integer
        from public.user_platform_roles upr
        where upr.role_id = pr.id
          and upr.revoked_at is null
      ) as active_assignment_count,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'code', p.code,
              'resource', p.resource,
              'action', p.action,
              'scope', p.scope,
              'description', p.description
            )
            order by p.resource, p.action, p.code
          )
          from public.platform_role_permissions prp
          join public.permissions p on p.id = prp.permission_id
          where prp.role_id = pr.id
        ),
        '[]'::jsonb
      ) as permissions
    from public.platform_roles pr
  ),
  matching_users as (
    select
      u.*,
      (
        select count(*)::integer
        from public.user_platform_roles upr
        where upr.user_id = u.id
          and upr.revoked_at is null
      ) as active_role_count
    from public.users u
    where v_query is null
       or lower(coalesce(u.email, '') || ' ' || coalesce(u.full_name, '') || ' ' || coalesce(u.display_name, '')) like '%' || v_query || '%'
    order by
      active_role_count desc,
      u.created_at desc
    limit v_limit
  ),
  audit_rows as (
    select
      al.id,
      al.actor_user_id,
      actor.email as actor_email,
      actor.full_name as actor_name,
      al.event_type,
      al.entity_type,
      al.entity_id,
      al.payload,
      al.created_at
    from public.audit_logs al
    left join public.users actor on actor.id = al.actor_user_id
    where al.source = 'platform_rbac'
       or al.event_type like 'platform_role.%'
       or al.event_type like 'platform_rbac.%'
       or al.entity_type in ('platform_roles', 'platform_role_permissions', 'user_platform_roles')
    order by al.created_at desc
    limit 40
  )
  select jsonb_build_object(
    'stats',
    jsonb_build_object(
      'role_count', (select count(*) from public.platform_roles),
      'custom_role_count', (select count(*) from public.platform_roles where not is_system),
      'active_assignment_count', (select count(*) from public.user_platform_roles where revoked_at is null),
      'platform_owner_count', (
        select count(*)
        from public.user_platform_roles upr
        join public.platform_roles pr on pr.id = upr.role_id
        where upr.revoked_at is null
          and pr.code = 'platform_owner'
      ),
      'users_with_platform_roles_count', (
        select count(distinct user_id)
        from public.user_platform_roles
        where revoked_at is null
      ),
      'audit_event_count', (select count(*) from audit_rows)
    ),
    'roles',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', rr.id,
            'code', rr.code,
            'name', rr.name,
            'description', rr.description,
            'is_system', rr.is_system,
            'is_locked', rr.is_locked,
            'created_at', rr.created_at,
            'updated_at', rr.updated_at,
            'active_assignment_count', rr.active_assignment_count,
            'permissions', rr.permissions
          )
          order by rr.is_system desc, rr.name
        )
        from role_rows rr
      ),
      '[]'::jsonb
    ),
    'permissions',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'code', p.code,
            'resource', p.resource,
            'action', p.action,
            'scope', p.scope,
            'description', p.description
          )
          order by p.scope, p.resource, p.action, p.code
        )
        from public.permissions p
        where p.scope = 'platform'
      ),
      '[]'::jsonb
    ),
    'users',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'full_name', u.full_name,
            'display_name', u.display_name,
            'status', u.status,
            'created_at', u.created_at,
            'last_sign_in_at', u.last_sign_in_at,
            'roles',
            coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'assignment_id', upr.id,
                    'role_id', pr.id,
                    'role_code', pr.code,
                    'role_name', pr.name,
                    'is_system', pr.is_system,
                    'assigned_at', upr.assigned_at,
                    'assigned_by_user_id', upr.assigned_by_user_id
                  )
                  order by pr.name
                )
                from public.user_platform_roles upr
                join public.platform_roles pr on pr.id = upr.role_id
                where upr.user_id = u.id
                  and upr.revoked_at is null
              ),
              '[]'::jsonb
            ),
            'permissions',
            coalesce(
              (
                select jsonb_agg(permission_code order by permission_code)
                from (
                  select distinct p.code as permission_code
                  from public.user_platform_roles upr
                  join public.platform_role_permissions prp on prp.role_id = upr.role_id
                  join public.permissions p on p.id = prp.permission_id
                  where upr.user_id = u.id
                    and upr.revoked_at is null
                ) permission_codes
              ),
              '[]'::jsonb
            )
          )
          order by
            u.active_role_count desc,
            u.created_at desc
        )
        from matching_users u
      ),
      '[]'::jsonb
    ),
    'audit_events',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', ar.id,
            'actor_user_id', ar.actor_user_id,
            'actor_email', ar.actor_email,
            'actor_name', ar.actor_name,
            'event_type', ar.event_type,
            'entity_type', ar.entity_type,
            'entity_id', ar.entity_id,
            'payload', ar.payload,
            'created_at', ar.created_at
          )
          order by ar.created_at desc
        )
        from audit_rows ar
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.admin_create_platform_role(
  p_code text,
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
  v_code text := lower(trim(coalesce(p_code, '')));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_role public.platform_roles;
  v_missing text[];
  v_invalid_scope text[];
  v_permissions text[] := coalesce(p_permission_codes, '{}'::text[]);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_owner() then
    raise exception 'Only platform_owner can create platform roles';
  end if;

  if v_code !~ '^[a-z0-9_]+$' then
    raise exception 'Role code must use lowercase letters, numbers, and underscores only';
  end if;

  if v_name is null or v_description is null then
    raise exception 'Role name and description are required';
  end if;

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

  insert into public.platform_roles (code, name, description, is_system, is_locked)
  values (v_code, v_name, v_description, false, false)
  returning * into v_role;

  insert into public.platform_role_permissions (role_id, permission_id)
  select v_role.id, p.id
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
    new_record
  )
  values (
    auth.uid(),
    'platform_role.created',
    'platform_roles',
    v_role.id::text,
    jsonb_build_object('role_code', v_role.code, 'permission_codes', v_permissions),
    'platform_rbac',
    'public',
    v_role.id,
    to_jsonb(v_role)
  );

  return v_role;
end;
$$;

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
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_missing text[];
  v_invalid_scope text[];
  v_permissions text[] := coalesce(p_permission_codes, '{}'::text[]);
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
    raise exception 'System platform roles cannot be edited from this module';
  end if;

  if v_name is null or v_description is null then
    raise exception 'Role name and description are required';
  end if;

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
    jsonb_build_object('role_code', v_role.code, 'permission_codes', v_permissions),
    'platform_rbac',
    'public',
    v_role.id,
    to_jsonb(v_previous),
    to_jsonb(v_role)
  );

  return v_role;
end;
$$;

create or replace function public.admin_delete_platform_role(p_role_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.platform_roles;
  v_assignment_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_owner() then
    raise exception 'Only platform_owner can delete platform roles';
  end if;

  select *
  into v_role
  from public.platform_roles
  where id = p_role_id
  for update;

  if v_role.id is null then
    raise exception 'Platform role not found';
  end if;

  if v_role.is_locked or v_role.is_system then
    raise exception 'System platform roles cannot be deleted';
  end if;

  select count(*)::integer
  into v_assignment_count
  from public.user_platform_roles
  where role_id = p_role_id;

  if v_assignment_count > 0 then
    raise exception 'Platform roles with assignment history cannot be deleted';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    source,
    schema_name,
    record_id,
    old_record
  )
  values (
    auth.uid(),
    'platform_role.deleted',
    'platform_roles',
    v_role.id::text,
    jsonb_build_object('role_code', v_role.code),
    'platform_rbac',
    'public',
    v_role.id,
    to_jsonb(v_role)
  );

  delete from public.platform_roles
  where id = p_role_id;

  return p_role_id;
end;
$$;

create or replace function public.admin_assign_platform_role(
  p_user_id uuid,
  p_role_id uuid,
  p_notes text default null
)
returns public.user_platform_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_role public.platform_roles;
  v_assignment public.user_platform_roles;
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_owner() then
    raise exception 'Only platform_owner can assign platform roles';
  end if;

  select *
  into v_user
  from public.users
  where id = p_user_id;

  if v_user.id is null then
    raise exception 'User not found';
  end if;

  if v_user.status <> 'active' then
    raise exception 'Platform roles can only be assigned to active users';
  end if;

  select *
  into v_role
  from public.platform_roles
  where id = p_role_id;

  if v_role.id is null then
    raise exception 'Platform role not found';
  end if;

  insert into public.user_platform_roles (user_id, role_id, assigned_by_user_id, revoked_at, revoked_by_user_id)
  values (p_user_id, p_role_id, auth.uid(), null, null)
  on conflict (user_id, role_id) do update
  set
    assigned_at = timezone('utc', now()),
    assigned_by_user_id = excluded.assigned_by_user_id,
    revoked_at = null,
    revoked_by_user_id = null
  returning * into v_assignment;

  insert into public.audit_logs (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    source,
    schema_name,
    record_id,
    new_record
  )
  values (
    auth.uid(),
    'platform_role.assigned',
    'user_platform_roles',
    v_assignment.id::text,
    jsonb_build_object(
      'target_user_id', p_user_id,
      'target_user_email', v_user.email,
      'role_id', p_role_id,
      'role_code', v_role.code,
      'notes', v_notes
    ),
    'platform_rbac',
    'public',
    v_assignment.id,
    to_jsonb(v_assignment)
  );

  return v_assignment;
end;
$$;

create or replace function public.admin_revoke_platform_role(
  p_assignment_id uuid,
  p_notes text default null
)
returns public.user_platform_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.user_platform_roles;
  v_assignment public.user_platform_roles;
  v_role public.platform_roles;
  v_remaining_owners integer;
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_owner() then
    raise exception 'Only platform_owner can revoke platform roles';
  end if;

  select *
  into v_previous
  from public.user_platform_roles
  where id = p_assignment_id
  for update;

  if v_previous.id is null then
    raise exception 'Platform role assignment not found';
  end if;

  if v_previous.revoked_at is not null then
    raise exception 'Platform role assignment is already revoked';
  end if;

  select *
  into v_role
  from public.platform_roles
  where id = v_previous.role_id;

  if v_role.code = 'platform_owner' then
    select count(*)::integer
    into v_remaining_owners
    from public.user_platform_roles upr
    join public.platform_roles pr on pr.id = upr.role_id
    where pr.code = 'platform_owner'
      and upr.revoked_at is null
      and upr.id <> p_assignment_id;

    if v_remaining_owners < 1 then
      raise exception 'Cannot revoke the last active platform_owner';
    end if;
  end if;

  update public.user_platform_roles
  set
    revoked_at = timezone('utc', now()),
    revoked_by_user_id = auth.uid()
  where id = p_assignment_id
  returning * into v_assignment;

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
    'platform_role.revoked',
    'user_platform_roles',
    v_assignment.id::text,
    jsonb_build_object(
      'target_user_id', v_assignment.user_id,
      'role_id', v_role.id,
      'role_code', v_role.code,
      'notes', v_notes
    ),
    'platform_rbac',
    'public',
    v_assignment.id,
    to_jsonb(v_previous),
    to_jsonb(v_assignment)
  );

  return v_assignment;
end;
$$;

grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.admin_platform_rbac_snapshot(text, integer) to authenticated;
grant execute on function public.admin_create_platform_role(text, text, text, text[]) to authenticated;
grant execute on function public.admin_update_platform_role(uuid, text, text, text[]) to authenticated;
grant execute on function public.admin_delete_platform_role(uuid) to authenticated;
grant execute on function public.admin_assign_platform_role(uuid, uuid, text) to authenticated;
grant execute on function public.admin_revoke_platform_role(uuid, text) to authenticated;
