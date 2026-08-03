-- ─────────────────────────────────────────────────────────────────────────────
-- P1 TASK-269 — Evitar la reevaluación por fila en las políticas RLS.
--
-- Lo medido en el remoto contradice el enunciado del issue. No hay «49 políticas
-- y 32 grupos duplicados»: hay **143 políticas sobre 57 tablas** y solo **3
-- grupos** con varias políticas permisivas para el mismo rol y comando. Esa no
-- es la fuente del coste.
--
-- El coste real es otro: **48 políticas invocaban `auth.uid()`, `auth.role()`,
-- `is_platform_admin()` o `has_platform_permission()` sin envolver**, y Postgres
-- las reevalúa **una vez por fila examinada**. En un listado de mil filas eso son
-- mil llamadas a una función que devuelve siempre lo mismo dentro de la misma
-- sentencia. Envolverlas en un subselect escalar las convierte en InitPlan: se
-- evalúan una sola vez.
--
-- Qué NO se envuelve, y por qué importa:
--   `has_tenant_permission(tenant_id, ...)`, `is_tenant_member(tenant_id)` y
--   `can_read_application(id)` reciben **columnas de la fila**. Envolverlas las
--   congelaría en el valor de la primera fila y **ampliaría el acceso**: un
--   usuario vería filas de tenants ajenos. Se dejan intactas a propósito.
--
-- Los cinco envueltos son de ámbito de sesión y no dependen de la fila:
-- `auth.uid()`, `auth.role()`, `auth.jwt()`, `is_platform_admin()`,
-- `is_platform_owner()` y `has_platform_permission('literal')` — se verificó que
-- las 31 invocaciones de esta última usan un literal, nunca una columna.
--
-- Las sentencias se generaron desde `pg_policies` del propio remoto, no a mano,
-- y la equivalencia se prueba mecánicamente: al quitar los envoltorios
-- `( SELECT ...)` del resultado, la expresión debe coincidir carácter a carácter
-- con la original. Ver `supabase/tests/p1_rls_initplan_probe.sql`.
--
-- `alter policy` cambia la expresión sin borrar ni recrear la política, así que
-- no hay ventana en la que la tabla quede sin protección.
-- ─────────────────────────────────────────────────────────────────────────────

alter policy app_error_logs_readable_by_platform_admins on public.app_error_logs
  using (( SELECT has_platform_permission('audit_log:read'::text)));

alter policy app_error_logs_updatable_by_platform_admins on public.app_error_logs
  using (( SELECT has_platform_permission('audit_log:read'::text)))
  with check (( SELECT has_platform_permission('audit_log:read'::text)));

alter policy application_notes_insert_authorized on public.application_notes
  with check (((author_user_id = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM (applications a
     JOIN job_postings jp ON ((jp.id = a.job_posting_id)))
  WHERE ((a.id = application_notes.application_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(jp.tenant_id, 'application:add_note'::text)))))));

alter policy application_notes_update_authorized on public.application_notes
  using (((author_user_id = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM (applications a
     JOIN job_postings jp ON ((jp.id = a.job_posting_id)))
  WHERE ((a.id = application_notes.application_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(jp.tenant_id, 'application:add_note'::text)))))))
  with check (((author_user_id = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM (applications a
     JOIN job_postings jp ON ((jp.id = a.job_posting_id)))
  WHERE ((a.id = application_notes.application_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(jp.tenant_id, 'application:add_note'::text)))))));

alter policy application_ratings_update_authorized on public.application_ratings
  using (((author_user_id = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM (applications a
     JOIN job_postings jp ON ((jp.id = a.job_posting_id)))
  WHERE ((a.id = application_ratings.application_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(jp.tenant_id, 'application:rate'::text)))))))
  with check (((author_user_id = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM (applications a
     JOIN job_postings jp ON ((jp.id = a.job_posting_id)))
  WHERE ((a.id = application_ratings.application_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(jp.tenant_id, 'application:rate'::text)))))));

