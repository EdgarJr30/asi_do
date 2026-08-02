-- ─────────────────────────────────────────────────────────────────────────────
-- Fase B (corrección) — Retirar también el grant a PUBLIC.
--
-- La migración 20260801160000 revocó `EXECUTE` a `anon` sobre 64 RPC, pero la
-- verificación mostró que `anon` seguía alcanzándolas: el grant explícito de
-- `anon` desapareció de la ACL y aun así `has_function_privilege('anon', ...)`
-- devolvía true, porque **el grant a PUBLIC seguía presente** (`=X/postgres`) y
-- todo rol lo hereda.
--
-- Es la misma trampa que originó el P0 de esta auditoría, en espejo: revocar el
-- rol nombrado no basta si PUBLIC conserva el privilegio, igual que revocar
-- PUBLIC no bastaba si el rol nombrado tenía el suyo. Solo cuando ninguno de
-- los dos concede el privilegio queda realmente cerrado.
--
-- Aquí se retira PUBLIC y se concede `authenticated` de forma explícita, para
-- que la ACL resultante exprese la intención en vez de depender de herencia:
-- lo que el cliente autenticado puede llamar está escrito, y nada más lo abre.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Retirar el privilegio heredado vía PUBLIC ─────────────────────────────
revoke execute on function public.activate_member(p_application_id uuid, p_notes text, p_membership_months integer) from public;
revoke execute on function public.admin_assign_platform_role(p_user_id uuid, p_role_id uuid, p_notes text) from public;
revoke execute on function public.admin_clear_manual_access_override(p_user_id uuid, p_reason text) from public;
revoke execute on function public.admin_create_authority_invitation(p_email text, p_authority_type text, p_expires_in_days integer, p_notes text) from public;
revoke execute on function public.admin_create_platform_role(p_code text, p_name text, p_description text, p_permission_codes text[]) from public;
revoke execute on function public.admin_delete_platform_role(p_role_id uuid) from public;
revoke execute on function public.admin_platform_rbac_snapshot(p_user_query text, p_user_limit integer, p_user_offset integer) from public;
revoke execute on function public.admin_revoke_platform_role(p_assignment_id uuid, p_notes text) from public;
revoke execute on function public.admin_search_users_for_access(p_query text, p_limit integer) from public;
revoke execute on function public.admin_set_manual_access_override(p_user_id uuid, p_months integer, p_reason text) from public;
revoke execute on function public.admin_update_platform_role(p_role_id uuid, p_name text, p_description text, p_permission_codes text[]) from public;
revoke execute on function public.admin_user_access_log_page(p_query text, p_since timestamp with time zone, p_limit integer, p_offset integer) from public;
revoke execute on function public.apply_moderation_action(p_case_id uuid, p_action_type moderation_action_type, p_note text) from public;
revoke execute on function public.azul_begin_membership_payment(p_application_id uuid, p_intent text, p_years integer) from public;
revoke execute on function public.bootstrap_first_platform_owner() from public;
revoke execute on function public.can_access_internal_console() from public;
revoke execute on function public.can_publish_opportunity(p_tenant_id uuid) from public;
revoke execute on function public.can_read_candidate_profile_via_application(p_profile_id uuid) from public;
revoke execute on function public.consume_authority_invitation(p_token text, p_request_id uuid) from public;
revoke execute on function public.deactivate_member(p_user_id uuid, p_notes text) from public;
revoke execute on function public.email_resend_delivery(p_delivery_id uuid) from public;
revoke execute on function public.email_test_clear() from public;
revoke execute on function public.email_test_force_status(p_delivery_id uuid, p_status text) from public;
revoke execute on function public.email_test_send(p_to text, p_subject text, p_message text, p_simulate text) from public;
revoke execute on function public.enqueue_donation_receipt_email(p_donation_id uuid) from public;
revoke execute on function public.enrich_current_access_log(p_timezone text, p_language text) from public;
revoke execute on function public.get_authority_invitation(p_token text) from public;
revoke execute on function public.get_candidate_profile_for_tenant(p_tenant_id uuid, p_candidate_profile_id uuid) from public;
revoke execute on function public.get_tenant_plan_snapshot(p_tenant_id uuid) from public;
revoke execute on function public.harness_email_suppressed() from public;
revoke execute on function public.has_active_asi_access(p_user_id uuid) from public;
revoke execute on function public.has_active_authority_scope(p_role authority_role_type, p_union_id uuid, p_association_id uuid, p_district_id uuid, p_church_id uuid) from public;
revoke execute on function public.has_active_tenant_subscription(p_tenant_id uuid) from public;
revoke execute on function public.invite_tenant_member(p_tenant_id uuid, p_email text, p_role_id uuid) from public;
revoke execute on function public.is_applicant_visible_to_reader(p_user_id uuid) from public;
revoke execute on function public.is_candidate_profile_owner(p_profile_id uuid) from public;
revoke execute on function public.is_candidate_profile_visible_to_recruiters(p_candidate_profile_id uuid) from public;
revoke execute on function public.is_platform_owner() from public;
revoke execute on function public.mark_notification_clicked(p_notification_id uuid, p_delivery_id uuid) from public;
revoke execute on function public.mark_notification_read(p_notification_id uuid) from public;
revoke execute on function public.mark_notification_unread(p_notification_id uuid) from public;
revoke execute on function public.move_application_stage(p_application_id uuid, p_to_stage_id uuid, p_note text) from public;
revoke execute on function public.my_tenant_ids() from public;
revoke execute on function public.open_moderation_case(p_entity_type text, p_entity_id uuid, p_tenant_id uuid, p_reason text, p_severity text, p_metadata jsonb) from public;
revoke execute on function public.pastor_has_scope_over_member(p_member_user_id text) from public;
revoke execute on function public.pastor_user_for_church(p_church_id uuid) from public;
revoke execute on function public.platform_ops_snapshot() from public;
revoke execute on function public.queue_push_notification(p_recipient_user_id uuid, p_type text, p_title text, p_body text, p_action_url text, p_payload jsonb, p_tenant_id uuid) from public;
revoke execute on function public.register_push_subscription(p_endpoint text, p_p256dh_key text, p_auth_key text, p_device_label text, p_device_kind text, p_locale text, p_user_agent text, p_tenant_id uuid) from public;
revoke execute on function public.respond_membership_application(p_application_id uuid, p_response_note text) from public;
revoke execute on function public.review_membership_application(p_application_id uuid, p_decision review_workflow_status, p_pastoral_reference pastoral_reference_status, p_review_notes text) from public;
revoke execute on function public.review_pastor_authority_request(p_request_id uuid, p_decision review_workflow_status, p_review_notes text) from public;
revoke execute on function public.review_recruiter_request(p_request_id uuid, p_decision recruiter_request_status, p_review_notes text) from public;
revoke execute on function public.review_regional_authority_request(p_request_id uuid, p_decision review_workflow_status, p_review_notes text) from public;
revoke execute on function public.revoke_authority_invitation(p_id uuid) from public;
revoke execute on function public.revoke_membership_invite(p_membership_id uuid) from public;
revoke execute on function public.search_candidate_profiles(p_tenant_id uuid, p_query text, p_country_code text, p_language text, p_skill text, p_limit integer, p_offset integer, p_sort text, p_saved_only boolean) from public;
revoke execute on function public.shares_active_tenant_with(p_user_id uuid) from public;
revoke execute on function public.submit_application(p_job_posting_id uuid, p_submitted_resume_id uuid, p_cover_letter text, p_answers jsonb) from public;
revoke execute on function public.trigger_email_dispatch() from public;
revoke execute on function public.update_application_resume(p_application_id uuid, p_submitted_resume_id uuid) from public;
revoke execute on function public.update_push_delivery_status(p_delivery_id uuid, p_delivery_status text, p_response_code integer, p_provider_message_id text, p_response_payload jsonb, p_log_level text, p_log_message text, p_deactivate_subscription boolean, p_permission_state text) from public;
revoke execute on function public.upsert_notification_preferences(p_locale text, p_email_enabled boolean, p_push_enabled boolean, p_in_app_enabled boolean, p_quiet_hours_json jsonb, p_tenant_id uuid) from public;
revoke execute on function public.verify_membership_payment(p_payment_id uuid, p_decision membership_payment_status, p_notes text) from public;

