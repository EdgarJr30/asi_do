-- ─────────────────────────────────────────────────────────────────────────────
-- Fase B — Retirar `anon` de las RPC que exigen sesión (auditoría 2026-07-29).
--
-- La migración 20260801120000 cerró las RPC internas. Quedaban 71 funciones
-- SECURITY DEFINER ejecutables por `anon`: las que llama el cliente autenticado
-- y los predicados usados dentro de políticas RLS. Todas dependían de su guarda
-- interna (`auth.uid() is null` → excepción) como única frontera; esto añade la
-- frontera de permisos, que es la que no se puede olvidar al escribir código.
--
-- Se conserva `authenticated` en las 64; solo se retira `anon`.
--
-- ── Las 7 que SÍ conservan `anon` y por qué ──────────────────────────────────
--
-- Predicados invocados por políticas RLS que alcanzan al rol `anon` (26
-- políticas medidas en el remoto). Una política se evalúa con los privilegios
-- del llamante: sin EXECUTE, la lectura pública falla con «permission denied
-- for function» en vez de devolver cero filas.
--   * can_read_application
--   * has_platform_permission
--   * has_tenant_permission
--   * is_platform_admin
--   * is_tenant_member
--
-- Llamadas desde /donate, que vive en la experiencia institucional pública y
-- admite donaciones anónimas:
--   * list_active_donation_amount_options  (donation-api.ts)
--   * get_donation_receipt                 (donation-checkout-section.tsx)
--
-- ── Verificado antes de revocar ──────────────────────────────────────────────
-- Todas las demás se invocan desde superficies tras `RequireAuth`, o desde
-- servicios que reenvían el JWT del usuario (rol efectivo `authenticated`):
--   * azul_begin_membership_payment  — microservicio con cliente user-scoped
--   * queue_push_notification / update_push_delivery_status — Edge Function
--     send-notification reenvía el Authorization del usuario
--   * get_authority_invitation — la ruta authority-request/:token está dentro
--     del árbol envuelto en RequireAuth
--   * enrich_current_access_log — el provider corta si no hay session.user.id
-- ─────────────────────────────────────────────────────────────────────────────

