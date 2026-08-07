-- ─────────────────────────────────────────────────────────────────────────────
-- Fase D — Recortar los grants de tabla de `authenticated` a lo que el cliente
-- realmente hace. Es a `authenticated` lo que 20260802190000 fue a `anon`.
--
-- Punto de partida (medido en el remoto): `authenticated` tenía ALL sobre 56
-- tablas de `public` —los 7 privilegios, incluidos TRUNCATE, REFERENCES y
-- TRIGGER—. No fue una decisión: es el default privilege de Supabase, que
-- 20260807042236 dejó por escrito para cerrar el drift. Escribirlo lo hizo
-- visible; esta migración lo corrige.
--
-- Por qué importa aunque haya RLS:
--   * **TRUNCATE no pasa por RLS.** Vacía la tabla sin evaluar una sola
--     política. Ningún cliente de PostgREST lo necesita jamás.
--   * REFERENCES y TRIGGER son privilegios de DDL: PostgREST no los usa.
--   * Un INSERT/UPDATE/DELETE que la aplicación nunca ejecuta es superficie que
--     solo puede usarse en un ataque. Si la única barrera es una política, un
--     error al escribirla es un agujero; sin el grant no hay nada que escribir
--     mal.
--
-- Cómo se decidió, tabla por tabla. Este cambio **sí altera comportamiento**,
-- así que la superficie se dedujo del código, no de las políticas:
--   1. Toda llamada `.from('<tabla>')` en `src/` con la operación encadenada
--      (select / insert / update / upsert / delete). Es el único cliente que
--      corre como `authenticated`.
--   2. Las relaciones embebidas dentro de `.select('...')`: PostgREST exige
--      SELECT sobre la tabla anidada, y si falta devuelve `null` en silencio.
--   3. Las tablas suscritas por Realtime (`{ table: '...' }` en
--      `useRealtimeSync`), que también necesitan SELECT.
--   4. Se descartó todo lo que corre con `service_role` —Edge Functions,
--      microservicio AZUL, arnés de estrés, helpers de e2e— porque ese rol no
--      se toca aquí, y las RPC `SECURITY DEFINER`, que corren como su owner y
--      no dependen de estos grants.
--
-- Las políticas RLS se usaron solo como contraste: donde hay política pero el
-- código no ejecuta esa operación, manda el código. Varias políticas quedan
-- como peso muerto —no rompen nada, pero ya no son la única barrera—.
--
-- Lo verifica `supabase/tests/p2_fase_d_authenticated_grants_probe.sql`, que
-- impersona a `authenticated` y comprueba el privilegio real, no el catálogo.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Partir de cero ────────────────────────────────────────────────────────
-- Igual que con `anon`: retirar todo y devolver solo lo justificable. Así el
-- estado final es exactamente el que declara el bloque 2, sin depender de qué
-- había antes en cada tabla.
do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from authenticated', r.tablename);
  end loop;
end;
$$;

-- ── 2. Devolver la superficie que el cliente usa ─────────────────────────────

-- 2.A. Solo lectura (21). Se leen desde el cliente y se escriben por RPC
-- `SECURITY DEFINER`, por trigger o por `service_role`.
--   * `applications`, `application_stage_history`: las escriben
--     submit_application / move_application_stage / update_application_resume.
--   * `membership_payments`: las crea el microservicio AZUL; el cliente solo
--     muestra el historial de comprobantes.
--   * `moderation_cases`, `moderation_actions`: open_moderation_case y
--     apply_moderation_action.
--   * `notification_deliveries`: la escribe update_push_delivery_status.
--   * `authority_request_invitations`: admin_create/revoke_authority_invitation.
--   * `permissions`, `tenant_role_permissions`, `tenant_roles`, `tenants`,
--     `pipeline_stages`, `opportunity_stage_templates`: catálogos que el cliente
--     lee, varios solo como relación embebida.
--   * `church_*`, `churches`: jerarquía eclesiástica, lectura.
--   * `donations`, `memberships`, `user_authority_scopes`,
--     `stress_harness_runs`: lectura de estado.
grant select on table
  public.application_stage_history,
  public.applications,
  public.authority_request_invitations,
  public.church_associations,
  public.church_districts,
  public.church_unions,
  public.churches,
  public.donations,
  public.membership_payments,
  public.memberships,
  public.moderation_actions,
  public.moderation_cases,
  public.notification_deliveries,
  public.opportunity_stage_templates,
  public.permissions,
  public.pipeline_stages,
  public.stress_harness_runs,
  public.tenant_role_permissions,
  public.tenant_roles,
  public.tenants,
  public.user_authority_scopes
