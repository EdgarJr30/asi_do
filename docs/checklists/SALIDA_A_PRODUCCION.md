# Salida a producción

Qué falta para el corte. Auditoría del 2026-08-10 (Linear completo contra repo, remoto y dominios
en vivo). El pendiente se lleva aquí, no como issues nuevos (`REGRESSION_RULES.md` R-133).

**El problema no es funcionalidad. Es que hay un solo proyecto Supabase, es el de desarrollo, y
`asidominicana.do` ya está sirviendo contra él.**

---

## Orden

| Cuándo | Qué |
|---|---|
| **Hoy** | ~~A1~~ ✅ · B1 · C1 · C4 · E1 · E2 |
| **Corte** | B1→B7, luego C2, C3, C5, C6, C7, luego D1→D5 |
| **Antes del primer usuario** | F1 · F2 |
| **Semana 1** | G, H, I |

`B` desbloquea `A`, `C` y media `D`: no se puede rotar la llave de un proyecto que no existe.

---

## A · El dominio de producción sirve la base de desarrollo 🔴

`asidominicana.do` → 200, artefacto del 7-ago subido a mano, bundle apunta a
`jgmojkzthfogynqixkob` (el de `.env.local`, declarado "exclusivamente desarrollo" en
`ENVIRONMENTS.md:9`). Quien se registre ahí queda en la base de desarrollo y sus pagos van al
merchant de pruebas.

- [x] **A1 · Decidir qué hace el dominio hoy** — ✅ 2026-08-10. **Sin medida provisional:** el
      proyecto de producción se crea hoy (B1), así que el dominio se repunta directo en A3 en vez
      de pasar por un redirect o una holding page que habría que deshacer el mismo día.
- [x] **A2 · Contar qué entró desde el 7-ago** — ✅ 2026-08-10. **No hay terceros: nada que migrar.**
      3 cuentas (la del propietario, una de prueba y una cuenta e2e huérfana, ya borrada), 3
      solicitudes y 2 pagos de RD$2.500 `verified` contra el merchant de **pruebas**, 0 donaciones.
      Todo del 10-ago y de cuentas propias. La exposición era hacia adelante, no acumulada.
- [ ] **A3 · Repuntarlo a producción** tras B. *Cierra cuando:* el bundle público no contiene el ref de desarrollo.

## B · Crear el proyecto Supabase de producción 🔴

Runbook `ENVIRONMENTS.md` §6. El replay de migraciones y las 17 probes ya están verdes: no es una apuesta.

- [ ] **B1 · Crear el proyecto** y anotar `project_ref` en `ENVIRONMENTS.md` §2.
- [ ] **B2 · `supabase db push --linked`**. *Cierra cuando:* `db lint` limpio y `npm run test:probes` 17/17.
- [ ] **B3 · Cargar secretos §4.3 y §4.4 con valores nuevos** — VAPID y `EMAIL_PROCESSOR_SECRET` propios. Ninguno reutilizado.
- [ ] **B4 · `email_dispatch_url` al ref de producción antes de agendar el cron.** Si se clona sin tocarlo, el cron de producción dispara contra las funciones de desarrollo.
- [ ] **B5 · Desplegar Edge Functions** (desde CI, ver D3).
- [ ] **B6 · `site_url` + `additional_redirect_urls`** del entorno. Incluir `/auth/reset-password` junto a `/auth/confirm`.
- [ ] **B7 · Verificación e2e en producción** — login, solicitud, pago, correo, push.

## C · Credenciales 🔴