revoke execute on function public.activate_member(p_application_id uuid, p_notes text, p_membership_months integer) from anon;
revoke execute on function public.admin_assign_platform_role(p_user_id uuid, p_role_id uuid, p_notes text) from anon;
revoke execute on function public.admin_clear_manual_access_override(p_user_id uuid, p_reason text) from anon;
revoke execute on function public.admin_create_authority_invitation(p_email text, p_authority_type text, p_expires_in_days integer, p_notes text) from anon;
revoke execute on function public.admin_create_platform_role(p_code text, p_name text, p_description text, p_permission_codes text[]) from anon;
revoke execute on function public.admin_delete_platform_role(p_role_id uuid) from anon;
revoke execute on function public.admin_platform_rbac_snapshot(p_user_query text, p_user_limit integer, p_user_offset integer) from anon;
revoke execute on function public.admin_revoke_platform_role(p_assignment_id uuid, p_notes text) from anon;
revoke execute on function public.admin_search_users_for_access(p_query text, p_limit integer) from anon;
revoke execute on function public.admin_set_manual_access_override(p_user_id uuid, p_months integer, p_reason text) from anon;
revoke execute on function public.admin_update_platform_role(p_role_id uuid, p_name text, p_description text, p_permission_codes text[]) from anon;
revoke execute on function public.admin_user_access_log_page(p_query text, p_since timestamp with time zone, p_limit integer, p_offset integer) from anon;
revoke execute on function public.apply_moderation_action(p_case_id uuid, p_action_type moderation_action_type, p_note text) from anon;
revoke execute on function public.azul_begin_membership_payment(p_application_id uuid, p_intent text, p_years integer) from anon;
revoke execute on function public.bootstrap_first_platform_owner() from anon;
revoke execute on function public.can_access_internal_console() from anon;
revoke execute on function public.can_publish_opportunity(p_tenant_id uuid) from anon;
revoke execute on function public.can_read_candidate_profile_via_application(p_profile_id uuid) from anon;
revoke execute on function public.consume_authority_invitation(p_token text, p_request_id uuid) from anon;
revoke execute on function public.deactivate_member(p_user_id uuid, p_notes text) from anon;
revoke execute on function public.email_resend_delivery(p_delivery_id uuid) from anon;
revoke execute on function public.email_test_clear() from anon;
revoke execute on function public.email_test_force_status(p_delivery_id uuid, p_status text) from anon;
revoke execute on function public.email_test_send(p_to text, p_subject text, p_message text, p_simulate text) from anon;
revoke execute on function public.enqueue_donation_receipt_email(p_donation_id uuid) from anon;
revoke execute on function public.enrich_current_access_log(p_timezone text, p_language text) from anon;
revoke execute on function public.get_authority_invitation(p_token text) from anon;
revoke execute on function public.get_candidate_profile_for_tenant(p_tenant_id uuid, p_candidate_profile_id uuid) from anon;
revoke execute on function public.get_tenant_plan_snapshot(p_tenant_id uuid) from anon;
revoke execute on function public.harness_email_suppressed() from anon;
revoke execute on function public.has_active_asi_access(p_user_id uuid) from anon;
revoke execute on function public.has_active_authority_scope(p_role authority_role_type, p_union_id uuid, p_association_id uuid, p_district_id uuid, p_church_id uuid) from anon;
revoke execute on function public.has_active_tenant_subscription(p_tenant_id uuid) from anon;
revoke execute on function public.invite_tenant_member(p_tenant_id uuid, p_email text, p_role_id uuid) from anon;
revoke execute on function public.is_applicant_visible_to_reader(p_user_id uuid) from anon;
revoke execute on function public.is_candidate_profile_owner(p_profile_id uuid) from anon;
revoke execute on function public.is_candidate_profile_visible_to_recruiters(p_candidate_profile_id uuid) from anon;
revoke execute on function public.is_platform_owner() from anon;
revoke execute on function public.mark_notification_clicked(p_notification_id uuid, p_delivery_id uuid) from anon;
revoke execute on function public.mark_notification_read(p_notification_id uuid) from anon;
revoke execute on function public.mark_notification_unread(p_notification_id uuid) from anon;
revoke execute on function public.move_application_stage(p_application_id uuid, p_to_stage_id uuid, p_note text) from anon;
revoke execute on function public.my_tenant_ids() from anon;
revoke execute on function public.open_moderation_case(p_entity_type text, p_entity_id uuid, p_tenant_id uuid, p_reason text, p_severity text, p_metadata jsonb) from anon;
revoke execute on function public.pastor_has_scope_over_member(p_member_user_id text) from anon;
revoke execute on function public.pastor_user_for_church(p_church_id uuid) from anon;
revoke execute on function public.platform_ops_snapshot() from anon;
revoke execute on function public.queue_push_notification(p_recipient_user_id uuid, p_type text, p_title text, p_body text, p_action_url text, p_payload jsonb, p_tenant_id uuid) from anon;
revoke execute on function public.register_push_subscription(p_endpoint text, p_p256dh_key text, p_auth_key text, p_device_label text, p_device_kind text, p_locale text, p_user_agent text, p_tenant_id uuid) from anon;
revoke execute on function public.respond_membership_application(p_application_id uuid, p_response_note text) from anon;
revoke execute on function public.review_membership_application(p_application_id uuid, p_decision review_workflow_status, p_pastoral_reference pastoral_reference_status, p_review_notes text) from anon;
revoke execute on function public.review_pastor_authority_request(p_request_id uuid, p_decision review_workflow_status, p_review_notes text) from anon;
revoke execute on function public.review_recruiter_request(p_request_id uuid, p_decision recruiter_request_status, p_review_notes text) from anon;
revoke execute on function public.review_regional_authority_request(p_request_id uuid, p_decision review_workflow_status, p_review_notes text) from anon;
revoke execute on function public.revoke_authority_invitation(p_id uuid) from anon;
revoke execute on function public.revoke_membership_invite(p_membership_id uuid) from anon;
revoke execute on function public.search_candidate_profiles(p_tenant_id uuid, p_query text, p_country_code text, p_language text, p_skill text, p_limit integer, p_offset integer, p_sort text, p_saved_only boolean) from anon;
revoke execute on function public.shares_active_tenant_with(p_user_id uuid) from anon;
revoke execute on function public.submit_application(p_job_posting_id uuid, p_submitted_resume_id uuid, p_cover_letter text, p_answers jsonb) from anon;
revoke execute on function public.trigger_email_dispatch() from anon;
revoke execute on function public.update_application_resume(p_application_id uuid, p_submitted_resume_id uuid) from anon;
revoke execute on function public.update_push_delivery_status(p_delivery_id uuid, p_delivery_status text, p_response_code integer, p_provider_message_id text, p_response_payload jsonb, p_log_level text, p_log_message text, p_deactivate_subscription boolean, p_permission_state text) from anon;
revoke execute on function public.upsert_notification_preferences(p_locale text, p_email_enabled boolean, p_push_enabled boolean, p_in_app_enabled boolean, p_quiet_hours_json jsonb, p_tenant_id uuid) from anon;
revoke execute on function public.verify_membership_payment(p_payment_id uuid, p_decision membership_payment_status, p_notes text) from anon;

