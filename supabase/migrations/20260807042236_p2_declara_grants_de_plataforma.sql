-- ─────────────────────────────────────────────────────────────────────────────
-- P2 — Declarar los grants que hoy concede la plataforma, para cerrar el drift.
--
-- El problema que resuelve: la base sombra que construye `supabase db diff`
-- —y cualquier entorno nuevo levantado desde `migrations/`— nace **sin los
-- default privileges** que el proyecto desplegado sí tiene sobre `public`. En
-- el remoto, todo objeto creado por `postgres` recibe automáticamente:
--
--   * tablas    → ALL para `authenticated` y `service_role`
--   * secuencias→ ALL para `anon`, `authenticated` y `service_role`
--   * funciones → EXECUTE para `service_role`
--
-- Esos grants no están en ningún archivo, así que el job de drift los reporta
-- a diario como diferencia y un entorno nuevo saldría sin ellos: PostgREST
-- devolvería 401/permission denied en cada tabla y RPC.
--
-- Esta migración **no cambia el comportamiento del remoto**: cada sentencia de
-- aquí es idempotente y describe un privilegio que el remoto ya tiene (medido
-- objeto por objeto contra `pg_class.relacl` / `pg_proc.proacl` el 2026-08-07,
-- antes de escribirla). Lo que cambia es que ahora está escrito.
--
-- Lo que este inventario deja a la vista, y merece revisión aparte:
--   * `authenticated` tiene ALL —incluido TRUNCATE, que no pasa por RLS— sobre
--     las 56 tablas del bloque 2. Es el default de la plataforma, no una
--     decisión; restringirlo es un cambio de comportamiento y va en su propia
--     tarea, con su probe.
--   * 22 funciones conservan EXECUTE para PUBLIC (bloque 3.C). Son predicados
--     de RLS y funciones de trigger que la contención P0 dejó abiertas a
--     propósito, más `get_donation_receipt` y `list_active_donation_amount_options`,
--     que la ruta pública `/donate` necesita sin sesión.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. La fuente: los default privileges de `public` ─────────────────────────
-- Sin esto habría que volver a listar cada objeto nuevo aquí. Con esto, toda
-- tabla/función que cree una migración futura nace con los mismos grants que
-- tendría en el remoto, y el drift no se reabre.
--
-- Reproducen exactamente lo que hoy hay en `pg_default_acl` para el rol
-- `postgres` en `public`. `anon` está deliberadamente ausente de tablas y
-- funciones: lo retiraron 20260802190000 y 20260801120000.
alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- ── 2. Backfill: las tablas que ya existen ───────────────────────────────────
-- `alter default privileges` no es retroactivo, así que los objetos anteriores
-- necesitan su grant explícito.
--
-- `anon` no aparece: su superficie (5 tablas de solo lectura) ya está declarada
-- en 20260802190000. `user_access_logs` tampoco tiene `authenticated` — se lo
-- revocó 20260729130000 y se lee solo por RPC.

grant all on table
  public.application_answers,
  public.application_notes,
  public.application_ratings,
  public.application_stage_history,
  public.applications,
  public.audit_logs,
  public.authority_request_invitations,
  public.candidate_educations,
  public.candidate_experiences,
  public.candidate_languages,
  public.candidate_links,
  public.candidate_profiles,
  public.candidate_resumes,
  public.candidate_skills,
  public.church_associations,
  public.church_districts,
  public.church_unions,
  public.churches,
  public.company_profiles,
  public.donation_amount_options,
  public.donations,
  public.feature_flags,
  public.institutional_membership_applications,
  public.job_alerts,
  public.job_postings,
  public.job_screening_questions,
  public.membership_payment_settings,
  public.membership_payments,
  public.membership_roles,
  public.memberships,
  public.moderation_actions,
  public.moderation_cases,
  public.notification_deliveries,
  public.notification_delivery_logs,
  public.notification_preferences,
  public.notifications,
  public.opportunity_stage_templates,
  public.pastor_authority_requests,
  public.permissions,
  public.pipeline_stages,
  public.platform_role_permissions,
  public.platform_roles,
  public.push_subscriptions,
  public.recruiter_requests,
  public.regional_administrator_authority_requests,
  public.saved_jobs,
  public.stress_harness_runs,
  public.subscription_plans,
  public.talent_pool_entries,
  public.tenant_role_permissions,
  public.tenant_roles,
  public.tenant_subscriptions,
  public.tenants,
  public.user_authority_scopes,
  public.user_platform_roles,
  public.users