- [ ] **C1 · Pedir credenciales de producción a AZUL** (merchant real, `AZUL_AUTH_KEY`, `contpagos.azul.com.do`). Incluye el diseño de [TASK-242](https://linear.app/mooncode/issue/TASK-242). *Sale hoy.*
- [ ] **C2 · Rotar la `service_role`** (`ENVIRONMENTS.md:157`). Estuvo en claro en `audit_logs` desde marzo. Resincronizar `.env.local`, AZUL y Edge Functions. *Cierra cuando:* la vieja da 401 y el cron encadena 20 corridas.
- [ ] **C3 · Cablear AZUL producción** — `AZUL_ENVIRONMENT=production` + §4.5 completa. *Cierra cuando:* un cobro real mínimo activa membresía y aparece en `reconcile`.
- [ ] **C4 · Separar API keys de Resend por entorno.** Hoy hay una sola `asi-dev` que puede administrar dominios, webhooks y keys. *Sale hoy.*
- [ ] **C5 · Remitente correcto + `Reply-To`** — hoy manda `noreply@`, debe ser `notificaciones@asidominicana.do`.
- [ ] **C6 · Matriz de entregabilidad** — Gmail, Outlook, apertura, clic y rebote visibles en Resend y `/admin/correos`. Luego revocar la key vieja.
- [ ] **C7 · Re-correr advisors de Supabase** ([TASK-175](https://linear.app/mooncode/issue/TASK-175)) y activar **protección de contraseñas filtradas**.

## D · Despliegue 🟠

- [ ] **D1 · Job `deploy-production`** sobre `main` con environment protegido, espejo de `deploy-staging` (`ci.yml:269`).
- [x] **D2 · Retirar una topología** — ✅ 2026-08-10. Netlify eliminado del repo; `public/.htaccess` es la única configuración de servidor del frontend. Queda quitar del panel de Supabase Auth los 4 redirects de `asi-do.netlify.app`.
- [ ] **D3 · Edge Functions por CI**, no desde la laptop (`ENVIRONMENTS.md:160`).
- [ ] **D4 · Que el drift bloquee** en vez de informar (`db-drift.yml`) → cero cambios manuales en el dashboard (`:159`).
- [ ] **D5 · Activar `--delete` del mirror FTP** tras confirmar el aislamiento en hPanel.

## E · Home pública rota 🟠

`videos/demoApp.webm` y `videos/christian-event.webm` devuelven **400**; el bucket tiene 0 objetos.
La card "Evento destacado" (`institutional-home-page.tsx:1141`) se ve vacía.

- [ ] **E1 · Subir los dos videos** a `public-media`.
- [ ] **E2 · Poster + fallback en `LazyAutoplayVideo`** para que un video roto no deje hueco.

## F · Producto 🟠

- [ ] **F1 · Recordatorios de renovación de membresía.** No hay ningún cron (`grep cron.schedule` → solo correo, audit, access logs, errores). La métrica `membershipsExpiringSoon` ya existe. Ventanas: 30/7/1 día y post-vencimiento. Debe pasar por `claim_email_deliveries` y respetar `is_test`.
- [ ] **F2 · Seis decisiones de producto** — *respuestas tuyas, no código:*
      · [TASK-173](https://linear.app/mooncode/issue/TASK-173)/[174](https://linear.app/mooncode/issue/TASK-174) ¿el MVP sale sin workflow pastoral ni endorsements territoriales?
      · [TASK-244](https://linear.app/mooncode/issue/TASK-244) ¿"aplicar ahora" y "aplicar con tu perfil" son uno o dos flujos?
      · [TASK-5](https://linear.app/mooncode/issue/TASK-5) ¿un usuario puede estar en dos empresas? (no hay switcher en `src/`)
      · [TASK-160](https://linear.app/mooncode/issue/TASK-160) ¿el formulario de membresía coincide con los documentos de ASI?
      · [TASK-163](https://linear.app/mooncode/issue/TASK-163)/[165](https://linear.app/mooncode/issue/TASK-165) ¿Admin Console entra en el MVP?
- [ ] **F3 · Cinco QA visuales** pendientes por falta de navegador: `/privacy` desktop · `/admin/membership` y `/admin/access-control` móvil+desktop · `/account/recruiter-request` · pantalla de versión desactualizada.
- [ ] **F4 · Filtros por evento real en `/admin/correos`** — hoy solo filtra estados agregados, faltan rebotes, quejas, retrasos, aperturas y clics.
- [ ] **F5 · Re-verificar** [TASK-13](https://linear.app/mooncode/issue/TASK-13) (callback móvil) y [TASK-106](https://linear.app/mooncode/issue/TASK-106) (carrusel Safari iOS).

## G · Rendimiento 🟡

Los 5 están en `Duplicate` en Linear: hoy no aparecen en ninguna vista. Re-verificados en código, ninguno empezado.

- [ ] **G1 · [TASK-276](https://linear.app/mooncode/issue/TASK-276) + [277](https://linear.app/mooncode/issue/TASK-277) juntos** — `dashboard-api.ts:117` baja el pipeline entero y agrega en cliente; `listTenantJobs` (`jobs-api.ts:192`) sin paginación. Copiar el patrón de TASK-267/268. **El de mayor ganancia por esfuerzo.**
- [ ] **G2 · [TASK-274](https://linear.app/mooncode/issue/TASK-274)** — `auth-api.ts:394` hace un `rpc('has_platform_permission')` por permiso. No existe `get_session_snapshot`.
- [ ] **G3 · [TASK-275](https://linear.app/mooncode/issue/TASK-275)** — `pipeline-api.ts:12` sin keyset por etapa.
- [ ] **G4 · [TASK-278](https://linear.app/mooncode/issue/TASK-278)** — 203 chunks; fijar budgets en CI ([TASK-24](https://linear.app/mooncode/issue/TASK-24)).
- [ ] **G5 · Escoger qué entra del épico [TASK-14](https://linear.app/mooncode/issue/TASK-14)** (9 subtareas, todas en Todo). Es la superficie pública.

## H · Higiene 🟡

- [ ] **H1 · Borrar `countries-states-cities`** (`package.json:54`, ~35 MB, solo en comentarios).
- [ ] **H2 · Fijar Node** — `packageManager`, `.nvmrc`, `npm ci` en el Dockerfile de AZUL.
- [ ] **H3 · Centralizar `requireSupabase`** (duplicado en 18 archivos).
- [ ] **H4 · Índices trigram para el access log** — quedó en −11 % por `ilike '%…%'`. `pg_trgm` ya instalado.
- [ ] **H5 · Fase C al esquema `storage`** — `anon` conserva `GRANT ALL` sobre `storage.objects`/`buckets`. Verificar subida y borrado reales **después** de revocar.
- [ ] **H6 · Partir los 5 componentes >1.700 líneas** (membresía 2.745).

## I · Limpiar Linear 🧹

24 issues en `Duplicate`, invisibles en toda vista.

- [ ] **I1 · TASK-274 a 278 → `Todo`** (los 5 vivos).
- [ ] **I2 · 18 cerrados → `Done`** — TASK-256 a 270, 272, 273, 271.
- [ ] **I3 · Cancelar [TASK-179](https://linear.app/mooncode/issue/TASK-179)** — el registro está abierto por decisión de producto.
- [ ] **I4 · Cerrar absorbidos** — TASK-7 (por 259), TASK-8 (por 261), TASK-9 (Fases A-D), TASK-164 (arnés), TASK-251, TASK-271.
- [ ] **I5 · Triar [TASK-166](https://linear.app/mooncode/issue/TASK-166)** — es el contenedor de F2.
- [ ] **I6 · Enlazar este documento desde TASK-255.**

---

## Ya está hecho (el backlog no lo refleja)

| | Evidencia |
|---|---|
| TASK-251 confirmar cerrar/archivar vacante | `jobs-overview-page.tsx:1682` |
| TASK-271 media huérfana | `bb981ef`, `scripts/media-orphans.ts` |
| 402 de vector buckets en `config push` | `supabase/config.toml:22` |
| Staging | `dev.asidominicana.do` 200 por CI; AZUL en Railway `/healthz` 200 |

## No re-verificado hoy

203 chunks (exige build) · permisos reales de la key de Resend (exige panel) · `GRANT ALL` de `anon`
sobre `storage.*` (exige consulta al remoto).

---

## Bitácora

| Fecha | Qué | Commit |
|---|---|---|
| 2026-08-10 | Auditoría de lanzamiento. Hallazgo: `asidominicana.do` sirve la base de desarrollo | `85ad726` |
| 2026-08-10 | **A cerrado salvo A3.** Inventario: 0 terceros, nada que migrar. Borrada la cuenta e2e huérfana y hecho visible el fallo de limpieza que la escondía | pendiente |