alter policy application_ratings_upsert_authorized on public.application_ratings
  with check (((author_user_id = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM (applications a
     JOIN job_postings jp ON ((jp.id = a.job_posting_id)))
  WHERE ((a.id = application_ratings.application_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(jp.tenant_id, 'application:rate'::text)))))));

alter policy applications_select_for_owner_or_tenant_readers on public.applications
  using ((( SELECT is_platform_admin()) OR (has_active_asi_access(( SELECT auth.uid())) AND (is_candidate_profile_owner(candidate_profile_id) OR (EXISTS ( SELECT 1
   FROM job_postings jp
  WHERE ((jp.id = applications.job_posting_id) AND has_tenant_permission(jp.tenant_id, 'application:read'::text))))))));

alter policy audit_logs_readable_by_platform_admins on public.audit_logs
  using (( SELECT has_platform_permission('audit_log:read'::text)));

alter policy authority_invitations_admin_write on public.authority_request_invitations
  using (( SELECT is_platform_admin()))
  with check (( SELECT is_platform_admin()));

alter policy authority_invitations_read on public.authority_request_invitations
  using ((( SELECT is_platform_admin()) OR (target_user_id = ( SELECT auth.uid()))));

alter policy candidate_profiles_delete_own on public.candidate_profiles
  using ((user_id = ( SELECT auth.uid())));

alter policy candidate_profiles_insert_own on public.candidate_profiles
  with check ((user_id = ( SELECT auth.uid())));

alter policy candidate_profiles_select_own on public.candidate_profiles
  using ((user_id = ( SELECT auth.uid())));

alter policy candidate_profiles_update_own on public.candidate_profiles
  using ((user_id = ( SELECT auth.uid())))
  with check ((user_id = ( SELECT auth.uid())));

alter policy company_profiles_select_for_public_members_or_platform_admins on public.company_profiles
  using ((is_public OR is_tenant_member(tenant_id) OR ( SELECT has_platform_permission('tenant:read'::text))));

alter policy company_profiles_update_for_authorized_members on public.company_profiles
  using ((( SELECT is_platform_admin()) OR has_tenant_permission(tenant_id, 'company_profile:update'::text)))
  with check ((( SELECT is_platform_admin()) OR has_tenant_permission(tenant_id, 'company_profile:update'::text)));

alter policy donation_amount_options_manage_admins on public.donation_amount_options
  using (( SELECT is_platform_admin()))
  with check (( SELECT is_platform_admin()));

alter policy donations_select_own_or_admin on public.donations
  using (((donor_user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin())));

alter policy feature_flags_manage_platform_admins on public.feature_flags
  using ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('feature_flag:update'::text))))
  with check ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('feature_flag:update'::text))));

alter policy feature_flags_select_platform_readers on public.feature_flags
  using ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('feature_flag:read'::text)) OR ( SELECT has_platform_permission('plan:read'::text))));

alter policy institutional_membership_applications_insert_self on public.institutional_membership_applications
  with check ((requester_user_id = ( SELECT auth.uid())));

alter policy institutional_membership_applications_read_self_or_reviewer on public.institutional_membership_applications
  using (((requester_user_id = ( SELECT auth.uid())) OR ( SELECT has_platform_permission('user:approve'::text)) OR ( SELECT has_platform_permission('audit_log:read'::text)) OR ( SELECT has_platform_permission('membership_application:review'::text)) OR ((church_id IS NOT NULL) AND has_active_authority_scope('pastor_administrator'::authority_role_type, NULL::uuid, NULL::uuid, NULL::uuid, church_id))));

alter policy institutional_membership_applications_reviewer_update on public.institutional_membership_applications
  using (((requester_user_id = ( SELECT auth.uid())) OR ( SELECT has_platform_permission('user:approve'::text))))
  with check (((requester_user_id = ( SELECT auth.uid())) OR ( SELECT has_platform_permission('user:approve'::text))));

