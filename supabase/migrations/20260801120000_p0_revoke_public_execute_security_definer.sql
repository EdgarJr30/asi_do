-- ─────────────────────────────────────────────────────────────────────────────
-- P0 — Contención de la superficie SECURITY DEFINER (auditoría 2026-07-29).
--
-- Causa raíz: Supabase aplica default privileges que conceden EXECUTE a `anon`
-- y `authenticated` sobre TODA función creada en `public`. Las migraciones
-- previas hacían `revoke all ... from public`, que solo toca el pseudo-rol
-- PUBLIC y NO retira esos grants explícitos por rol. Resultado medido en el
-- remoto: las 91 funciones SECURITY DEFINER eran ejecutables por anon.
--
-- Esta migración NO cambia lógica: solo cierra los grants de las funciones que
-- ningún cliente (frontend, Edge Function con JWT de usuario, ni microservicio)
-- invoca con rol anon/authenticated. El endurecimiento de lógica va aparte.
--
-- Fuera de alcance deliberado (siguen necesitando `authenticated`):
--   * Predicados usados dentro de políticas RLS: se evalúan con el rol del
--     llamante; revocarlos rompería la RLS entera.
--   * azul_begin_membership_payment: el microservicio la llama con el JWT del
--     miembro (cliente anon user-scoped).
--   * queue_push_notification / update_push_delivery_status: la Edge Function
--     send-notification reenvía el JWT del usuario.
--   * verify_membership_payment: ya valida auth.uid() + is_platform_admin().
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. RPC internas: solo service_role ───────────────────────────────────────
-- Invocadas por cron, microservicio AZUL (cliente service_role) u otras
-- funciones SECURITY DEFINER (que corren como owner, no como el llamante).

do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    -- P0 TASK-256: permitía reescribir email_dispatch_url y exfiltrar secretos.
    'public.set_runtime_secret(text, text)',
    -- P0 TASK-258: liquidación falsificable de membresías y donaciones.
    'public.azul_settle_membership_payment(text, boolean, jsonb)',
    'public.azul_settle_donation_payment(text, boolean, jsonb)',
    -- Iniciada solo por el microservicio con cliente service_role.
    'public.azul_begin_donation(uuid, numeric, text, text, text, uuid, text, text)',
    -- P0 TASK-259: sin guarda interna; permitía falsificar notificaciones.
    'public.system_create_notification(uuid, text, text, text, text, jsonb, uuid)',
    'public.notify_membership_admins(text, text, text, text, jsonb)',
    -- Toggle del arnés de estrés: solo service_role desde la Edge Function.
    'public.set_harness_email_suppression(boolean)',
    -- Utilidad de mantenimiento de RLS.
    'public.rls_auto_enable()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_sig);
    execute format('grant execute on function %s to service_role', v_sig);
  end loop;
end;
$$;

-- ── 2. Funciones de trigger: sin grants para nadie ───────────────────────────
-- Un trigger se ejecuta como parte del statement sobre la tabla; no requiere
-- EXECUTE del rol que dispara el DML. Exponerlas por PostgREST solo añadía
-- superficie (varias insertan notificaciones o mutan estado de membresía).

do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.assert_job_publish_limit()',
    'public.assign_default_subscription_to_tenant()',
    'public.handle_new_auth_user()',
    'public.notify_application_submitted()',
    'public.notify_candidate_status_change()',
    'public.notify_membership_application_submitted()',
    'public.notify_membership_payment_submitted()',
    'public.notify_recruiter_request_review()',
    'public.route_membership_application()',
    'public.suppress_email_delivery_when_harness()',
    'public.sync_application_candidate_snapshots()',
    'public.sync_auth_user_contact_fields()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_sig);
  end loop;
end;
$$;

-- ── 3. Cortar la fuente del problema para funciones futuras ──────────────────
-- Sin esto, cualquier función nueva en `public` vuelve a nacer con EXECUTE para
-- anon y authenticated y la regresión se repite en silencio.

alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;

-- Nota: esto aplica a funciones creadas por el rol que ejecuta esta migración.
-- Las RPC que sí deben ser llamadas por el cliente declararán su grant
-- explícito (`grant execute on function ... to authenticated`) en su propia
-- migración, que es el comportamiento deseado: conceder, no heredar.