-- ── 2. Conceder explícitamente al rol que sí debe llamarlas ──────────────────
-- Redundante con la ACL actual, pero deja el permiso declarado en la migración
-- en lugar de heredado, que es el criterio adoptado en 20260801120000.
grant execute on function public.activate_member(p_application_id uuid, p_notes text, p_membership_months integer) to authenticated;
grant execute on function public.admin_assign_platform_role(p_user_id uuid, p_role_id uuid, p_notes text) to authenticated;
grant execute on function public.admin_clear_manual_access_override(p_user_id uuid, p_reason text) to authenticated;
grant execute on function public.admin_create_authority_invitation(p_email text, p_authority_type text, p_expires_in_days integer, p_notes text) to authenticated;
grant execute on function public.admin_create_platform_role(p_code text, p_name text, p_description text, p_permission_codes text[]) to authenticated;
grant execute on function public.admin_delete_platform_role(p_role_id uuid) to authenticated;
grant execute on function public.admin_platform_rbac_snapshot(p_user_query text, p_user_limit integer, p_user_offset integer) to authenticated;
grant execute on function public.admin_revoke_platform_role(p_assignment_id uuid, p_notes text) to authenticated;
grant execute on function public.admin_search_users_for_access(p_query text, p_limit integer) to authenticated;
grant execute on function public.admin_set_manual_access_override(p_user_id uuid, p_months integer, p_reason text) to authenticated;
grant execute on function public.admin_update_platform_role(p_role_id uuid, p_name text, p_description text, p_permission_codes text[]) to authenticated;
grant execute on function public.admin_user_access_log_page(p_query text, p_since timestamp with time zone, p_limit integer, p_offset integer) to authenticated;
grant execute on function public.apply_moderation_action(p_case_id uuid, p_action_type moderation_action_type, p_note text) to authenticated;
grant execute on function public.azul_begin_membership_payment(p_application_id uuid, p_intent text, p_years integer) to authenticated;
grant execute on function public.bootstrap_first_platform_owner() to authenticated;
grant execute on function public.can_access_internal_console() to authenticated;
grant execute on function public.can_publish_opportunity(p_tenant_id uuid) to authenticated;
grant execute on function public.can_read_candidate_profile_via_application(p_profile_id uuid) to authenticated;
grant execute on function public.consume_authority_invitation(p_token text, p_request_id uuid) to authenticated;
grant execute on function public.deactivate_member(p_user_id uuid, p_notes text) to authenticated;
grant execute on function public.email_resend_delivery(p_delivery_id uuid) to authenticated;
grant execute on function public.email_test_clear() to authenticated;
grant execute on function public.email_test_force_status(p_delivery_id uuid, p_status text) to authenticated;
grant execute on function public.email_test_send(p_to text, p_subject text, p_message text, p_simulate text) to authenticated;
grant execute on function public.enqueue_donation_receipt_email(p_donation_id uuid) to authenticated;
grant execute on function public.enrich_current_access_log(p_timezone text, p_language text) to authenticated;
grant execute on function public.get_authority_invitation(p_token text) to authenticated;
grant execute on function public.get_candidate_profile_for_tenant(p_tenant_id uuid, p_candidate_profile_id uuid) to authenticated;
grant execute on function public.get_tenant_plan_snapshot(p_tenant_id uuid) to authenticated;
grant execute on function public.harness_email_suppressed() to authenticated;
grant execute on function public.has_active_asi_access(p_user_id uuid) to authenticated;
grant execute on function public.has_active_authority_scope(p_role authority_role_type, p_union_id uuid, p_association_id uuid, p_district_id uuid, p_church_id uuid) to authenticated;
grant execute on function public.has_active_tenant_subscription(p_tenant_id uuid) to authenticated;
grant execute on function public.invite_tenant_member(p_tenant_id uuid, p_email text, p_role_id uuid) to authenticated;
grant execute on function public.is_applicant_visible_to_reader(p_user_id uuid) to authenticated;
grant execute on function public.is_candidate_profile_owner(p_profile_id uuid) to authenticated;
grant execute on function public.is_candidate_profile_visible_to_recruiters(p_candidate_profile_id uuid) to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.mark_notification_clicked(p_notification_id uuid, p_delivery_id uuid) to authenticated;
grant execute on function public.mark_notification_read(p_notification_id uuid) to authenticated;
grant execute on function public.mark_notification_unread(p_notification_id uuid) to authenticated;
grant execute on function public.move_application_stage(p_application_id uuid, p_to_stage_id uuid, p_note text) to authenticated;
grant execute on function public.my_tenant_ids() to authenticated;
grant execute on function public.open_moderation_case(p_entity_type text, p_entity_id uuid, p_tenant_id uuid, p_reason text, p_severity text, p_metadata jsonb) to authenticated;
grant execute on function public.pastor_has_scope_over_member(p_member_user_id text) to authenticated;
grant execute on function public.pastor_user_for_church(p_church_id uuid) to authenticated;
grant execute on function public.platform_ops_snapshot() to authenticated;
grant execute on function public.queue_push_notification(p_recipient_user_id uuid, p_type text, p_title text, p_body text, p_action_url text, p_payload jsonb, p_tenant_id uuid) to authenticated;
grant execute on function public.register_push_subscription(p_endpoint text, p_p256dh_key text, p_auth_key text, p_device_label text, p_device_kind text, p_locale text, p_user_agent text, p_tenant_id uuid) to authenticated;
grant execute on function public.respond_membership_application(p_application_id uuid, p_response_note text) to authenticated;
grant execute on function public.review_membership_application(p_application_id uuid, p_decision review_workflow_status, p_pastoral_reference pastoral_reference_status, p_review_notes text) to authenticated;
grant execute on function public.review_pastor_authority_request(p_request_id uuid, p_decision review_workflow_status, p_review_notes text) to authenticated;
grant execute on function public.review_recruiter_request(p_request_id uuid, p_decision recruiter_request_status, p_review_notes text) to authenticated;
grant execute on function public.review_regional_authority_request(p_request_id uuid, p_decision review_workflow_status, p_review_notes text) to authenticated;
grant execute on function public.revoke_authority_invitation(p_id uuid) to authenticated;
grant execute on function public.revoke_membership_invite(p_membership_id uuid) to authenticated;
grant execute on function public.search_candidate_profiles(p_tenant_id uuid, p_query text, p_country_code text, p_language text, p_skill text, p_limit integer, p_offset integer, p_sort text, p_saved_only boolean) to authenticated;
grant execute on function public.shares_active_tenant_with(p_user_id uuid) to authenticated;
grant execute on function public.submit_application(p_job_posting_id uuid, p_submitted_resume_id uuid, p_cover_letter text, p_answers jsonb) to authenticated;
grant execute on function public.trigger_email_dispatch() to authenticated;
grant execute on function public.update_application_resume(p_application_id uuid, p_submitted_resume_id uuid) to authenticated;
grant execute on function public.update_push_delivery_status(p_delivery_id uuid, p_delivery_status text, p_response_code integer, p_provider_message_id text, p_response_payload jsonb, p_log_level text, p_log_message text, p_deactivate_subscription boolean, p_permission_state text) to authenticated;
grant execute on function public.upsert_notification_preferences(p_locale text, p_email_enabled boolean, p_push_enabled boolean, p_in_app_enabled boolean, p_quiet_hours_json jsonb, p_tenant_id uuid) to authenticated;
grant execute on function public.verify_membership_payment(p_payment_id uuid, p_decision membership_payment_status, p_notes text) to authenticated;