alter policy institutional_membership_applications_update_own_draft on public.institutional_membership_applications
  using (((requester_user_id = ( SELECT auth.uid())) AND (status = 'draft'::review_workflow_status)))
  with check (((requester_user_id = ( SELECT auth.uid())) AND (status = ANY (ARRAY['draft'::review_workflow_status, 'submitted'::review_workflow_status]))));

alter policy job_alerts_delete_own on public.job_alerts
  using ((has_active_asi_access(( SELECT auth.uid())) AND is_candidate_profile_owner(candidate_profile_id)));

alter policy job_alerts_insert_own on public.job_alerts
  with check ((has_active_asi_access(( SELECT auth.uid())) AND is_candidate_profile_owner(candidate_profile_id)));

alter policy job_alerts_select_own on public.job_alerts
  using ((has_active_asi_access(( SELECT auth.uid())) AND is_candidate_profile_owner(candidate_profile_id)));

alter policy job_alerts_update_own on public.job_alerts
  using ((has_active_asi_access(( SELECT auth.uid())) AND is_candidate_profile_owner(candidate_profile_id)))
  with check ((has_active_asi_access(( SELECT auth.uid())) AND is_candidate_profile_owner(candidate_profile_id)));

alter policy job_postings_insert_for_creators on public.job_postings
  with check ((has_active_asi_access(( SELECT auth.uid())) AND has_tenant_permission(tenant_id, 'job:create'::text)));

alter policy job_postings_protected_or_tenant_read on public.job_postings
  using ((( SELECT is_platform_admin()) OR (has_active_asi_access(( SELECT auth.uid())) AND ((status = 'published'::job_posting_status) OR has_tenant_permission(tenant_id, 'job:read'::text)))));

alter policy job_postings_update_for_authorized_members on public.job_postings
  using ((( SELECT is_platform_admin()) OR (has_active_asi_access(( SELECT auth.uid())) AND (has_tenant_permission(tenant_id, 'job:update'::text) OR ((status = 'published'::job_posting_status) AND has_tenant_permission(tenant_id, 'job:publish'::text))))))
  with check ((( SELECT is_platform_admin()) OR (has_active_asi_access(( SELECT auth.uid())) AND (has_tenant_permission(tenant_id, 'job:update'::text) OR ((status = 'published'::job_posting_status) AND has_active_tenant_subscription(tenant_id) AND has_tenant_permission(tenant_id, 'job:publish'::text)) OR ((status = 'closed'::job_posting_status) AND has_tenant_permission(tenant_id, 'job:close'::text)) OR ((status = 'archived'::job_posting_status) AND has_tenant_permission(tenant_id, 'job:archive'::text))))));

alter policy job_screening_questions_protected_or_tenant_read on public.job_screening_questions
  using ((EXISTS ( SELECT 1
   FROM job_postings jp
  WHERE ((jp.id = job_screening_questions.job_posting_id) AND (( SELECT is_platform_admin()) OR (has_active_asi_access(( SELECT auth.uid())) AND ((jp.status = 'published'::job_posting_status) OR has_tenant_permission(jp.tenant_id, 'job:read'::text))))))));

alter policy job_screening_questions_write_for_authorized_members on public.job_screening_questions
  using ((has_active_asi_access(( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM job_postings jp
  WHERE ((jp.id = job_screening_questions.job_posting_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(jp.tenant_id, 'job:update'::text) OR has_tenant_permission(jp.tenant_id, 'job:publish'::text)))))))
  with check ((has_active_asi_access(( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM job_postings jp
  WHERE ((jp.id = job_screening_questions.job_posting_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(jp.tenant_id, 'job:update'::text) OR has_tenant_permission(jp.tenant_id, 'job:publish'::text)))))));

alter policy membership_payment_settings_admin_write on public.membership_payment_settings
  using (( SELECT is_platform_admin()))
  with check (( SELECT is_platform_admin()));

alter policy membership_payments_admin_update on public.membership_payments
  using (( SELECT is_platform_admin()))
  with check (( SELECT is_platform_admin()));

alter policy membership_payments_insert on public.membership_payments
  with check (((member_user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin()) OR pastor_has_scope_over_member((member_user_id)::text)));

