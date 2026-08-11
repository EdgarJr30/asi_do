-- Probe de la Fase D (20260807145727): los grants de tabla de `authenticated`.
--
-- Dos comprobaciones distintas, a propósito:
--   * El **catálogo**: la matriz de abajo es el contrato. Cada tabla de `public`
--     debe tener exactamente los privilegios declarados, ni uno más ni uno
--     menos. Si aparece una tabla nueva sin entrada, la probe falla: obliga a
--     decidir su superficie en vez de heredarla.
--   * El **comportamiento**: impersona a `authenticated` y lee de verdad. Un
--     grant correcto en el catálogo que igual devuelve `permission denied` —o
--     al revés— aquí se ve. Es lo que un `select` sobre `information_schema` no
--     puede contestar.
--
-- Letras: S=select, I=insert, U=update, D=delete, T=truncate, R=references,
-- G=trigger. TRUNCATE, REFERENCES y TRIGGER no deben aparecer nunca: PostgREST
-- no los usa y TRUNCATE no pasa por RLS.
--
-- Termina en RAISE EXCEPTION: la transacción se revierte siempre.
do $probe$
declare
  v_matriz text[] := array[
    'app_error_logs=SU',
    'application_answers=',
    'application_notes=SI',
    'application_ratings=SIU',
    'application_stage_history=S',
    'applications=S',
    'audit_logs=',
    'authority_request_invitations=S',
    'candidate_educations=SID',
    'candidate_experiences=SID',
    'candidate_languages=SID',
    'candidate_links=SID',
    'candidate_profiles=SIU',
    'candidate_resumes=SIUD',
    'candidate_skills=SID',
    'church_associations=S',
    'church_districts=S',
    'church_unions=S',
    'churches=S',
    'company_profiles=SU',
    'donation_amount_options=SIUD',
    'donations=S',
    -- Solo lectura, y solo para quien tenga `email:read`: el historial de
    -- eventos de Resend lo escribe `record_resend_webhook_event`, que es
    -- `service_role`. El cliente lo consulta desde /admin/correos.
    'email_delivery_events=S',
    -- Campañas y supresiones: el cliente solo las lee. Encolar y dar de baja
    -- pasa por `email_broadcast_enqueue` y `email_unsubscribe`, que son
    -- `security definer`: escribir directo saltaria la guarda de permiso y la
    -- deduplicacion.
    'email_broadcasts=S',
    'email_suppressions=S',
    -- Sin un solo privilegio para `authenticated`: solo la alcanza
    -- `email_unsubscribe`, que es `security definer`. Legible por PostgREST
    -- seria un listado de direcciones y un oraculo de tokens de baja validos.
    'email_unsubscribe_tokens=',
    'feature_flags=SU',
    'institutional_membership_applications=SIU',
    'job_alerts=SIUD',
    'job_postings=SIU',
    'job_screening_questions=SID',
    -- Sin superficie de cliente: la escribe el cron de recordatorios y lo que
    -- la consola necesita —cuándo vence cada quien— ya está en `users`.
    'membership_renewal_reminders=',
    'membership_payment_settings=SU',
    'membership_payments=S',
    'membership_roles=SIU',
    'memberships=S',
    'moderation_actions=S',
    'moderation_cases=S',
    'notification_deliveries=S',
    'notification_delivery_logs=',
    'notification_preferences=',
    'notifications=SU',
    'opportunity_stage_templates=S',
    'pastor_authority_requests=SI',
    'permissions=S',
    'pipeline_stages=S',
    'platform_role_permissions=',
    'platform_roles=',
    'push_subscriptions=',
    'recruiter_requests=SI',
    'regional_administrator_authority_requests=SI',
    'saved_jobs=SID',
    'stress_harness_runs=S',
    'subscription_plans=',
    'talent_pool_entries=SID',
    'tenant_role_permissions=S',
    'tenant_roles=S',
    'tenant_subscriptions=',
    'tenants=S',
    'user_access_logs=',
    'user_authority_scopes=S',
    'user_platform_roles=',
    'users=SU'
  ];
  v_item text;
  v_tabla text;
  v_esperado text;
  v_real text;
  v_out text := '';
  v_ok int := 0;
  v_fail int := 0;
  v_n bigint;
  r record;
  v_legibles text[] := array[

    'app_error_logs',
    'application_notes',
    'application_ratings',
    'application_stage_history',
    'applications',
    'authority_request_invitations',
    'candidate_educations',
    'candidate_experiences',
    'candidate_languages',
    'candidate_links',
    'candidate_profiles',
    'candidate_resumes',
    'candidate_skills',
    'church_associations',
    'church_districts',
    'church_unions',
    'churches',
    'company_profiles',
    'donation_amount_options',
    'donations',
    'email_broadcasts',
    'email_delivery_events',
    'email_suppressions',
    'feature_flags',
    'institutional_membership_applications',
    'job_alerts',
    'job_postings',
    'job_screening_questions',
    'membership_payment_settings',
    'membership_payments',
    'membership_roles',
    'memberships',
    'moderation_actions',
    'moderation_cases',
    'notification_deliveries',
    'notifications',
    'opportunity_stage_templates',
    'pastor_authority_requests',
    'permissions',
    'pipeline_stages',
    'recruiter_requests',
    'regional_administrator_authority_requests',
    'saved_jobs',
    'stress_harness_runs',
    'talent_pool_entries',
    'tenant_role_permissions',
    'tenant_roles',
    'tenants',
    'user_authority_scopes',
    'users'
  ];
  v_prohibidas text[] := array[

    'application_answers',
    'audit_logs',
    'notification_delivery_logs',
    'notification_preferences',
    'platform_role_permissions',
    'platform_roles',
    'push_subscriptions',
    'subscription_plans',
    'tenant_subscriptions',
    'user_access_logs',
    'user_platform_roles'
  ];
