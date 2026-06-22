# Plan: Membresía → Pago → Aprobación → Activación (gate del ATS)

> Pipeline manual (tipo SaaS de membresía) que controla el acceso a la plataforma/ATS.
> Estado: **Fases 1-5 ✅ completas** (registro→pago→aprobación→verificación→activación + notificaciones por email con envío automático, validado e2e). Pendiente solo: recordatorios de renovación. Decisiones acordadas el 2026-06-20.

## 1. Máquina de estados (un solo carril)

```
REGISTRO          SOLICITUD           PAGO              APROBACIÓN          VERIF. PAGO        ACTIVACIÓN
(self-signup)  →  (categoría +    →   (transfer +   →   (pastor de su   →   (admin valida →   (admin da clic
 cuenta            iglesia de la       comprobante)      iglesia, o          el dinero          'Activar')
 'pendiente')      jerarquía)                            admin si no hay     entró)              = ATS ON
                                                         pastor)
   │                  │                   │                   │                  │                  │
 users:            application        membership_         application       payment            users.status=active
 pending_review    status=submitted   payments            status=approved   status=verified    membership=active
 ATS bloqueado     (auto-ruteo)       status=submitted    (pastoral ref ✓)  (solo admin)       sub=active +1 año
```

El ATS se desbloquea **solo** cuando se cumplen las 3 condiciones y un **admin** hace clic en "Activar". El botón "Activar" permanece deshabilitado hasta que (aprobación ✓ + pago verificado ✓). Separación de funciones (initiator ≠ reviewer ≠ verifier ≠ activator).

## 2. Actores y responsabilidades

| Actor | Puede | NO puede |
|---|---|---|
| **Miembro** | Crear cuenta, enviar solicitud, subir comprobante, ver su progreso | Aprobarse, validar su pago, activarse |
| **Pastor** (con `user_authority_scope` sobre iglesias) | Ver/aprobar solicitudes **de sus iglesias**, subir comprobante por el miembro | Validar el pago, activar, ver solicitudes de otras iglesias |
| **Admin** | Ver/aprobar **todo**, validar pagos, **activar cuentas**, gestionar jerarquía y otorgar autoridad a pastores | — |

## 3. Modelo de datos

**Ya existe (reutilizamos):** jerarquía `church_unions→associations→districts→churches`,
`institutional_membership_applications` (categoría + dues + datos pastor), `pastor_authority_requests`,
`regional_administrator_authority_requests`, `user_authority_scopes`, flags en `users`
(`user_approval_status`, `asi_membership_status`, `user_subscription_status`, `manual_access_override_until`),
notificaciones, audit log, RPCs de revisión de autoridad, `hasActiveAsiAccess()`.

**Nuevo a construir:**
1. **`membership_payment_settings`** — datos bancarios/transferencia editables por admin (módulo de configuración). 1 fila activa.
2. **`membership_payments`** — `application_id`, `member_user_id`, `category_slug`, `amount`, `currency`, `period_start/end`, `method='bank_transfer'`, `receipt_path`, `status` (`submitted/verified/rejected`), `uploaded_by_user_id`, `verified_by_user_id`, `verified_at`, `notes`.
3. **Vínculo a jerarquía real** en `institutional_membership_applications`: `church_id` (FK), `assigned_pastor_user_id`, `assigned_queue` (`pastor`/`admin`).
4. **Bucket de storage privado** para comprobantes (RLS: dueño + pastor asignado + admin).
5. **RPCs** (RLS/scope + audit): `review_membership_application` (pastor/admin), `verify_membership_payment` (admin), `activate_member` (admin; exige aprobado + pago verificado).
6. **Permisos**: `membership_application:review` (pastor+admin), `membership_payment:verify` (admin), `user:activate` (admin). ✅ creados y otorgados a `platform_owner`/`platform_admin`; el pastor autoriza por `user_authority_scope` (no por estos permisos).

## 4. Flujos (pipelines)

**🧑 Miembro:** signup → panel de progreso (4 pasos en vivo) → solicitud (categoría + selector jerárquico de iglesia)
→ pantalla de pago (datos de transferencia + cuota + subir comprobante) → espera → notificación de activación → ATS habilitado.

**⛪ Pastor:** signup → solicita autoridad (elige iglesias) → admin otorga alcance → cola con **solo** las solicitudes de
sus iglesias → aprueba / pide más info / rechaza; puede subir comprobante por el miembro.

**🛡️ Admin:** ve **toda** solicitud y pago → valida comprobantes → **activa cuentas** → gestiona jerarquía y otorga
autoridad a pastores.

## 5. Gating (enforcement)
- `hasActiveAsiAccess()` + `RequireActiveAsiAccess` ya bloquean el ATS. Activar = flip de flags
  (`status=active, approval=approved, membership=active, subscription=active, +1 año`).
