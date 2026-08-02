-- RBAC de revisión pastoral y moderación (TASK-263 / TASK-264).
-- Cubre aprobación, rechazo y acceso denegado por cada acción.
-- Termina en RAISE EXCEPTION: la transacción se revierte por completo.
do $probe$
declare
  v_priv uuid;      -- usuario CON los permisos
  v_plain uuid;     -- usuario SIN permisos de plataforma
  v_req uuid;
  v_case uuid;
  v_out text := '';
  v_status text;
  v_action text;
  v_actions text[] := array['note','warn','close_job','suspend_tenant','restore_tenant','dismiss_case'];
  v_plain2 uuid;   -- segundo solicitante: hay un unico "abierto" por usuario
  v_union uuid;
  v_assoc uuid;
  v_district uuid;
  i integer;
begin
  -- El trigger de alta exige jerarquía completa y atestación.
  select id into v_union from public.church_unions limit 1;
  select id into v_assoc from public.church_associations where union_id = v_union limit 1;
  select id into v_district from public.church_districts where association_id = v_assoc limit 1;
  -- Usuario con ambos permisos.
  select upr.user_id into v_priv
  from public.user_platform_roles upr
  join public.platform_roles pr on pr.id = upr.role_id
  join public.platform_role_permissions prp on prp.role_id = pr.id
  join public.permissions p on p.id = prp.permission_id
  where upr.revoked_at is null
    and p.code in ('moderation:act','pastor_authority_request:review')
  limit 1;

  -- Usuario sin ningún rol de plataforma.
  select u.id into v_plain
  from public.users u
  where not exists (
    select 1 from public.user_platform_roles r where r.user_id = u.id and r.revoked_at is null
  )
  limit 1;

  select u.id into v_plain2
  from public.users u
  where u.id <> v_plain
    and not exists (
      select 1 from public.user_platform_roles r where r.user_id = u.id and r.revoked_at is null
    )
  limit 1;

  if v_priv is null or v_plain is null or v_plain2 is null then
    raise exception 'PROBE_RESULT: faltan usuarios de prueba (priv=%, plain=%, plain2=%)', v_priv, v_plain, v_plain2;
  end if;

  -- ═══ review_pastor_authority_request (TASK-263) ═════════════════════════

  -- El trigger de alta exige sesión: se inserta como el propio solicitante.
  perform set_config('request.jwt.claims', json_build_object('sub', v_plain, 'role','authenticated')::text, true);
  insert into public.pastor_authority_requests
    (requester_user_id, identity_document_number, identity_document_file_path,
     first_names, last_names, phone_number,
     pastor_status_attestation, union_id, association_id, district_id)
  values (v_plain, 'DOC-PROBE', 'probe/doc.pdf', 'Nombre', 'Apellido', '8090000000',
          true, v_union, v_assoc, v_district)
  returning id into v_req;

  -- 1. Sin autenticación.
  -- Solo se manipulan los claims: auth.uid() los lee con independencia del rol
  -- de BD, y mantenerlo privilegiado permite crear los fixtures sin pelear RLS.
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.review_pastor_authority_request(v_req, 'approved', 'nota');
    v_out := v_out || '1) pastor sin auth -> PERMITIDA (fallo)';
  exception when others then
    v_out := v_out || format('1) pastor sin auth -> DENEGADA (%s)', left(sqlerrm, 24));
  end;

  -- 2. Autenticado pero sin el permiso.
  perform set_config('request.jwt.claims', json_build_object('sub', v_plain, 'role','authenticated')::text, true);
  begin
    perform public.review_pastor_authority_request(v_req, 'approved', 'nota');
    v_out := v_out || ' | 2) pastor sin permiso -> PERMITIDA (fallo)';
  exception when others then
    v_out := v_out || ' | 2) pastor sin permiso -> DENEGADA';
  end;

  -- 3. Con permiso: rechazo.
  perform set_config('request.jwt.claims', json_build_object('sub', v_priv, 'role','authenticated')::text, true);
  begin
    perform public.review_pastor_authority_request(v_req, 'rejected', 'no procede');
    select status::text into v_status from public.pastor_authority_requests where id = v_req;
    v_out := v_out || format(' | 3) pastor con permiso rechaza -> %s', v_status);
  exception when others then
    v_out := v_out || format(' | 3) pastor con permiso rechaza -> ERROR: %s', left(sqlerrm, 40));
  end;

  -- 4. Con permiso: aprobación sobre una solicitud nueva.
  -- El trigger de alta exige sesión: se inserta como el propio solicitante.
  perform set_config('request.jwt.claims', json_build_object('sub', v_plain2, 'role','authenticated')::text, true);
  insert into public.pastor_authority_requests
    (requester_user_id, identity_document_number, identity_document_file_path,
     first_names, last_names, phone_number,
     pastor_status_attestation, union_id, association_id, district_id)
  values (v_plain2, 'DOC-PROBE-2', 'probe/doc2.pdf', 'Nombre', 'Apellido', '8090000001',
          true, v_union, v_assoc, v_district)
  returning id into v_req;

  -- 4b. El solicitante NO puede decidir sobre su propia solicitud por UPDATE
  -- directo, aunque la RLS le permita editar su fila.
  begin
    update public.pastor_authority_requests
    set status = 'approved', reviewed_by_user_id = v_plain2
    where id = v_req;
    v_out := v_out || ' | 4b) autoaprobacion por UPDATE -> PERMITIDA (fallo)';
  exception when others then
    v_out := v_out || ' | 4b) autoaprobacion por UPDATE -> BLOQUEADA';
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_priv, 'role','authenticated')::text, true);
  begin
    perform public.review_pastor_authority_request(v_req, 'approved', 'procede');
    select status::text into v_status from public.pastor_authority_requests where id = v_req;
    v_out := v_out || format(' | 4) pastor con permiso aprueba -> %s', v_status);
  exception when others then
    v_out := v_out || format(' | 4) pastor con permiso aprueba -> ERROR: %s', left(sqlerrm, 40));
  end;

  -- ═══ apply_moderation_action (TASK-264) ═════════════════════════════════

  insert into public.moderation_cases (entity_type, entity_id, reason, opened_by_user_id)
  values ('job_posting', gen_random_uuid(), 'probe', v_priv)
  returning id into v_case;

  -- 5. Denegado sin permiso.
  perform set_config('request.jwt.claims', json_build_object('sub', v_plain, 'role','authenticated')::text, true);
  begin
    perform public.apply_moderation_action(v_case, 'warn'::public.moderation_action_type, 'nota');
    v_out := v_out || ' | 5) moderacion sin permiso -> PERMITIDA (fallo)';
  exception when others then
    v_out := v_out || ' | 5) moderacion sin permiso -> DENEGADA';
  end;

  -- 6. Cada acción del enum, con permiso, sobre un caso nuevo.
  perform set_config('request.jwt.claims', json_build_object('sub', v_priv, 'role','authenticated')::text, true);
  v_out := v_out || ' | 6) acciones:';
  for i in 1..array_length(v_actions, 1) loop
    v_action := v_actions[i];
    insert into public.moderation_cases (entity_type, entity_id, reason, opened_by_user_id)
    values ('job_posting', gen_random_uuid(), 'probe ' || v_action, v_priv)
    returning id into v_case;

    begin
      perform public.apply_moderation_action(v_case, v_action::public.moderation_action_type, 'nota');
      select status::text into v_status from public.moderation_cases where id = v_case;
      v_out := v_out || format(' %s->%s', v_action, v_status);
    exception when others then
      v_out := v_out || format(' %s->ERROR(%s)', v_action, sqlstate);
    end;
  end loop;

  -- ═══ review_regional_authority_request (mismo guard corregido) ══════════

  perform set_config('request.jwt.claims', json_build_object('sub', v_plain, 'role','authenticated')::text, true);
  insert into public.regional_administrator_authority_requests
    (requester_user_id, identity_document_number, identity_document_file_path,
     first_names, last_names, phone_number, admin_scope_type, union_id,
     position_title, appointment_document_file_path)
  values (v_plain, 'DOC-REG', 'probe/reg.pdf', 'Nombre', 'Apellido', '8090000002', 'union', v_union,
          'Administrador de prueba', 'probe/appointment.pdf')
  returning id into v_req;

  -- 7. El solicitante no puede autoaprobarse.
  begin
    update public.regional_administrator_authority_requests
    set status = 'approved' where id = v_req;
    v_out := v_out || ' | 7) regional autoaprobacion -> PERMITIDA (fallo)';
  exception when others then
    v_out := v_out || ' | 7) regional autoaprobacion -> BLOQUEADA';
  end;

  -- 8. El revisor autorizado sí puede resolverla.
  perform set_config('request.jwt.claims', json_build_object('sub', v_priv, 'role','authenticated')::text, true);
  begin
    perform public.review_regional_authority_request(v_req, 'rejected', 'no procede');
    select status::text into v_status from public.regional_administrator_authority_requests where id = v_req;
    v_out := v_out || format(' | 8) regional revisor rechaza -> %s', v_status);
  exception when others then
    v_out := v_out || format(' | 8) regional revisor rechaza -> ERROR: %s', left(sqlerrm, 40));
  end;

  raise exception 'PROBE_RESULT: %', v_out;
end;
$probe$;