alter policy membership_payments_read on public.membership_payments
  using (((member_user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin()) OR pastor_has_scope_over_member((member_user_id)::text)));

alter policy membership_roles_insert_for_role_assigners on public.membership_roles
  with check ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.id = membership_roles.membership_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(m.tenant_id, 'role:assign'::text))))));

alter policy membership_roles_select_for_members_or_role_readers on public.membership_roles
  using ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.id = membership_roles.membership_id) AND ((m.user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_platform_permission('tenant:read'::text)) OR has_tenant_permission(m.tenant_id, 'role:read'::text))))));

alter policy membership_roles_update_for_role_assigners on public.membership_roles
  using ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.id = membership_roles.membership_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(m.tenant_id, 'role:assign'::text))))))
  with check ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.id = membership_roles.membership_id) AND (( SELECT is_platform_admin()) OR has_tenant_permission(m.tenant_id, 'role:assign'::text))))));

alter policy memberships_read_own_or_tenant_authority on public.memberships
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_platform_permission('tenant:read'::text)) OR has_tenant_permission(tenant_id, 'member:read'::text)));

alter policy memberships_update_for_tenant_authority on public.memberships
  using ((( SELECT is_platform_admin()) OR has_tenant_permission(tenant_id, 'member:update'::text)))
  with check ((( SELECT is_platform_admin()) OR has_tenant_permission(tenant_id, 'member:update'::text)));

alter policy moderation_actions_select_platform_reviewers on public.moderation_actions
  using ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('moderation:read'::text))));

alter policy moderation_cases_select_platform_reviewers on public.moderation_cases
  using ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('moderation:read'::text))));

alter policy notification_deliveries_insert_managers on public.notification_deliveries
  with check ((( SELECT is_platform_admin()) OR (EXISTS ( SELECT 1
   FROM notifications n
  WHERE ((n.id = notification_deliveries.notification_id) AND (n.tenant_id IS NOT NULL) AND has_tenant_permission(n.tenant_id, 'notification:manage'::text))))));

alter policy notification_deliveries_select_managers on public.notification_deliveries
  using ((( SELECT is_platform_admin()) OR (EXISTS ( SELECT 1
   FROM notifications n
  WHERE ((n.id = notification_deliveries.notification_id) AND (n.tenant_id IS NOT NULL) AND has_tenant_permission(n.tenant_id, 'notification:manage'::text))))));

alter policy notification_deliveries_update_managers on public.notification_deliveries
  using ((( SELECT is_platform_admin()) OR (EXISTS ( SELECT 1
   FROM notifications n
  WHERE ((n.id = notification_deliveries.notification_id) AND (n.tenant_id IS NOT NULL) AND has_tenant_permission(n.tenant_id, 'notification:manage'::text))))))
  with check ((( SELECT is_platform_admin()) OR (EXISTS ( SELECT 1
   FROM notifications n
  WHERE ((n.id = notification_deliveries.notification_id) AND (n.tenant_id IS NOT NULL) AND has_tenant_permission(n.tenant_id, 'notification:manage'::text))))));

alter policy notification_delivery_logs_insert_managers on public.notification_delivery_logs
  with check ((( SELECT is_platform_admin()) OR (EXISTS ( SELECT 1
   FROM (notification_deliveries nd
     JOIN notifications n ON ((n.id = nd.notification_id)))
  WHERE ((nd.id = notification_delivery_logs.delivery_id) AND (n.tenant_id IS NOT NULL) AND has_tenant_permission(n.tenant_id, 'notification:manage'::text))))));

alter policy notification_delivery_logs_select_managers on public.notification_delivery_logs
  using ((( SELECT is_platform_admin()) OR (EXISTS ( SELECT 1
   FROM (notification_deliveries nd
     JOIN notifications n ON ((n.id = nd.notification_id)))
  WHERE ((nd.id = notification_delivery_logs.delivery_id) AND (n.tenant_id IS NOT NULL) AND has_tenant_permission(n.tenant_id, 'notification:manage'::text))))));