- **Nuevo guard**: usuario autenticado pero NO activo → redirige al **panel de membresía** (no a "forbidden").
- **Edge**: pastores/admins se activan por el admin (override) sin requerir pago.

## 6. Notificaciones y auditoría
- Nueva solicitud → pastor asignado (o admins). Comprobante subido → admins. Aprobada / falta info → miembro.
  Activada → miembro (bienvenida). (Resend integrado para emails.)
- Audit trail en cada transición (quién/cuándo/decisión).

## 7. Fases de implementación
1. **Datos & gating** — migración (settings de pago, pagos, `church_id`+ruteo, RPCs, RLS, bucket), wiring de flags,
   reabrir registro, guard de redirección a "pendiente". **✅ COMPLETA (migración aplicada)**
   - ✅ Permisos §3.6 creados + otorgados a roles admin (`20260621130000`).
   - ✅ RLS de lectura scoped del pastor en `institutional_membership_applications` (guardada contra `church_id null`).
   - ✅ Fix de seguridad en `review_membership_application`: el camino del pastor exige `church_id not null` (sin iglesia → solo admin).
2. **Flujo del miembro** — formulario (categoría + iglesia), panel de progreso, subida de comprobante. **✅ COMPLETA**
   - ✅ Selector jerárquico de iglesia (unión→asociación→distrito→iglesia) → escribe `church_id` y dispara auto-ruteo.
   - ✅ Jerarquía de prueba sembrada (Unión Dominicana: 4 asociaciones, 8 distritos, 16 iglesias).
   - ✅ Subida de comprobante: upload al bucket privado `membership-receipts` + `insert` en `membership_payments` (status=submitted), reflejado en el panel; re-subida tras rechazo soportada.
   - ✅ Entrada del flujo: panel → "Iniciar mi solicitud" va a elegibilidad (categoría) → formulario; tras enviar, CTA "Ir a mi panel de membresía" regresa al panel de pago.
   - ✅ El miembro puede ver/descargar su comprobante subido (URL firmada) desde el panel.
   - ✅ **Envío habilitado + validado e2e de punta a punta** (`tests/e2e/membership-full-submission.spec.ts`): flag `MEMBERSHIP_APPLICATION_SUBMISSIONS_LOCKED=false`; un miembro logueado completa el formulario real de 6 pasos (categoría `retired`) y lo envía → se crea la solicitud con `requester_user_id` correcto (RLS insert_self), `church_id` del picker y **auto-ruteo al pastor** (`assigned_queue=pastor`). Los CTAs de registro del storefront/app derivan de `PLATFORM_REGISTRATION_LOCKED`.
3. **Cola del pastor** — bandeja scoped, aprobar/más-info/rechazar, subir comprobante. **✅ COMPLETA**
   - ✅ Detección del pastor en sesión: `activePastorScopeCount` en `SessionSnapshot` (cuenta de `user_authority_scopes` activos `pastor_administrator`) → `session.isMembershipReviewerPastor`.
   - ✅ Página `PastorMembershipQueuePage` en `/candidate/membership-queue` (dentro del shell; sin requerir ATS activo). Item de nav "Solicitudes de mi iglesia" (grupo Pastoral) solo visible para pastores.
   - ✅ Bandeja scoped: `fetchPastorMembershipQueue()` (pendientes + `church_id not null`; RLS limita a sus iglesias) con último pago por solicitud.
   - ✅ Acciones aprobar/más-info/rechazar vía RPC `review_membership_application` (autoriza por scope + audita); aprobar fija referencia pastoral `endorsed`, rechazar `declined`.
   - ✅ Pastor puede ver el comprobante (URL firmada) y subirlo por el miembro.
   - ✅ **Loop "falta información"**: el panel del miembro muestra la nota del pastor (estado `needs_more_info`) y permite responder y reenviar a revisión vía RPC `respond_membership_application` (`needs_more_info`→`under_review`, conserva la nota del revisor + anexa la respuesta del miembro, audita).
   - ✅ **Endurecimiento RLS** (migración `20260622130000`): la lectura/carga de pagos y de comprobantes del bucket se acotó al **pastor de la iglesia del miembro** vía `pastor_has_scope_over_member(member)` (antes lo permitía a *cualquier* pastor con scope activo). Ahora coincide con §3.4 ("dueño + pastor asignado + admin").
   - ✅ **Validado e2e (Playwright)**: `tests/e2e/pastor-membership-queue.spec.ts` (login del pastor → cola scoped → aprobar vía RPC, con confirmación en `audit_logs`; **+ test negativo**: un 2º pastor con alcance sobre otra iglesia ve la cola **vacía**, no las solicitudes ajenas) y `tests/e2e/membership-needs-more-info.spec.ts` (miembro ve la nota y reenvía). Sembrados: pastor A sobre *Iglesia Central de Santo Domingo*, pastor B sobre *Iglesia Gazcue* + solicitudes/pago de prueba. Los tests hacen `skip` salvo que se definan `E2E_PASTOR_EMAIL`/`E2E_PASTOR2_EMAIL`/`E2E_MEMBER_EMAIL`.
   - ✅ **RLS verificada a nivel de datos** (JWT real por pastor vía PostgREST): pastor A ve el pago y la solicitud de su miembro (1/1); pastor B (otra iglesia) ve **0/0**. Confirma `pastor_has_scope_over_member` en `membership_payments` e `institutional_membership_applications`.
   - ✅ **RLS del bucket (signed URL) verificada**: con un comprobante real subido, firmar la URL (`POST /storage/v1/object/sign/...`) da **HTTP 200** para el pastor de la iglesia y **HTTP 404 (oculto por RLS)** para un pastor de otra iglesia.
   - Nota: el helper se refactorizó en `20260622140000` (join directo contra `user_authority_scopes`, equivalente; no corrige bug — un falso negativo en pruebas se debió a un usuario sembrado que fue eliminado, lo que dejó la solicitud sin `requester` y borró su pago en cascada).
