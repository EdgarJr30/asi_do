-- Verificación de la Fase B: las superficies públicas deben seguir funcionando
-- como rol `anon`, y las RPC de sesión deben quedar denegadas.
-- Termina en RAISE EXCEPTION para revertir cualquier efecto.
do $probe$
declare
  v_out text := '';
  v_n integer;
begin
  perform set_config('role', 'anon', true);

  -- 1. Job board público: lectura anónima de vacantes (usa políticas RLS que
  --    invocan predicados; si les faltara EXECUTE, esto daría permission denied).
  begin
    select count(*) into v_n from public.job_postings;
    v_out := v_out || format('1) job_postings anon -> OK (%s filas visibles)', v_n);
  exception when others then
    v_out := v_out || format('1) job_postings anon -> ROTO: %s', sqlerrm);
  end;

  -- 2. Opciones de donación: RPC que debe seguir siendo pública.
  begin
    perform public.list_active_donation_amount_options();
    v_out := v_out || ' | 2) donation options anon -> OK';
  exception when others then
    v_out := v_out || format(' | 2) donation options anon -> ROTO: %s', sqlerrm);
  end;

  -- 3. Recibo de donación: también público.
  begin
    perform public.get_donation_receipt('NO-EXISTE');
    v_out := v_out || ' | 3) donation receipt anon -> OK';
  exception when insufficient_privilege then
    v_out := v_out || ' | 3) donation receipt anon -> ROTO: sin privilegio';
  when others then
    v_out := v_out || ' | 3) donation receipt anon -> OK (error de datos, no de permiso)';
  end;

  -- 4. Lectura anónima de usuarios: la política invoca is_tenant_member y
  --    has_platform_permission; comprueba que los predicados siguen evaluables.
  begin
    select count(*) into v_n from public.users;
    v_out := v_out || format(' | 4) predicados RLS anon -> OK (%s filas)', v_n);
  exception when others then
    v_out := v_out || format(' | 4) predicados RLS anon -> ROTO: %s', sqlerrm);
  end;

  -- 5. RPC de sesión: ahora debe estar denegada para anon.
  begin
    perform public.submit_application(null::uuid, null::uuid, null::text, '{}'::jsonb);
    v_out := v_out || ' | 5) submit_application anon -> PERMITIDA (fallo)';
  exception when insufficient_privilege then
    v_out := v_out || ' | 5) submit_application anon -> DENEGADA';
  when others then
    v_out := v_out || format(' | 5) submit_application anon -> alcanzo la funcion (%s)', sqlstate);
  end;

  -- 6. Otra RPC administrativa, tambien denegada.
  begin
    perform public.platform_ops_snapshot();
    v_out := v_out || ' | 6) platform_ops_snapshot anon -> PERMITIDA (fallo)';
  exception when insufficient_privilege then
    v_out := v_out || ' | 6) platform_ops_snapshot anon -> DENEGADA';
  when others then
    v_out := v_out || format(' | 6) platform_ops_snapshot anon -> alcanzo la funcion (%s)', sqlstate);
  end;

  raise exception 'PROBE_RESULT: %', v_out;
end;
$probe$;
