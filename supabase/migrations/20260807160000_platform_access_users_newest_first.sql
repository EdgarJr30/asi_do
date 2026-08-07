-- Los usuarios del módulo owner-only deben aparecer por fecha de creación,
-- sin que tener roles asignados desplace a una cuenta más reciente.
-- Se transforma la definición vigente para mantener en un solo lugar el resto
-- del snapshot (roles, permisos, auditoría y paginación).

do $$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(
    'public.admin_platform_rbac_snapshot(text, integer, integer)'::regprocedure
  )
  into v_definition;

  v_updated_definition := replace(
    v_definition,
    E'active_role_count desc,\n      created_at desc',
    E'created_at desc,\n      id desc'
  );
  v_updated_definition := replace(
    v_updated_definition,
    E'u.active_role_count desc,\n            u.created_at desc',
    E'u.created_at desc,\n            u.id desc'
  );

  if v_updated_definition = v_definition then
    raise exception 'Could not update admin_platform_rbac_snapshot user ordering';
  end if;

  if position('active_role_count desc' in lower(v_updated_definition)) > 0 then
    raise exception 'Legacy role-priority ordering remains in admin_platform_rbac_snapshot';
  end if;

  execute v_updated_definition;
end;
$$;
