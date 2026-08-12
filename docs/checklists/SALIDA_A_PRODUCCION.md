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
| **Corte** | B1→B7, luego C2, C3, C5, C6, C7, luego D5 (D1–D4 hechos; falta crear el environment `production` en GitHub) |
| **Antes del primer usuario** | **K1** · J5 · F2 · F6 |
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
- [ ] **C5 · Remitente correcto + `Reply-To`** — confirmado: `EMAIL_FROM_ADDRESS` vale
      `ASI Rep. Dominicana <noreply@asidominicana.do>`; debe ser `ASI Dominicana <notificaciones@asidominicana.do>`.
- [ ] **C6 · Matriz de entregabilidad** — Gmail, Outlook, apertura, clic y rebote visibles en Resend y `/admin/correos`. Luego revocar la key vieja.
- [ ] **C7 · Re-correr advisors de Supabase** ([TASK-175](https://linear.app/mooncode/issue/TASK-175)) y activar **protección de contraseñas filtradas**.

## D · Despliegue 🟠

- [x] **D1 · Job `deploy-production`** — ✅ 2026-08-10. Espejo de `deploy-staging` sobre `main`, con
      environment `production` (ahí se configura la revisión manual), la misma puerta de calidad de
      seis jobs, sourcemaps apartados 90 días y smoke de solo lectura contra el dominio ya publicado.
      Lo que faltaba de verdad no era el YAML: **el build de producción ahora se niega a publicar un
      bundle que apunte al proyecto Supabase de desarrollo**, por allow-list versionada en
      `required-env.ts`. Es exactamente el fallo de A, que pasó el build en verde porque no faltaba
      ninguna variable —estaban todas, y una estaba mal—. La comprobación se acota a los artefactos
      con origen canónico alcanzable, para no dejar el `verify` local en rojo. 4 mutantes muertos.
      ⚠️ *Requiere que crees el environment `production` con sus vars y secrets antes del primer uso:
      paso a paso en `CONFIGURAR_DEPLOY_PRODUCCION.md`.*
- [x] **D2 · Retirar una topología** — ✅ 2026-08-10. Netlify eliminado del repo; `public/.htaccess` es la única configuración de servidor del frontend. Queda quitar del panel de Supabase Auth los 4 redirects de `asi-do.netlify.app`.
- [x] **D3 · Edge Functions por CI** — ✅ 2026-08-10. Job `deploy-edge-functions`, de `staging` y de
      `main`, cada rama contra el proyecto de su propio environment (si `main` empujara al proyecto de
      desarrollo, el cron de producción dispararía contra las funciones equivocadas: es B4). Lleva
      `--use-api` porque el empaquetado local falla con un error opaco tras `Bundling Function`.
      **Comprueba el valor, no la presencia:** en GitHub un job con `environment:` hereda los vars del
      repositorio, así que un environment `production` sin su propio `SUPABASE_PROJECT_REF` recibiría
      el de desarrollo —no vacío, válido y equivocado— y publicaría ahí las funciones de producción en
      silencio. La decisión vive en `src/shared/config/deploy-target.ts`, compartida con la validación
      del build y probada con 8 tests (5 mutantes muertos); el workflow solo la invoca, para que no
      haya dos listas de refs que se separen.
      ⚠️ *Requiere `SUPABASE_ACCESS_TOKEN` y `SUPABASE_PROJECT_REF` por environment.*
- [x] **D4 · Que el drift bloquee** — ✅ ya lo hacía. `db-drift.yml:146-150` sale con `exit 1`. La
      entrada estaba mal escrita. *Lo que sí queda:* solo corre diario y a demanda, así que un
      cambio manual en el dashboard puede vivir hasta 24 h sin que nadie lo vea (`ENVIRONMENTS.md:159`).
- [ ] **D5 · Podar bundles obsoletos en Hostinger.** `scripts/deploy-hostinger-release.sh:112,120`
      hace `mirror --reverse` sin `--delete` **a propósito** (los chunks viejos sostienen las
      pestañas abiertas durante el despliegue). Falta la poda diferida, tras confirmar en hPanel
      que la cuenta FTP no puede salir de su document root.

## E · Home pública rota 🟠

`videos/demoApp.webm` y `videos/christian-event.webm` devuelven **400**; el bucket tiene 0 objetos.
La card "Evento destacado" (`institutional-home-page.tsx:1141`) se ve vacía.

- [ ] **E1 · Subir los dos videos** a `public-media`. ⛔ **Bloqueado:** no hay ningún `.webm` en el
      repo; los archivos los tiene que aportar el propietario.
- [x] **E2 · Poster + fallback en `LazyAutoplayVideo`** — ✅ 2026-08-10, `d21ee44`. Los dos call
      sites degradan: la card de evento a imagen, el demo de plataforma a "Demo en preparación".

## F · Producto 🟠

- [x] **F1 · Recordatorios de renovación de membresía** — ✅ 2026-08-10. Cron diario (9:00 hora de
      RD) que encola por `system_create_notification`, así que hereda outbox, `claim_email_deliveries`,
      `is_test` y visibilidad en `/admin/correos`. Cuatro ventanas: 30/7/1 día y vencida. Dos
      decisiones cargan el diseño: se elige **la más urgente ya alcanzada** en vez de la coincidencia
      exacta de día —un cron caído una semana manda el aviso tarde en lugar de perderlo, y a quien
      está a 5 días no se le dice "faltan 30"—, y la marca de idempotencia se lleva por
      (persona, **fecha de vencimiento**, ventana), de modo que renovar rearma los avisos solos. No
      consulta `email_suppressions`: es correo de cuenta, y `/correos/baja` promete que estos siguen
      llegando. Probe de 15 asertos, 4 mutantes muertos; 22/22 probes, 53 tests Deno, `db lint` limpio.
      Desplegado: el cron `0 13 * * *` está activo en el remoto. Sin ejercitar todavía (J5).
- [ ] **F2 · Seis decisiones de producto** — *respuestas tuyas, no código:*
      · [TASK-173](https://linear.app/mooncode/issue/TASK-173)/[174](https://linear.app/mooncode/issue/TASK-174) ¿el MVP sale sin workflow pastoral ni endorsements territoriales?
      · [TASK-244](https://linear.app/mooncode/issue/TASK-244) ¿"aplicar ahora" y "aplicar con tu perfil" son uno o dos flujos?
      · [TASK-5](https://linear.app/mooncode/issue/TASK-5) ¿un usuario puede estar en dos empresas? (no hay switcher en `src/`)
      · [TASK-160](https://linear.app/mooncode/issue/TASK-160) ¿el formulario de membresía coincide con los documentos de ASI?
      · [TASK-163](https://linear.app/mooncode/issue/TASK-163)/[165](https://linear.app/mooncode/issue/TASK-165) ¿Admin Console entra en el MVP?
- [ ] **F3 · Cinco QA visuales** pendientes por falta de navegador: `/privacy` desktop · `/admin/membership` y `/admin/access-control` móvil+desktop · `/account/recruiter-request` · pantalla de versión desactualizada.
- [x] **F4 · Filtros por evento real en `/admin/correos`** — ✅ 2026-08-10, `5f0f7fc`. Selector propio
      con rebote, queja, supresión y retraso vigente. Solo esos cuatro: el filtro va sobre
      `latest_provider_event` y son los terminales, así que "el último evento fue X" equivale a "le
      pasó X". Apertura y clic ya eran filtrables como estado (`read`/`clicked`).
- [ ] **F5 · Re-verificar** [TASK-13](https://linear.app/mooncode/issue/TASK-13) (callback móvil) y [TASK-106](https://linear.app/mooncode/issue/TASK-106) (carrusel Safari iOS).
- [ ] **F6 · Licencia de Joanna Sans Nova en el comprobante** — *respuesta tuya, no código.* El
      comprobante de pago sirve cuatro TTF de Monotype desde `public/brand/fonts/`, así que quedan
      **descargables por cualquiera** que abra el sitio. Hay que confirmar con el contrato que la
      licencia cubre uso web/embebido antes de publicar en producción; el handoff
      (`design_handoff_comprobante_pago/README.md`) ya lo advierte.
      **Dato leído de los archivos:** los cuatro traen `fsType = 0x0004` (*Preview & Print*), copyright
      Monotype 2015. Ese bit permite **embeber la fuente en un documento** para verlo e imprimirlo
      —justo lo que ocurre al guardar el comprobante como PDF—, pero no dice nada sobre servir el
      `.ttf` por HTTP con `@font-face`, que es un derecho aparte (licencia *webfont*) y que estos
      archivos de escritorio probablemente no incluyen. O sea: el PDF resultante es la parte
      defendible; publicar las tipografías es la parte a confirmar.
      Si no la cubre: borrar los `@font-face` de `src/shared/ui/receipt-document.ts` y las TTF de
      `public/brand/fonts/`. El documento cae a `system-ui` sin romperse —mismo layout, el título
      cambia de ancho—, así que no bloquea nada más que la fidelidad tipográfica.

## J · Envío masivo de correos 🆕

Pedido el 2026-08-10. Sube por el outbox existente (hereda idempotencia, lease,
reintentos, modo de prueba y visibilidad en `/admin/correos`), con baja y supresión propias, y
permiso `email:broadcast` solo para owner/super admin. **Desplegado; sin ejercitar en vivo (J5).**

- [x] **J1 · Base de datos** — ✅ 2026-08-10, `074fe6e` + `656363e`. Tablas `email_broadcasts` y
      `email_suppressions`, permiso `email:broadcast`, RPC `email_broadcast_enqueue` (normaliza,
      deduplica por caja, descarta inválidas y suprimidas) y `email_unsubscribe` (token uuid por
      destinatario, sin oráculo). Probe de 14 asertos, 6 mutantes muertos.
- [x] **J2 · Procesador** — ✅ 2026-08-10, `d1ffd0d`. Comprueba la supresión **al enviar** (entre
      encolar y enviar pasan minutos y es ahí donde alguien se da de baja) e inyecta el enlace en
      HTML y texto, solo en los correos de campaña. Estado `suppressed` nuevo: `failed` habría dicho
      que algo se rompió e inflado el contador de problemas. 4 mutantes muertos, 17 tests Deno.
- [x] **J3 · Interfaz** — ✅ 2026-08-10. Panel de envío masivo en `/admin/correos` (solo con
      `email:broadcast`), carga de `.txt`/`.csv`, y ruta pública `/correos/baja` que canjea el
      token al abrir, sin pedir confirmación y sin distinguir un token inventado de uno usado.
      Dos guardas: los conteos de la vista previa salen de `email_broadcast_preview`, que comparte
      normalizador con el encolado —previsualizar y enviar no pueden discrepar—, y el botón de
      envío real no se habilita hasta que ese asunto y ese cuerpo se mandaron en modo prueba a
      direcciones propias; editarlos la invalida. De paso, `total_duplicated` deja de contar las
      inválidas como repetidas: son dos diagnósticos distintos y uno de ellos significa que hay
      que mirar el archivo. Probe de 13 asertos (5 mutantes muertos), 14 tests de unidad, 21/21
      probes en verde en local, `db lint` limpio.
- [x] **J4 · Desplegar el bloque J** — ✅ 2026-08-10, verificado contra el remoto: 0 migraciones
      pendientes, las 4 Edge Functions desplegadas (`process-email-deliveries` v51), y los objetos de
      F1 en su sitio —RPC, tabla de marcas y el cron `0 13 * * *` activo—.
- [ ] **J5 · Ejercitarlo en vivo** — nada del bloque se ha usado todavía: el remoto tiene 0 campañas,
      0 bajas y 0 correos de campaña, y F1 lleva 0 avisos. Está desplegado, no probado, y son cosas
      distintas. Falta: un envío en modo prueba de punta a punta, canjear un `/correos/baja` real, y
      forzar una corrida de `private.enqueue_membership_renewal_reminders()` —el cron no manda nada
      solo, porque de las 2 membresías activas con fecha ninguna está dentro de ventana—.

## K · La instancia no aguanta producción 🔴

Abierto por el incidente del 2026-08-10: **2 h 08 min con la base sin aceptar conexiones**
(12:06–14:14 UTC). Diagnóstico cerrado con métricas del panel.

**Causa: la instancia se quedó sin RAM y entró en *thrashing* de swap.** En el minuto del corte:

| Métrica | Valor |
|---|---|
| RAM total | **411 MB** (Nano) |
| RAM libre | **5,46 MB (1,33 %)** |
| Swap | **515 MB — 125,25 %** |
| Memoria comprometida | 1,4 GB contra un límite de 1,2 GB (**116,71 %**) |
| IOwait de CPU | **92,18 %** |

Lo que **descarta** el resto: IOPS 14 de 3.000 (0,5 %), disco 224 KB/s de 125 MB/s (0,2 %),
conexiones 25 de 60, espacio 0,09 GB de 8 GB. Todo lo demás estaba ocioso. Tampoco fue la carga:
la ventana sana de las 16:58–18:30 movió **el doble** de peticiones (338/min y picos de 84/s,
contra 161/min y 39/s) sin inmutarse.

Con 5 MB libres, arrancar un proceso —que es literalmente lo que hace pg_cron— espera a que el
kernel libere páginas: de ahí los `job startup timeout`, una consulta de catálogo tardando 35 s y
91 `could not accept SSL connection`.

- [ ] **K1 · Subir la instancia de Nano a Micro o superior** 🔴 — es la única acción que ataca la
      causa. Todo lo demás son paliativos. Bloquea el lanzamiento: 411 MB no sostienen Realtime con
      18 tablas publicadas, `max_connections = 60` y el panel de Supabase abierto a la vez.
- [ ] **K2 · `VACUUM FULL` de `user_access_logs`** — 17,8 MB con 7 filas vivas, la tabla más grande
      del proyecto. Pura hinchazón; devuelve ~17 MB.
- [ ] **K3 · No dejar el panel de Supabase abierto contra este proyecto mientras se desarrolla** —
      la pantalla de Functions escribe ~9 MB de ficheros temporales por carga (427 MB en 48 cargas,
      medido en `pg_stat_statements`). Con la instancia actual eso pesa.

**Lo que ya se cerró a raíz del incidente** (ninguno era la causa, todos bajan la presión):
reintentos del webhook acotados por edad, timeouts en las 6 fronteras de red de las Edge Functions
con `check:bounded-io` dentro de `verify`, retención del historial de correo, purga de
`cron.job_run_details` (70.502 → 20.187 filas) y G2. La regla durable es **R-153**.

## G · Rendimiento 🟡

Los 5 están en `Duplicate` en Linear: hoy no aparecen en ninguna vista. Re-verificados en código, ninguno empezado.

- [x] **G1a · [TASK-276](https://linear.app/mooncode/issue/TASK-276) dashboard agregado** — ✅ 2026-08-10, `655b446`.
      RPC `workspace_dashboard_metrics` con guarda de `application:read`; el cliente ya no descarga
      ni una postulación. Las fronteras del periodo siguen saliendo del navegador para no perder la
      medianoche local. Probe de 9 casos + denegación cruzada (4 mutantes muertos) y 5 tests de
      unidad (2 mutantes). 18/18 probes, `db lint` limpio, `anon` sin execute en el remoto.
- [x] **G1b · [TASK-277](https://linear.app/mooncode/issue/TASK-277) contadores agregados** — ✅ 2026-08-10, `38c1422`.
      La pantalla contaba postulaciones por vacante recorriendo `fetchPipelineBoard` —el tablero
      completo— y `useRealtimeSync` la invalidaba ante **cualquier** evento de `applications`: el
      coste crecía con la actividad del tenant, no con lo que se muestra. Ahora es un `group by`.
      Probe de 6 asertos (4 mutantes muertos) + 5 tests de unidad.
- [ ] **G1c · [TASK-277](https://linear.app/mooncode/issue/TASK-277) paginar la lista** — `listTenantJobs`
      (`jobs-api.ts:192`) sigue trayendo todas las vacantes del tenant. Es la mitad invasiva:
      `jobs-overview-page.tsx` filtra por pestaña, tipo, ubicación y búsqueda **en cliente**, deriva
      `locationOptions` del conjunto completo y resuelve `selectedJob`/`viewJob` buscando en la
      lista. Mover eso al servidor cambia la interacción (filtrado con ida y vuelta en vez de
      instantáneo), así que necesita decisión de producto antes que código.
- [x] **G2 · [TASK-274](https://linear.app/mooncode/issue/TASK-274) permisos en una consulta** — ✅ 2026-08-11, `7f66004`.
      La hidratación hacía un `rpc('has_platform_permission')` por permiso: 29 peticiones a
      PostgREST por sesión, sin corte por rol —un candidato sin permisos pedía 29 booleanos para
      recibir 29 `false`— y en cada login, refresco de token y vuelta al foco. En los logs eran 694
      de 1.000 peticiones en 14 minutos, con ráfagas de 116 por segundo; acumulado, el segundo
      consumidor de la base tras el WAL de Realtime. Ahora `my_platform_permissions()` hace el mismo
      recorrido una vez. Medido en vivo con un login real: **116 llamadas → 4**. La probe no valida
      una lista escrita a mano, compara las dos funciones entre sí permiso por permiso (verificada
      por inyección), y 4 tests cubren el cliente, que ningún test tocaba.
- [ ] **G3 · [TASK-275](https://linear.app/mooncode/issue/TASK-275)** — `pipeline-api.ts:12` sin keyset por etapa.
- [ ] **G4 · [TASK-278](https://linear.app/mooncode/issue/TASK-278)** — 203 chunks; fijar budgets en CI ([TASK-24](https://linear.app/mooncode/issue/TASK-24)).
- [ ] **G5 · Escoger qué entra del épico [TASK-14](https://linear.app/mooncode/issue/TASK-14)** (9 subtareas, todas en Todo). Es la superficie pública.

## H · Higiene 🟡

- [x] **H1 · Borrar `countries-states-cities`** — ✅ 2026-08-10, `77d5ad2`.
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
| 2026-08-10 | **A cerrado salvo A3.** Inventario: 0 terceros, nada que migrar. Borrada la cuenta e2e huérfana y hecho visible el fallo de limpieza que la escondía | `de5ecf6` |
| 2026-08-10 | Barrido de verificación contra código: E2, H1 y D4 ya estaban cerrados (D4 nunca fue tarea: el job ya bloqueaba). E1 bloqueado por falta de archivos. C5, D3, D5, F4, H3, H4 confirmados abiertos con su evidencia | — |
| 2026-08-10 | **G1a (TASK-276)**: métricas del dashboard agregadas en la base. La probe de la Fase D cazó de paso que `create function` deja la función invocable por `anon` pese al grant nominal | `655b446` |
| 2026-08-10 | **G1b (TASK-277)**: contador de postulaciones por vacante en un `group by`. Bajaba el tablero completo y se reinvalidaba con cada postulación del tenant | `38c1422` |
| 2026-08-10 | **F4**: filtro por evento real del proveedor en `/admin/correos` | `5f0f7fc` |
| 2026-08-10 | **J2**: la baja bloquea el envío y el enlace viaja en la campaña. Sin desplegar: el remoto no respondía | `d1ffd0d` |
| 2026-08-10 | **D1 y D3**: despliegue de producción y de Edge Functions por CI. Lo que faltaba no era el YAML: el build de producción ahora se niega a publicar contra la base de desarrollo, que es lo que nadie comprobó en A | pendiente |
| 2026-08-10 | **F1**: recordatorios de renovación. El acceso ya caducaba por fecha (`hasActiveAsiAccess`) sin que nadie avisara nunca: se perdía la plataforma el día del vencimiento y en silencio | pendiente |
| 2026-08-10 | **J3**: interfaz del envío masivo y baja pública. La probe de superficie cazó de paso que `enforce_initial_membership_period_after_activation` (`1f0db27`) se creó sin `revoke`: PUBLIC y `anon` podían ejecutarla. Cerrado en la misma migración | pendiente |
| 2026-08-10 | **J1**: base de datos del envío masivo. Los dos guardarraíles del repo saltaron y tenían razón: tabla nueva sin declarar en la matriz de la Fase D, y superficie de `anon` ampliada de 23 a 24 funciones | `074fe6e`, `656363e` |
| 2026-08-11 | **Incidente del 10-ago cerrado (nueva sección K)**: 2 h 08 min sin base. No fue carga, ni disco, ni conexiones — la instancia Nano (411 MB) se quedó con 5,46 MB libres y el swap al 125 %, con 92 % de IOwait. Sale un bloqueante nuevo: **K1, subir de Nano**. La ventana sana movía el doble de tráfico sin despeinarse | — |
| 2026-08-11 | **R-153** generaliza R-152 más allá del correo: esperar, reintentar, abanicar y acumular llevan techo, y solo cuenta si lo hace cumplir PostgreSQL, un test o `verify`. Nace `check:bounded-io`, que al primer pase encontró 4 fronteras de red sin timeout | `ba21287` |
| 2026-08-11 | Reintentos del webhook de Resend acotados por edad del evento. Contestar 4xx/5xx *es* pedir otro reintento: con la base caída, 46 llamadas en 23 minutos que nunca podrían registrarse. Ahora corta antes de verificar la firma y antes de abrir el cliente | `ba21287` |
| 2026-08-11 | Retención del historial de notificaciones y correo. Purgar solo las 4 tablas daba un techo falso, y purgar `notifications` rompía en silencio los enlaces de baja: el token pasa a registro propio. La probe cazó que el `CASCADE` se llevaba los rebotes pese a sus 730 días declarados | `76fcd43`, `757ec9c` |
| 2026-08-11 | **G2**: permisos de plataforma en una consulta. 29 peticiones por hidratación → 1, medido en vivo con un login real: 116 llamadas → 4. Los 475 tests no cubrían nada de esto porque mockean el módulo entero | `7f66004`, `aa80bc0` |