to authenticated;

-- `app_error_logs` es la excepción: 20260802140000 dejó a `authenticated` solo
-- con SELECT y UPDATE (inserta por RPC, no puede borrar ni truncar).
grant select, update on table public.app_error_logs to authenticated;

grant all on table
  public.app_error_logs,
  public.application_answers,
  public.application_notes,
  public.application_ratings,
  public.application_stage_history,
  public.applications,
  public.audit_logs,
  public.authority_request_invitations,
  public.candidate_educations,
  public.candidate_experiences,
  public.candidate_languages,
  public.candidate_links,
  public.candidate_profiles,
  public.candidate_resumes,
  public.candidate_skills,
  public.church_associations,
  public.church_districts,
  public.church_unions,
  public.churches,
  public.company_profiles,
  public.donation_amount_options,
  public.donations,
  public.feature_flags,
  public.institutional_membership_applications,
  public.job_alerts,
  public.job_postings,
  public.job_screening_questions,
  public.membership_payment_settings,
  public.membership_payments,
  public.membership_roles,
  public.memberships,
  public.moderation_actions,
  public.moderation_cases,
  public.notification_deliveries,
  public.notification_delivery_logs,
  public.notification_preferences,
  public.notifications,
  public.opportunity_stage_templates,
  public.pastor_authority_requests,
  public.permissions,
  public.pipeline_stages,
  public.platform_role_permissions,
  public.platform_roles,
  public.push_subscriptions,
  public.recruiter_requests,
  public.regional_administrator_authority_requests,
  public.saved_jobs,
  public.stress_harness_runs,
  public.subscription_plans,
  public.talent_pool_entries,
  public.tenant_role_permissions,
  public.tenant_roles,
  public.tenant_subscriptions,
  public.tenants,
  public.user_access_logs,
  public.user_authority_scopes,
  public.user_platform_roles,
  public.users
to service_role;

-- ── 3. Backfill: las funciones que ya existen ────────────────────────────────
-- Mismo criterio, con un matiz: en una base sin `pg_default_acl` para funciones,
-- Postgres aplica su default histórico y **PUBLIC recibe EXECUTE**. Por eso cada
-- bloque revoca antes de conceder: sin el revoke, el entorno nuevo quedaría más
-- abierto que el remoto, justo al revés del fallo que se quiere evitar.