alter policy notification_delivery_logs_update_managers on public.notification_delivery_logs
  using ((( SELECT is_platform_admin()) OR (EXISTS ( SELECT 1
   FROM (notification_deliveries nd
     JOIN notifications n ON ((n.id = nd.notification_id)))
  WHERE ((nd.id = notification_delivery_logs.delivery_id) AND (n.tenant_id IS NOT NULL) AND has_tenant_permission(n.tenant_id, 'notification:manage'::text))))))
  with check ((( SELECT is_platform_admin()) OR (EXISTS ( SELECT 1
   FROM (notification_deliveries nd
     JOIN notifications n ON ((n.id = nd.notification_id)))
  WHERE ((nd.id = notification_delivery_logs.delivery_id) AND (n.tenant_id IS NOT NULL) AND has_tenant_permission(n.tenant_id, 'notification:manage'::text))))));

alter policy notification_preferences_delete_own_or_platform_admin on public.notification_preferences
  using (((user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin())));

alter policy notification_preferences_insert_own_or_platform_admin on public.notification_preferences
  with check (((user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin())));

alter policy notification_preferences_select_own_or_managers on public.notification_preferences
  using (((user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin()) OR ((tenant_id IS NOT NULL) AND has_tenant_permission(tenant_id, 'notification:manage'::text))));

alter policy notification_preferences_update_own_or_platform_admin on public.notification_preferences
  using (((user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin())))
  with check (((user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin())));

alter policy notifications_insert_for_managers on public.notifications
  with check ((( SELECT is_platform_admin()) OR ((tenant_id IS NOT NULL) AND has_tenant_permission(tenant_id, 'notification:manage'::text))));

alter policy notifications_select_recipient_or_managers on public.notifications
  using (((recipient_user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin()) OR ((tenant_id IS NOT NULL) AND has_tenant_permission(tenant_id, 'notification:manage'::text))));

alter policy notifications_update_for_recipient_or_managers on public.notifications
  using (((recipient_user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin()) OR ((tenant_id IS NOT NULL) AND has_tenant_permission(tenant_id, 'notification:manage'::text))))
  with check (((recipient_user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin()) OR ((tenant_id IS NOT NULL) AND has_tenant_permission(tenant_id, 'notification:manage'::text))));

alter policy opportunity_stage_templates_authenticated_read on public.opportunity_stage_templates
  using ((has_active_asi_access(( SELECT auth.uid())) OR ( SELECT is_platform_admin())));

alter policy pastor_authority_requests_insert_self on public.pastor_authority_requests
  with check ((requester_user_id = ( SELECT auth.uid())));

alter policy pastor_authority_requests_select_self_or_reviewer on public.pastor_authority_requests
  using (((requester_user_id = ( SELECT auth.uid())) OR ( SELECT has_platform_permission('pastor_authority_request:read'::text)) OR ( SELECT has_platform_permission('pastor_authority_request:review'::text))));

alter policy pastor_authority_requests_update_self_or_reviewer on public.pastor_authority_requests
  using (((requester_user_id = ( SELECT auth.uid())) OR ( SELECT has_platform_permission('pastor_authority_request:review'::text))))
  with check (((requester_user_id = ( SELECT auth.uid())) OR ( SELECT has_platform_permission('pastor_authority_request:review'::text))));

alter policy pipeline_stages_manage_tenant on public.pipeline_stages
  using (((tenant_id IS NOT NULL) AND (( SELECT is_platform_admin()) OR has_tenant_permission(tenant_id, 'role:update'::text))))
  with check (((tenant_id IS NOT NULL) AND (( SELECT is_platform_admin()) OR has_tenant_permission(tenant_id, 'role:update'::text))));

alter policy platform_role_permissions_readable_by_platform_admins on public.platform_role_permissions
  using ((( SELECT has_platform_permission('recruiter_request:read'::text)) OR ( SELECT is_platform_admin())));

