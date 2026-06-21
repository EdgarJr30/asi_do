# Plan: Membresía → Pago → Aprobación → Activación (gate del ATS)

> Pipeline manual (tipo SaaS de membresía) que controla el acceso a la plataforma/ATS.
> Estado: **Fase 1 en progreso**. Decisiones acordadas el 2026-06-20.

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
6. **Permisos**: `membership_application:review` (pastor+admin), `membership_payment:verify` (admin), `user:activate` (admin).

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
   reabrir registro, guard de redirección a "pendiente". **← EN PROGRESO**
2. **Flujo del miembro** — formulario (categoría + iglesia), panel de progreso, subida de comprobante.
3. **Cola del pastor** — bandeja scoped, aprobar/más-info/rechazar, subir comprobante.
4. **Consola admin** — solicitudes + pagos, validar pago, botón Activar, módulo de datos bancarios, audit.
5. **Notificaciones + pulido** — eventos por transición; recordatorios de renovación (después).

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