begin
  -- ── A) La matriz de privilegios ────────────────────────────────────────────
  foreach v_item in array v_matriz loop
    v_tabla := split_part(v_item, '=', 1);
    v_esperado := split_part(v_item, '=', 2);

    if to_regclass(format('public.%I', v_tabla)) is null then
      v_fail := v_fail + 1;
      v_out := v_out || format(E'\n  A: la tabla %s ya no existe; actualiza la matriz', v_tabla);
      continue;
    end if;

    v_real := '';
    if has_table_privilege('authenticated', format('public.%I', v_tabla), 'select')     then v_real := v_real || 'S'; end if;
    if has_table_privilege('authenticated', format('public.%I', v_tabla), 'insert')     then v_real := v_real || 'I'; end if;
    if has_table_privilege('authenticated', format('public.%I', v_tabla), 'update')     then v_real := v_real || 'U'; end if;
    if has_table_privilege('authenticated', format('public.%I', v_tabla), 'delete')     then v_real := v_real || 'D'; end if;
    if has_table_privilege('authenticated', format('public.%I', v_tabla), 'truncate')   then v_real := v_real || 'T'; end if;
    if has_table_privilege('authenticated', format('public.%I', v_tabla), 'references') then v_real := v_real || 'R'; end if;
    if has_table_privilege('authenticated', format('public.%I', v_tabla), 'trigger')    then v_real := v_real || 'G'; end if;

    if v_real = v_esperado then
      v_ok := v_ok + 1;
    else
      v_fail := v_fail + 1;
      v_out := v_out || format(E'\n  A: %s tiene [%s], se esperaba [%s]', v_tabla, v_real, v_esperado);
    end if;
  end loop;

  -- ── B) Ninguna tabla fuera de la matriz ────────────────────────────────────
  -- Una tabla nueva hereda de los default privileges, así que si aparece sin
  -- entrada aquí, nadie decidió su superficie.
  select count(*) into v_n
  from pg_tables t
  where t.schemaname = 'public'
    and not exists (
      select 1 from unnest(v_matriz) m where split_part(m, '=', 1) = t.tablename
    );
  if v_n = 0 then
    v_ok := v_ok + 1;
  else
    v_fail := v_fail + 1;
    v_out := v_out || format(E'\n  B: %s tablas de public no están en la matriz', v_n);
  end if;

  -- ── C) TRUNCATE, en concreto ───────────────────────────────────────────────
  -- Es el privilegio que motivó la fase: no pasa por RLS.
  select count(*) into v_n
  from pg_tables t
  where t.schemaname = 'public'
    and has_table_privilege('authenticated', format('%I.%I', t.schemaname, t.tablename), 'truncate');
  if v_n = 0 then
    v_ok := v_ok + 1;
  else
    v_fail := v_fail + 1;
    v_out := v_out || format(E'\n  C: `authenticated` conserva TRUNCATE en %s tablas', v_n);
  end if;

  -- ── D) La fuente ───────────────────────────────────────────────────────────
  -- Si `authenticated` vuelve a los default privileges, la próxima tabla nace
  -- otra vez con ALL y el recorte se deshace sola.
  select count(*) into v_n
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and pg_get_userbyid(d.defaclrole) = 'postgres'
    and d.defaclobjtype = 'r'
    and d.defaclacl::text like '%authenticated=%';
  if v_n = 0 then
    v_ok := v_ok + 1;
  else
    v_fail := v_fail + 1;
    v_out := v_out || E'\n  D: `authenticated` volvió a los default privileges de tablas';
  end if;

  -- ── E) Comportamiento: leer de verdad como `authenticated` ─────────────────
  -- RLS puede devolver cero filas y está bien; lo que no puede es dar 42501.
  set local role authenticated;
  foreach v_tabla in array v_legibles loop
    begin
      execute format('select 1 from public.%I limit 1', v_tabla);
      v_ok := v_ok + 1;
    exception when insufficient_privilege then
      v_fail := v_fail + 1;
      v_out := v_out || format(E'\n  E: `authenticated` no puede leer %s (la app la lee)', v_tabla);
    end;
  end loop;

  -- ── F) Comportamiento: lo retirado está retirado ───────────────────────────
  foreach v_tabla in array v_prohibidas loop
    begin
      execute format('select 1 from public.%I limit 1', v_tabla);
      v_fail := v_fail + 1;
      v_out := v_out || format(E'\n  F: `authenticated` todavía lee %s', v_tabla);
    exception when insufficient_privilege then
      v_ok := v_ok + 1;
    end;
  end loop;
  reset role;

  -- ── G) Comportamiento: la escritura, en los dos sentidos ───────────────────
  -- Leer no basta. Esta parte ejecuta el INSERT, el UPDATE y el DELETE reales
  -- de cada tabla y comprueba que pasa exactamente lo declarado: que la
  -- operación concedida no da 42501, y que la retirada sí.
  --
  -- `where false` es lo que lo hace seguro: Postgres verifica el privilegio al
  -- planificar, antes de mirar una sola fila, así que la comprobación es real
  -- pero no toca ni un dato. Tampoco evalúa RLS —sin filas no hay política que
  -- aplicar—, que es justo lo que se quiere: aquí se mide el grant, no la
  -- política. Y la columna se elige del catálogo evitando identidad y
  -- generadas, que no admiten asignación.
  for r in
    select
      split_part(m, '=', 1) as tabla,
      split_part(m, '=', 2) as privs,
      (
        select a.attname
        from pg_attribute a
        where a.attrelid = to_regclass('public.' || quote_ident(split_part(m, '=', 1)))
          and a.attnum > 0
          and not a.attisdropped
          and a.attidentity = ''
          and a.attgenerated = ''
        order by a.attnum
        limit 1
      ) as col
    from unnest(v_matriz) m
  loop
    if r.col is null then
      continue;
    end if;

    foreach v_item in array array['I', 'U', 'D'] loop
      v_esperado := case when position(v_item in r.privs) > 0 then 'permitido' else 'denegado' end;
      v_real := 'permitido';

      begin
        set local role authenticated;
        case v_item
          when 'I' then
            execute format(
              'insert into public.%I (%I) select %I from public.%I where false',
              r.tabla, r.col, r.col, r.tabla
            );
          when 'U' then
            execute format('update public.%I set %I = %I where false', r.tabla, r.col, r.col);
          when 'D' then
            execute format('delete from public.%I where false', r.tabla);
        end case;
      exception
        when insufficient_privilege then
          v_real := 'denegado';
        when others then
          -- Cualquier otro error (una restricción, un trigger) significa que el
          -- privilegio existía: el statement llegó a ejecutarse.
          v_real := 'permitido';
      end;
      reset role;

      if v_real = v_esperado then
        v_ok := v_ok + 1;
      else
        v_fail := v_fail + 1;
        v_out := v_out || format(E'\n  G: %s con %s → %s, se esperaba %s', r.tabla, v_item, v_real, v_esperado);
      end if;
    end loop;
  end loop;

  raise exception E'PROBE_VERDICT status=% fails=% | OK: % %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail,
    v_ok, coalesce(nullif(v_out, ''), E'\n  (sin desviaciones)');
end;
$probe$;