alter policy platform_roles_readable_by_platform_admins on public.platform_roles
  using ((( SELECT has_platform_permission('recruiter_request:read'::text)) OR ( SELECT is_platform_admin())));

alter policy push_subscriptions_delete_own_or_platform_admin on public.push_subscriptions
  using (((user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin())));

alter policy push_subscriptions_insert_own_or_platform_admin on public.push_subscriptions
  with check (((user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin())));

alter policy push_subscriptions_select_own_or_platform_admin on public.push_subscriptions
  using (((user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin())));

alter policy push_subscriptions_update_own_or_platform_admin on public.push_subscriptions
  using (((user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin())))
  with check (((user_id = ( SELECT auth.uid())) OR ( SELECT is_platform_admin())));

alter policy recruiter_requests_select_self_or_platform_admin on public.recruiter_requests
  using (((requester_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_platform_permission('recruiter_request:read'::text)) OR ( SELECT has_platform_permission('recruiter_request:review'::text))));

alter policy recruiter_requests_update_self_or_platform_admin on public.recruiter_requests
  using (((requester_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_platform_permission('recruiter_request:review'::text))))
  with check (((requester_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_platform_permission('recruiter_request:review'::text))));

alter policy regional_authority_requests_insert_self on public.regional_administrator_authority_requests
  with check ((requester_user_id = ( SELECT auth.uid())));

alter policy regional_authority_requests_select_self_or_reviewer on public.regional_administrator_authority_requests
  using (((requester_user_id = ( SELECT auth.uid())) OR ( SELECT has_platform_permission('regional_authority_request:read'::text)) OR ( SELECT has_platform_permission('regional_authority_request:review'::text))));

alter policy regional_authority_requests_update_self_or_reviewer on public.regional_administrator_authority_requests
  using (((requester_user_id = ( SELECT auth.uid())) OR ( SELECT has_platform_permission('regional_authority_request:review'::text))))
  with check (((requester_user_id = ( SELECT auth.uid())) OR ( SELECT has_platform_permission('regional_authority_request:review'::text))));

alter policy saved_jobs_delete_own on public.saved_jobs
  using ((has_active_asi_access(( SELECT auth.uid())) AND is_candidate_profile_owner(candidate_profile_id)));

alter policy saved_jobs_insert_own on public.saved_jobs
  with check ((has_active_asi_access(( SELECT auth.uid())) AND is_candidate_profile_owner(candidate_profile_id) AND (EXISTS ( SELECT 1
   FROM job_postings jp
  WHERE ((jp.id = saved_jobs.job_posting_id) AND (jp.status = 'published'::job_posting_status))))));

alter policy saved_jobs_select_own on public.saved_jobs
  using ((has_active_asi_access(( SELECT auth.uid())) AND is_candidate_profile_owner(candidate_profile_id)));

alter policy stress_harness_runs_read_platform_admin on public.stress_harness_runs
  using (( SELECT is_platform_admin()));

alter policy subscription_plans_manage_platform_admins on public.subscription_plans
  using ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('plan:update'::text))))
  with check ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('plan:update'::text))));

alter policy subscription_plans_select_platform_readers on public.subscription_plans
  using ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('plan:read'::text))));

alter policy talent_pool_entries_delete_for_tenant_members on public.talent_pool_entries
  using ((( SELECT is_platform_admin()) OR has_tenant_permission(tenant_id, 'candidate_directory:read'::text)));

alter policy talent_pool_entries_insert_for_tenant_members on public.talent_pool_entries
  with check ((has_tenant_permission(tenant_id, 'candidate_directory:read'::text) AND (saved_by_user_id = ( SELECT auth.uid())) AND is_candidate_profile_visible_to_recruiters(candidate_profile_id)));

alter policy talent_pool_entries_select_for_tenant_members on public.talent_pool_entries
  using ((( SELECT is_platform_admin()) OR has_tenant_permission(tenant_id, 'candidate_directory:read'::text)));