-- ── 3.A. `authenticated` + `service_role` (67) ──────────────────────────
-- RPC que llama el cliente con sesión, y predicados que la RLS evalúa como el
-- rol del llamante.
do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.activate_member(p_application_id uuid, p_notes text, p_membership_months integer)',
    'public.admin_assign_platform_role(p_user_id uuid, p_role_id uuid, p_notes text)',
    'public.admin_clear_manual_access_override(p_user_id uuid, p_reason text)',
    'public.admin_create_authority_invitation(p_email text, p_authority_type text, p_expires_in_days integer, p_notes text)',
    'public.admin_create_platform_role(p_code text, p_name text, p_description text, p_permission_codes text[])',
    'public.admin_delete_platform_role(p_role_id uuid)',
    'public.admin_platform_rbac_snapshot(p_user_query text, p_user_limit integer, p_user_offset integer)',
    'public.admin_revoke_platform_role(p_assignment_id uuid, p_notes text)',
    'public.admin_search_users_for_access(p_query text, p_limit integer)',
    'public.admin_set_manual_access_override(p_user_id uuid, p_months integer, p_reason text)',
    'public.admin_update_platform_role(p_role_id uuid, p_name text, p_description text, p_permission_codes text[])',
    'public.admin_user_access_log_page(p_query text, p_since timestamp with time zone, p_limit integer, p_offset integer)',
    'public.admin_user_access_log_stats()',
    'public.apply_moderation_action(p_case_id uuid, p_action_type moderation_action_type, p_note text)',
    'public.azul_begin_membership_payment(p_application_id uuid, p_intent text, p_years integer)',
    'public.bootstrap_first_platform_owner()',
    'public.can_access_internal_console()',
    'public.can_publish_opportunity(p_tenant_id uuid)',
    'public.can_read_candidate_profile_via_application(p_profile_id uuid)',
    'public.consume_authority_invitation(p_token text, p_request_id uuid)',
    'public.deactivate_member(p_user_id uuid, p_notes text)',
    'public.email_resend_delivery(p_delivery_id uuid)',
    'public.email_test_clear()',
    'public.email_test_force_status(p_delivery_id uuid, p_status text)',
    'public.email_test_send(p_to text, p_subject text, p_message text, p_simulate text)',
    'public.enqueue_donation_receipt_email(p_donation_id uuid)',
    'public.enrich_current_access_log(p_timezone text, p_language text)',
    'public.get_authority_invitation(p_token text)',
    'public.get_candidate_profile_for_tenant(p_tenant_id uuid, p_candidate_profile_id uuid)',
    'public.get_tenant_plan_snapshot(p_tenant_id uuid)',
    'public.harness_email_suppressed()',
    'public.has_active_asi_access(p_user_id uuid)',
    'public.has_active_authority_scope(p_role authority_role_type, p_union_id uuid, p_association_id uuid, p_district_id uuid, p_church_id uuid)',
    'public.has_active_tenant_subscription(p_tenant_id uuid)',
    'public.invite_tenant_member(p_tenant_id uuid, p_email text, p_role_id uuid)',
    'public.is_applicant_visible_to_reader(p_user_id uuid)',
    'public.is_candidate_profile_owner(p_profile_id uuid)',
    'public.is_candidate_profile_visible_to_recruiters(p_candidate_profile_id uuid)',
    'public.is_platform_owner()',
    'public.mark_notification_clicked(p_notification_id uuid, p_delivery_id uuid)',
    'public.mark_notification_read(p_notification_id uuid)',
    'public.mark_notification_unread(p_notification_id uuid)',
    'public.move_application_stage(p_application_id uuid, p_to_stage_id uuid, p_note text)',
    'public.my_tenant_ids()',
    'public.open_moderation_case(p_entity_type text, p_entity_id uuid, p_tenant_id uuid, p_reason text, p_severity text, p_metadata jsonb)',
    'public.pastor_has_scope_over_member(p_member_user_id text)',
    'public.pastor_user_for_church(p_church_id uuid)',
    'public.platform_ops_snapshot()',
    'public.queue_push_notification(p_recipient_user_id uuid, p_type text, p_title text, p_body text, p_action_url text, p_payload jsonb, p_tenant_id uuid)',
    'public.register_push_subscription(p_endpoint text, p_p256dh_key text, p_auth_key text, p_device_label text, p_device_kind text, p_locale text, p_user_agent text, p_tenant_id uuid)',
    'public.respond_membership_application(p_application_id uuid, p_response_note text)',
    'public.review_membership_application(p_application_id uuid, p_decision review_workflow_status, p_pastoral_reference pastoral_reference_status, p_review_notes text)',
    'public.review_pastor_authority_request(p_request_id uuid, p_decision review_workflow_status, p_review_notes text)',
    'public.review_recruiter_request(p_request_id uuid, p_decision recruiter_request_status, p_review_notes text)',
    'public.review_regional_authority_request(p_request_id uuid, p_decision review_workflow_status, p_review_notes text)',
    'public.revoke_authority_invitation(p_id uuid)',
    'public.revoke_membership_invite(p_membership_id uuid)',
    'public.search_candidate_profiles(p_tenant_id uuid, p_query text, p_country_code text, p_language text, p_skill text, p_limit integer, p_sort text, p_saved_only boolean, p_cursor jsonb)',
    'public.shares_active_tenant_with(p_user_id uuid)',
    'public.submit_application(p_job_posting_id uuid, p_submitted_resume_id uuid, p_cover_letter text, p_answers jsonb)',
    'public.tenant_applications_page(p_tenant_id uuid, p_status text, p_query text, p_sort text, p_limit integer, p_cursor jsonb)',
    'public.tenant_applications_stats(p_tenant_id uuid)',
    'public.trigger_email_dispatch()',
    'public.update_application_resume(p_application_id uuid, p_submitted_resume_id uuid)',
    'public.update_push_delivery_status(p_delivery_id uuid, p_delivery_status text, p_response_code integer, p_provider_message_id text, p_response_payload jsonb, p_log_level text, p_log_message text, p_deactivate_subscription boolean, p_permission_state text)',
    'public.upsert_notification_preferences(p_locale text, p_email_enabled boolean, p_push_enabled boolean, p_in_app_enabled boolean, p_quiet_hours_json jsonb, p_tenant_id uuid)',
    'public.verify_membership_payment(p_payment_id uuid, p_decision membership_payment_status, p_notes text)'
  ] loop
    execute format('revoke all on function %s from public, anon', v_sig);
    execute format('grant execute on function %s to authenticated, service_role', v_sig);
  end loop;
