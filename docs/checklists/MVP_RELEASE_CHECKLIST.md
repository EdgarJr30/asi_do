# MVP Release Checklist

## Core loop smoke
- Registro de usuario base en `/auth`
- Aprobacion administrativa de usuario, membresia ASI y suscripcion activa antes de acceder a contenido protegido
- Callback de confirmacion de email en `/auth/confirm`
- Onboarding base en `/candidate/onboarding`
- Solicitud de operador en `/candidate/recruiter-request`
- Aprobacion admin en `/admin/approvals`
- Workspace employer en `/workspace`
- Creacion y publish de job en `/platform/jobs` con listado protegido para miembros aprobados
- Apply flow en `/platform/jobs/:slug/apply`
- Pipeline de coordinadores en `/workspace/pipeline`

## PWA readiness
- Manifest instalable visible en mobile
- Service worker registra sin errores
- `/offline` responde como fallback cuando la app pierde red
- Navegacion movil principal sigue usable en `home`, `jobs`, `candidate/applications`, `workspace/pipeline`, `workspace`

## Storage and private media
- Avatar, logos y documentos privados respetan el limite de 5 MB
- Signed URLs abren correctamente para assets privados
- CV principal se puede subir, abrir y eliminar

## Notifications and email hooks
- Los eventos workflow crean filas en `notifications`
- Los eventos workflow crean filas en `notification_deliveries`
- `process-email-deliveries` mueve deliveries `pending` a `sent` o `failed`
- `notification_delivery_logs` deja rastro suficiente para diagnosticar fallos

## Employer operations
- Invitacion de miembro por email existente deja `memberships.status = invited`
- Revocar invitacion cambia el estado a `revoked`
- Export CSV de applicants funciona para roles con `application:export`
- Filtros de pipeline no rompen seleccion, conteos ni permisos

## Candidate utilities
- Saved jobs sigue funcionando con perfil candidato
- Job alerts se pueden crear, pausar, reactivar y eliminar
- El candidato puede seguir aplicando aunque no sea visible a coordinadores