to authenticated;

-- 2.B. Lectura + alta (4). El usuario crea la solicitud o la nota; la revisión
-- y el cierre van por RPC (review_recruiter_request,
-- review_pastor_authority_request, review_regional_authority_request).
grant select, insert on table
  public.application_notes,
  public.pastor_authority_requests,
  public.recruiter_requests,
  public.regional_administrator_authority_requests
to authenticated;

-- 2.C. Lectura + edición, sin alta ni borrado (6). Filas que ya existen y solo
-- se modifican: el perfil de empresa, los ajustes de pago, las banderas, el
-- propio usuario, el estado de lectura de una notificación y el mensaje de un
-- error del cliente.
grant select, update on table
  public.app_error_logs,
  public.company_profiles,
  public.feature_flags,
  public.membership_payment_settings,
  public.notifications,
  public.users
to authenticated;

-- 2.D. Lectura + alta + edición, sin borrado (5). Nada de esto se borra desde la
-- interfaz: una vacante se archiva, una solicitud de membresía cambia de estado,
-- un perfil de candidato se hace `upsert`.
grant select, insert, update on table
  public.application_ratings,
  public.candidate_profiles,
  public.institutional_membership_applications,
  public.job_postings,
  public.membership_roles
to authenticated;

-- 2.E. Lectura + alta + borrado, sin edición (8). El patrón "reemplazar":
-- `candidate-profile-api.ts` borra las filas hijas del perfil y vuelve a
-- insertarlas; guardar un empleo o quitar a alguien del talent pool es igual.
grant select, insert, delete on table
  public.candidate_educations,
  public.candidate_experiences,
  public.candidate_languages,
  public.candidate_links,
  public.candidate_skills,
  public.job_screening_questions,
  public.saved_jobs,
  public.talent_pool_entries
to authenticated;

-- 2.F. CRUD completo (3), pero sin TRUNCATE. Las únicas tres donde el cliente
-- hace las cuatro operaciones: los CV del candidato, los montos de donación que
-- administra un owner desde la consola, y las alertas de empleo.
grant select, insert, update, delete on table
  public.candidate_resumes,
  public.donation_amount_options,
  public.job_alerts
to authenticated;

-- 2.G. Sin ningún grant (11). El cliente no las toca: se escriben por trigger,
-- por RPC o por `service_role`, y no se leen ni siquiera como relación embebida.
-- Se quedan fuera a propósito.
--
--   application_answers         → las escribe submit_application
--   audit_logs                  → auditoría; ninguna vista del cliente la lee
--   notification_delivery_logs  → los escribe la Edge Function del outbox
--   notification_preferences    → se leen y escriben con
--                                 upsert_notification_preferences
--   platform_roles              → admin_platform_rbac_snapshot y sus RPC
--   platform_role_permissions   → idem
--   push_subscriptions          → register_push_subscription
--   subscription_plans          → get_tenant_plan_snapshot
--   tenant_subscriptions        → idem
--   user_platform_roles         → admin_platform_rbac_snapshot
--   user_access_logs            → ya estaba fuera desde 20260729130000
--
-- Si mañana una vista necesita una de estas, el fallo es ruidoso en desarrollo y
-- se arregla con su `grant` explícito y su justificación. Es el mismo trato que
-- reciben las RPC nuevas.

-- ── 3. Cortar la fuente ──────────────────────────────────────────────────────
-- Sin esto, la próxima tabla que cree una migración vuelve a nacer con ALL para
-- `authenticated` —TRUNCATE incluido— y el recorte dura hasta el siguiente
-- `create table`. Mismo criterio que 20260802190000 aplicó a `anon` y
-- 20260801120000 a las funciones.
--
-- Consecuencia intencional: una tabla nueva que el cliente deba leer o escribir
-- necesita su `grant ... to authenticated` explícito en la misma migración, o
-- falla en desarrollo. Fallo ruidoso en dev antes que superficie silenciosa en
-- producción.
alter default privileges in schema public revoke all on tables from authenticated;
