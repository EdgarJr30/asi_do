-- El módulo /admin de Usuarios y roles pasó a paginación real del lado servidor
-- (infinite scroll): el cliente ahora llama admin_platform_rbac_snapshot con
-- p_user_offset y espera un objeto users_page { limit, offset, total_count,
-- loaded_count, next_offset }. La función desplegada solo aceptaba (p_user_query,
-- p_user_limit) y no devolvía users_page, así que PostgREST respondía "función no
-- encontrada" (PGRST202) y la UI lo mostraba erróneamente como "no eres
-- platform_owner". Esta migración reemplaza la función para soportar el offset y la
-- metadata de paginación, sin cambiar nada de la lógica de permisos ni del resto de
-- la respuesta.

-- Quita la sobrecarga de 2 parámetros para evitar ambigüedad de resolución.
drop function if exists public.admin_platform_rbac_snapshot(text, integer);

create or replace function public.admin_platform_rbac_snapshot(
  p_user_query text default null,
  p_user_limit integer default 50,
  p_user_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(lower(trim(coalesce(p_user_query, ''))), '');
  v_limit integer := least(greatest(coalesce(p_user_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_user_offset, 0), 0);
  v_total_count integer;
  v_loaded_count integer;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_owner() then
    raise exception 'Only platform_owner can inspect platform RBAC';
  end if;

  -- Total de usuarios que casan con la búsqueda (antes de limit/offset), para el
  -- contador y para decidir el next_offset del scroll infinito.
  select count(*)
    into v_total_count
  from public.users u
  where v_query is null
     or lower(coalesce(u.email, '') || ' ' || coalesce(u.full_name, '') || ' ' || coalesce(u.display_name, '')) like '%' || v_query || '%';

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
    offset v_offset
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

  -- loaded_count = cuántos usuarios devolvió esta página realmente.
  v_loaded_count := coalesce(jsonb_array_length(v_result -> 'users'), 0);

  v_result := v_result || jsonb_build_object(
    'users_page',
    jsonb_build_object(
      'limit', v_limit,
      'offset', v_offset,
      'total_count', v_total_count,
      'loaded_count', v_loaded_count,
      'next_offset',
      case
        when v_offset + v_loaded_count < v_total_count then v_offset + v_loaded_count
        else null
      end
    )
  );

  return v_result;
end;
$$;

grant execute on function public.admin_platform_rbac_snapshot(text, integer, integer) to authenticated;