end;
$$;
-- ── 3.B. Solo `service_role` (22) ───────────────────────────────────────
-- Funciones de trigger y RPC internas (cron, microservicio AZUL, Edge Functions
-- con la llave de servicio). Ningún cliente con JWT de usuario las invoca.
do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.assert_job_publish_limit()',
    'public.assign_default_subscription_to_tenant()',
    'public.azul_begin_donation(p_amount_option_id uuid, p_custom_amount numeric, p_donor_name text, p_donor_email text, p_donor_phone text, p_donor_user_id uuid, p_campaign_slug text, p_designation text)',
    'public.azul_settle_donation_payment(p_order_number text, p_approved boolean, p_response jsonb)',
    'public.azul_settle_membership_payment(p_order_number text, p_approved boolean, p_response jsonb)',
    'public.claim_email_deliveries(p_limit integer, p_lease_seconds integer, p_max_attempts integer)',
    'public.complete_email_delivery(p_delivery_id uuid, p_claim_token uuid, p_status text, p_response_code integer, p_provider_message_id text, p_response_payload jsonb)',
    'public.handle_new_auth_user()',
    'public.notify_application_submitted()',
    'public.notify_candidate_status_change()',
    'public.notify_membership_admins(p_type text, p_title text, p_body text, p_action_url text, p_payload jsonb)',
    'public.notify_membership_application_submitted()',
    'public.notify_membership_payment_submitted()',
    'public.notify_recruiter_request_review()',
    'public.rls_auto_enable()',
    'public.route_membership_application()',
    'public.set_harness_email_suppression(p_active boolean)',
    'public.set_runtime_secret(p_key text, p_value text)',
    'public.suppress_email_delivery_when_harness()',
    'public.sync_application_candidate_snapshots()',
    'public.sync_auth_user_contact_fields()',
    'public.system_create_notification(p_recipient_user_id uuid, p_type text, p_title text, p_body text, p_action_url text, p_payload jsonb, p_tenant_id uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_sig);
    execute format('grant execute on function %s to service_role', v_sig);
  end loop;
end;
$$;
-- ── 3.C. PUBLIC + los tres roles (22) ───────────────────────────────────
-- Aquí NO se revoca PUBLIC: hoy lo tienen y quitarlo sí cambiaría el
-- comportamiento. Son predicados de RLS, funciones de trigger y las dos
-- lecturas que `/donate` hace sin sesión.
do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.can_read_application(p_application_id uuid)',
    'public.ensure_candidate_resume_default()',
    'public.get_donation_receipt(p_order_number text)',
    'public.get_plan_limit_json(p_tenant_id uuid)',
    'public.guard_pastor_authority_request_submission()',
    'public.guard_recruiter_request_update()',
    'public.guard_regional_authority_request_submission()',
    'public.guard_user_profile_update()',
    'public.has_platform_permission(permission_code text)',
    'public.has_tenant_permission(p_tenant_id uuid, permission_code text)',
    'public.is_platform_admin()',
    'public.is_tenant_member(p_tenant_id uuid)',
    'public.list_active_donation_amount_options()',
    'public.promote_latest_candidate_resume_after_delete()',
    'public.set_candidate_profile_completeness()',
    'public.set_row_updated_at()',
    'public.sync_application_public_status_from_stage(stage_code text)',
    'public.touch_candidate_profile_after_child_change()',
    'public.touch_job_posting_status_timestamps()',
    'public.validate_job_posting_requirements()',
    'public.validate_job_posting_tenant_kind()',
    'public.validate_recruiter_request_requirements()'
  ] loop
    execute format('grant execute on function %s to public, anon, authenticated, service_role', v_sig);
  end loop;
end;
$$;
-- ── 3.D. `anon` + `authenticated` + `service_role` (1) ──────────────────
-- Ingesta de errores del cliente: la llama también un visitante sin sesión.
do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.log_client_error(p_source text, p_error_message text, p_user_message text, p_route text, p_severity text, p_error_code text, p_metadata jsonb)'
  ] loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('grant execute on function %s to anon, authenticated, service_role', v_sig);
  end loop;
end;
$$;