alter policy tenant_role_permissions_delete_for_role_managers on public.tenant_role_permissions
  using ((EXISTS ( SELECT 1
   FROM tenant_roles tr
  WHERE ((tr.id = tenant_role_permissions.role_id) AND (( SELECT is_platform_admin()) OR ((tr.tenant_id IS NOT NULL) AND has_tenant_permission(tr.tenant_id, 'role:update'::text)))))));

alter policy tenant_role_permissions_insert_for_role_managers on public.tenant_role_permissions
  with check ((EXISTS ( SELECT 1
   FROM tenant_roles tr
  WHERE ((tr.id = tenant_role_permissions.role_id) AND (( SELECT is_platform_admin()) OR ((tr.tenant_id IS NOT NULL) AND has_tenant_permission(tr.tenant_id, 'role:update'::text)))))));

alter policy tenant_role_permissions_select_for_role_readers on public.tenant_role_permissions
  using ((EXISTS ( SELECT 1
   FROM tenant_roles tr
  WHERE ((tr.id = tenant_role_permissions.role_id) AND ((tr.tenant_id IS NULL) OR ( SELECT has_platform_permission('tenant:read'::text)) OR has_tenant_permission(tr.tenant_id, 'role:read'::text))))));

alter policy tenant_roles_delete_for_authorized_members on public.tenant_roles
  using ((( SELECT is_platform_admin()) OR ((tenant_id IS NOT NULL) AND has_tenant_permission(tenant_id, 'role:delete'::text))));

alter policy tenant_roles_insert_for_authorized_members on public.tenant_roles
  with check ((( SELECT is_platform_admin()) OR ((tenant_id IS NOT NULL) AND has_tenant_permission(tenant_id, 'role:create'::text))));

alter policy tenant_roles_select_for_members_or_platform_admins on public.tenant_roles
  using (((tenant_id IS NULL) OR ( SELECT has_platform_permission('tenant:read'::text)) OR has_tenant_permission(tenant_id, 'role:read'::text)));

alter policy tenant_roles_update_for_authorized_members on public.tenant_roles
  using ((( SELECT is_platform_admin()) OR ((tenant_id IS NOT NULL) AND has_tenant_permission(tenant_id, 'role:update'::text))))
  with check ((( SELECT is_platform_admin()) OR ((tenant_id IS NOT NULL) AND has_tenant_permission(tenant_id, 'role:update'::text))));

alter policy tenant_subscriptions_manage_platform_admins on public.tenant_subscriptions
  using ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('plan:update'::text))))
  with check ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('plan:update'::text))));

alter policy tenant_subscriptions_select_platform_or_tenant on public.tenant_subscriptions
  using ((( SELECT is_platform_admin()) OR ( SELECT has_platform_permission('plan:read'::text)) OR is_tenant_member(tenant_id)));

alter policy tenants_select_for_members_or_platform_admins on public.tenants
  using ((is_tenant_member(id) OR ( SELECT has_platform_permission('tenant:read'::text))));

alter policy user_authority_scopes_read_self_or_reviewer on public.user_authority_scopes
  using (((user_id = ( SELECT auth.uid())) OR ( SELECT has_platform_permission('scoped_user_authorization:read'::text)) OR ( SELECT has_platform_permission('scoped_user_authorization:review'::text))));

alter policy user_authority_scopes_reviewer_manage on public.user_authority_scopes
  using (( SELECT has_platform_permission('scoped_user_authorization:review'::text)))
  with check (( SELECT has_platform_permission('scoped_user_authorization:review'::text)));

alter policy user_platform_roles_read_own_or_platform_admin on public.user_platform_roles
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_platform_admin())));

alter policy users_select_self_or_platform_admin on public.users
  using (((( SELECT auth.uid() AS uid) = id) OR ( SELECT has_platform_permission('user:read'::text))));

alter policy users_update_self_or_platform_admin on public.users
  using (((( SELECT auth.uid() AS uid) = id) OR ( SELECT has_platform_permission('user:update'::text))))
  with check (((( SELECT auth.uid() AS uid) = id) OR ( SELECT has_platform_permission('user:update'::text))));