4. **Consola admin** — solicitudes + pagos, validar pago, botón Activar, módulo de datos bancarios, audit. **✅ COMPLETA**
   - ✅ Página `MembershipConsolePage` en `/admin/membership` (gateada por `membership_payment:verify`); nav admin "Membresía". Lista cada solicitud accionable con su último pago y el estado de la cuenta del miembro.
   - ✅ Acciones por solicitud: revisar (aprobar/más-info/rechazar) vía RPC `review_membership_application`; verificar/rechazar pago vía `verify_membership_payment`; ver comprobante (URL firmada); **Activar cuenta** vía `activate_member` (habilitado solo con solicitud aprobada + pago verificado; flip de flags + `+1 año`). Todo audita.
   - ✅ Consolidación: se retiró la sección de membresía de `RecruiterReviewPage` (`/admin/approvals`) que usaba un UPDATE directo sin auditoría; se eliminaron las funciones muertas `reviewInstitutionalMembershipApplication`/`listPendingInstitutionalMembershipApplications`. El módulo de datos bancarios ya existía en `/admin/payments`.
   - ✅ **Validado e2e** (`tests/e2e/membership-admin-console.spec.ts`): un admin de plataforma aprueba → verifica pago → activa; confirmado en BD (flags del miembro a `active`/`approved`, `+1 año`) y en `audit_logs` (`membership_payment.verified`, `member.activated`, actor=admin).
5. **Notificaciones + pulido** — eventos por transición; recordatorios de renovación (después). **✅ COMPLETA (envío automático)**
   - ✅ Migración `20260622150000_membership_notifications.sql`: cablea los 5 eventos de §6 a `system_create_notification` (inbox in-app + cola de email + push). Helper `notify_membership_admins` (fan-out a admins, excluye al actor); triggers `AFTER INSERT` para *solicitud enviada* (`membership.application_submitted` → pastor o admins) y *comprobante subido* (`membership.payment_submitted` → admins); RPCs `review_membership_application`/`verify_membership_payment`/`activate_member` recreadas con notificación al miembro (`membership.reviewed`, `membership.payment_reviewed`, `membership.activated`). Temas de email con estilo para los 5 tipos en `process-email-deliveries`.
   - ✅ **Resend**: key específica del proyecto ASI + remitente `ASI Rep. Dominicana <noreply@mooncode.website>` (dominio verificado) en `.env.local` y en secretos de Supabase; función redesplegada. Camino real verificado (POST directo + invocación de la Edge Function → enviados).
   - ✅ **Scheduler** (migración `20260622160000_email_dispatch_cron.sql`): job pg_cron cada minuto + pg_net que invoca el procesador cuando hay pendientes (antes no existía cron → emails atascados desde 2026-03-15). Config (URL/anon/secret) en `private.runtime_secrets`, fuera de git. **Verificado e2e**: notificación encolada → enviada sola en <60s (`sent`, resend HTTP 200).
   - Pendiente: recordatorios de renovación (after).

## 8. Pendiente de contenido/config
- **Cuotas (dues)** por categoría (las 3) + moneda → se cargan desde el módulo admin de settings.
- **Datos bancarios** reales → se cargan desde el módulo admin (sembrados de prueba por ahora).

## Decisiones acordadas
- Ruteo: el solicitante elige iglesia de la jerarquía → auto-ruteo al pastor con alcance; sin pastor → cola admin.
- Activación: aprobación + pago verificado + clic "Activar" de admin (admin-only el paso final).
- Pago: anual por categoría, comprobante, renovación manual.
- Validación del pago: solo admins. Pastor aprueba la referencia pastoral.
- Alta de pastores: self-registro + solicitud de autoridad + admin otorga alcance (flujo existente).
- Gate aplica a **todos** los usuarios (candidatos y empresas).
- Registro reabierto: cuenta nueva = 'pendiente'; solo ve el flujo de membresía hasta activación.
- Panel de progreso guiado para el miembro pendiente.
