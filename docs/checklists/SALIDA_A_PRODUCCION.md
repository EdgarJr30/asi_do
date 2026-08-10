# Salida a producción — seguimiento L1…L9

Auditoría de lanzamiento del **2026-08-10**, hecha leyendo Linear completo (los 3 estados
abiertos del equipo, los 24 issues escondidos en `Duplicate` y los 20 comentarios de
[TASK-255](https://linear.app/mooncode/issue/TASK-255), que son el checklist maestro real) y
contrastándolo contra el repositorio, el proyecto Supabase remoto y los dominios en vivo.

El patrón común: *el producto está mucho más terminado de lo que dice el backlog, y el entorno
en el que corre está mucho menos separado de lo que dice la documentación.*

Lo que falta para salir **no es funcionalidad**. Es que hoy existe **un solo proyecto Supabase**,
declarado de desarrollo, y el dominio de producción ya está sirviendo contra él.

Cada tarea se identifica `L{bloque}.{n}`, apunta a su issue de Linear cuando existe, y dice
**cómo se sabe que está hecha**. Siguiendo `REGRESSION_RULES.md` R-133, el pendiente se lleva
como checklist —aquí— y no como issues nuevos de Linear.

---

## Tablero

| Id | Bloque | Gravedad | Estado |
|---|---|---|---|
| [L1](#l1--el-dominio-de-producción-sirve-la-base-de-desarrollo) | El dominio de producción sirve la base de desarrollo | 🔴 bloqueante | ☐ abierto |
| [L2](#l2--no-existe-el-proyecto-supabase-de-producción) | No existe el proyecto Supabase de producción | 🔴 bloqueante | ☐ abierto |
| [L3](#l3--credenciales-y-secretos-del-corte) | Credenciales del corte: `service_role`, AZUL, Resend | 🔴 bloqueante | ☐ abierto |
| [L4](#l4--despliegue-dos-topologías-y-publicación-a-mano) | Dos topologías vivas y publicación fuera de CI | 🟠 | ☐ abierto |
| [L5](#l5--la-home-pública-está-rota) | La home pública está rota (videos 400) | 🟠 | ☐ abierto |
| [L6](#l6--producto-sin-cerrar) | Producto sin cerrar (renovaciones + 6 decisiones) | 🟠 | ☐ abierto |
| [L7](#l7--rendimiento-los-5-p1-siguen-intactos) | Los 5 P1 de rendimiento siguen intactos | 🟡 | ☐ abierto |
| [L8](#l8--higiene-barata) | Higiene barata | 🟡 | ☐ abierto |
| [L9](#l9--linear-no-refleja-la-realidad) | Linear no refleja la realidad | 🧹 | ☐ abierto |

**Números medidos, no estimados:** 59 issues abiertos del proyecto *Desarrollo ASI* (17 en
`Todo`, 18 en `Backlog`, 24 en `Duplicate`). De los 23 hijos de TASK-255, **18 están cerrados de
verdad** y 5 siguen vivos. Ninguno de los 24 en `Duplicate` aparece en ninguna vista de Linear.

---

## Orden de ataque

El criterio no es esfuerzo: es **quién te hace esperar**. Dos de los tres bloqueantes dependen de
terceros (AZUL, Resend) y uno depende de crear infraestructura nueva. Todo lo demás se puede
hacer en paralelo mientras esos responden.

| Cuándo | Qué | Por qué |
|---|---|---|
| **Hoy** | [L1.1](#l1--el-dominio-de-producción-sirve-la-base-de-desarrollo) · [L3.1](#l3--credenciales-y-secretos-del-corte) · [L3.4](#l3--credenciales-y-secretos-del-corte) · [L5](#l5--la-home-pública-está-rota) | L1.1 es una decisión que no cuesta trabajo y detiene el sangrado. L3.1/L3.4 son correos a terceros: cuanto antes salgan, antes vuelven. L5 son 10 minutos y arregla la cara pública. |
| **Corte** (~2 días) | [L2](#l2--no-existe-el-proyecto-supabase-de-producción) completo → [L3](#l3--credenciales-y-secretos-del-corte) → [L4](#l4--despliegue-dos-topologías-y-publicación-a-mano) | La secuencia obligada. No se puede rotar una llave de un proyecto que no existe. |
| **Antes del primer usuario** | [L6.1](#l6--producto-sin-cerrar) (renovaciones) · [L6.2](#l6--producto-sin-cerrar) (las 6 decisiones) | Una membresía que vence en silencio es un cobro perdido y una queja. |
| **Semana 1** | [L7](#l7--rendimiento-los-5-p1-siguen-intactos) · [L8](#l8--higiene-barata) · [L9](#l9--linear-no-refleja-la-realidad) | Duele con datos reales, pero no impide abrir. |

## El cuello de botella compartido

L1, L2, L3 y la mitad de L4 **no son cuatro problemas**. Son el mismo: *existe un solo proyecto
Supabase, y es el de desarrollo.*

- **L1** es el síntoma visible: el dominio productivo apunta a ese único proyecto.
- **L3** no se puede ejecutar antes de L2: rotar la `service_role` del proyecto de desarrollo no
  protege producción, solo obliga a resincronizar tres sitios dos veces.
- **L4** no puede tener dos GitHub Environments con juegos de variables distintos si solo hay un
  juego de variables que dar.

**L2 desbloquea los tres.** Por eso va antes que cualquier otra cosa del corte, y por eso L1.1 es
una decisión provisional —qué hacer *mientras tanto*— y no el arreglo.

```
  L2.1 crear proyecto → L2.2 db push → L2.3 secretos → L2.4 edge fns → L2.5 verificación
                                            │
                                            ├── L3.2 rotar service_role (necesita el proyecto)
                                            ├── L3.3 AZUL producción (necesita el proyecto)
                                            └── L4.1 environment protegido de main

  Pistas independientes, avanzan en paralelo desde hoy:
  L1.1 (decisión provisional) · L3.1 y L3.4 (pedidos a terceros) · L5 · L6 · L7 · L8 · L9
```

---

## Lo que ya está cerrado y el backlog no refleja

Verificado en código el 2026-08-10. Cuatro cosas que auditorías anteriores daban por pendientes:

| Se creía pendiente | Realidad | Cómo se verificó |
|---|---|---|
| TASK-251 — confirmar cerrar/archivar vacante | **Hecho** | `jobs-overview-page.tsx:1682` — diálogo con copy propio para cada acción |
| TASK-271 — ciclo de vida de media huérfana | **Hecho** | `bb981ef`; `scripts/media-orphans.ts`; `package.json:38-39` (`media:orphans`, `media:orphans:apply`) |
| `supabase config push` bloqueado por el 402 de vector buckets | **Resuelto** | `supabase/config.toml:21-23` — `[storage.vector] enabled = false`, con el porqué documentado encima |
| Staging sin montar | **Montado** | `dev.asidominicana.do` → 200; job `deploy-staging` en `ci.yml:269`; AZUL staging en Railway → `/healthz` 200 |

---

# L1 · El dominio de producción sirve la base de desarrollo

**`asidominicana.do` está público ahora mismo y su bundle apunta al proyecto Supabase de
desarrollo.** No es una topología pendiente de limpiar: es el entorno equivocado atendiendo al
dominio real.

## Estado medido

| Hecho | Cómo se verificó |
|---|---|
| `asidominicana.do` responde 200 y sirve la SPA de ASI | `curl -sI https://asidominicana.do/` → `200`, `platform: hostinger` |
| Su artefacto es del **7 de agosto**, subido a mano | `last-modified: Fri, 07 Aug 2026 20:00:11 GMT`, 3 días por detrás de staging |
| Su bundle apunta al proyecto de desarrollo | `curl -s .../assets/index-DgY1T1Sy.js \| grep -o "https://[a-z]*\.supabase\.co"` → `jgmojkzthfogynqixkob`, idéntico al `VITE_SUPABASE_URL` de `.env.local` |
| Ese proyecto está declarado exclusivamente de desarrollo | `ENVIRONMENTS.md:9-10` — «Hay un solo proyecto Supabase y es exclusivamente desarrollo… todavía no existe el proyecto Supabase de producción» |
| Staging sí está al día y sí pasa por CI | `dev.asidominicana.do` → `last-modified` de hace minutos, publicado por `deploy-staging` |

## Las tres consecuencias

1. **Cualquiera que se registre en `asidominicana.do` queda en la base de desarrollo**, mezclado
   con los datos sintéticos que siembra el arnés de estrés (`npm run harness:seed`).
2. **Los pagos de ahí salen contra el merchant de pruebas de AZUL** (`39038540035`,
   `AZUL_ENVIRONMENT=test`, `ENVIRONMENTS.md:22`). Nadie cobra y nadie recibe servicio.
3. **Ese `dist/` no pasó por ninguna puerta de calidad.** Se construyó en una laptop con los
   `VITE_*` de esa máquina (`ENVIRONMENTS.md:113`) y se subió a mano.

## Tareas

- [ ] **L1.1 · Decidir qué hace `asidominicana.do` mientras no exista producción**
  Tres opciones, y hay que escoger hoy porque el sitio está vivo:
  (a) **despublicar** —el dominio devuelve una página de "próximamente" hasta el corte—;
  (b) **redirigir** a `dev.asidominicana.do` y asumir públicamente que es un preview;
  (c) **dejarlo** y aceptar que los registros y pagos de estos días son desechables y habrá que
  migrarlos o borrarlos.
  *Hecho cuando:* la decisión está en "Decisiones tomadas" con su porqué y el dominio se comporta
  como dice.

- [ ] **L1.2 · Inventariar qué se creó en el proyecto de desarrollo desde el dominio público**
  Cuentas reales, solicitudes de membresía y pagos iniciados que hayan entrado por
  `asidominicana.do` desde el 7 de agosto. Es lo que decide si el corte puede ser limpio o hay que
  migrar filas.
  *Hecho cuando:* hay un conteo por tabla (`auth.users`, `institutional_membership_applications`,
  `membership_payments`, `donations`) obtenido con `supabase db query --linked`, y una decisión de
  migrar o descartar.

- [ ] **L1.3 · Cerrar el bucle una vez exista producción**
  `asidominicana.do` pasa a servir el artefacto de `main` contra el proyecto de producción.
  *Hecho cuando:* el bundle público de `asidominicana.do` **no** contiene el ref de desarrollo —
  la misma comprobación de la tabla de arriba, invertida.

---

# L2 · No existe el proyecto Supabase de producción

El runbook está escrito y es bueno: `ENVIRONMENTS.md` §6, diez pasos. Nunca se ha ejecutado.

## Estado medido

| Hecho | Cómo se verificó |
|---|---|
| Un solo proyecto, el de desarrollo | `ENVIRONMENTS.md:9-10` + `supabase/config.toml` |
| El replay de migraciones desde cero está verde | `.github/workflows/db-migrations.yml` (marcado ✅ en `ENVIRONMENTS.md:155`) |
| La vigilancia de drift está verde | `.github/workflows/db-drift.yml` (✅ en `:156`) |
| Las 17 probes corren en CI sobre base reproducida | `COBERTURA_CRITICA_EN_CI.md` R1, 17/17 |

**Lo importante: la parte cara ya se pagó.** Reconstruir el esquema en un proyecto nuevo no es una
apuesta porque el replay y las probes ya demuestran que las 87 migraciones se aplican desde cero y
que la autorización sobrevive al viaje.

## Tareas

Es el runbook de `ENVIRONMENTS.md` §6 ejecutado en orden, sin desviaciones.

- [ ] **L2.1 · Crear el proyecto Supabase de producción**
  Anotar `project_ref` y contraseña de base. Registrarlo en `ENVIRONMENTS.md` §2.
  *Hecho cuando:* el ref está en el documento y el proyecto responde.

- [ ] **L2.2 · Aplicar el historial completo**
  `supabase link --project-ref <ref-prod>` + `supabase db push --linked`.
  *Hecho cuando:* `supabase db lint --linked` dice *No schema errors found* y
  `npm run test:probes` pasa 17/17 contra el proyecto nuevo.

- [ ] **L2.3 · Cargar los secretos de las secciones 4.3 y 4.4 con valores nuevos**
  Claves VAPID propias, `EMAIL_PROCESSOR_SECRET` propio. **Ninguno reutilizado de desarrollo**
  (`ENVIRONMENTS.md:62`).
  *Hecho cuando:* ningún valor del juego de producción aparece en el de desarrollo.

- [ ] **L2.4 · Ajustar `email_dispatch_url` al ref de producción antes de habilitar el cron**
  `ENVIRONMENTS.md:127` lo llama «el error más fácil de cometer y el más caro de esta lista»: si
  se clona sin tocarlo, el cron de producción dispara contra las Edge Functions de desarrollo.
  *Hecho cuando:* `select value from private.runtime_secrets where key='email_dispatch_url'`
  contiene el ref de producción, comprobado **antes** de agendar el cron.

- [ ] **L2.5 · Desplegar las Edge Functions al proyecto de producción**
  Ver L4.3: debe salir de CI, no de la laptop.
  *Hecho cuando:* las funciones responden y `process-email-deliveries` devuelve 401 con secreto
  inválido y 200 con el bueno.

- [ ] **L2.6 · Configurar `site_url` y `additional_redirect_urls` del proyecto de producción**
  Con los dominios de ese entorno, nunca una lista global compartida (`ENVIRONMENTS.md:111`). Y
  con la guardia de coherencia de R7.2: todo origen habilitado para `/auth/confirm` debe estarlo
  para `/auth/reset-password`.
  *Hecho cuando:* `npm test` pasa (la guardia lee `config.toml`) y una recuperación real aterriza
  en `asidominicana.do/auth/reset-password`.

- [ ] **L2.7 · Verificación de punta a punta en producción**
  Login, solicitud de membresía, pago con tarjeta **real de prueba de AZUL**, correo recibido,
  notificación push.
  *Hecho cuando:* los cinco pasos dejan rastro observable y `/admin/correos` muestra el envío.

---

# L3 · Credenciales y secretos del corte

Tres frentes, dos de ellos con terceros en medio. **Los pedidos salen hoy aunque el proyecto de
producción no exista todavía**, porque el tiempo de respuesta no lo controlamos.

## Estado medido

| Hecho | Cómo se verificó |
|---|---|
| La `service_role` estuvo en claro en `audit_logs` desde marzo | TASK-260 / comentario maestro de TASK-255: `request_headers` guardaba 141 copias |
| Sigue sin rotar, por decisión del propietario del 2026-08-02 | `ENVIRONMENTS.md:157` — marcado ☐, «paso obligatorio del corte a producción» |
| AZUL corre con merchant de pruebas | `ENVIRONMENTS.md:22` y §4.5 |
| Resend: remitente productivo incorrecto y una sola API key administrativa | Comentario de CI de TASK-255, tres pendientes P1 · *no re-verificado hoy contra el panel de Resend* |
| `leaked password protection` no está declarado | `grep -rn "leaked" supabase/config.toml docs/` → sin resultados |

## Tareas

- [ ] **L3.1 · Pedir a AZUL las credenciales de producción** *(sale hoy · TASK-242)*
  Merchant real, `AZUL_AUTH_KEY` real, alta en `contpagos.azul.com.do`. `ENVIRONMENTS.md:141` lo
  llama «el punto de mayor riesgo de toda la lista»: cruzar credenciales aquí significa cobrar de
  verdad desde staging, o no cobrar en producción. Incluye enviarles el diseño pendiente de
  [TASK-242](https://linear.app/mooncode/issue/TASK-242).
  *Hecho cuando:* el correo salió y está anotada la fecha; se cierra cuando llegan las credenciales.

- [ ] **L3.2 · Rotar la `service_role` key** *(depende de L2.1)*
  Esa llave **bypassa RLS por completo**. Al rotarla hay que resincronizar `.env.local`, el
  microservicio AZUL y las Edge Functions, en ese orden y sin ventana de descoordinación.
  *Hecho cuando:* la llave vieja devuelve 401 y el cron de correo encadena 20 ejecuciones
  correctas después del cambio — el mismo criterio que se usó al rotar `email_processor_secret`
  en TASK-256.

- [ ] **L3.3 · Cablear AZUL de producción** *(depende de L3.1 y L2.1)*
  `AZUL_ENVIRONMENT=production`, merchant real, `AZUL_PAYMENT_URL=contpagos.azul.com.do`,
  `SERVICE_PUBLIC_URL` y `ALLOWED_ORIGIN`/`APP_URL` con el dominio de producción
  (`ENVIRONMENTS.md` §4.5).
  *Hecho cuando:* un cobro real de monto mínimo se liquida, activa la membresía y aparece en
  `reconcile`; y **el bundle de producción no menciona la URL de Railway de staging**.

- [ ] **L3.4 · Separar las API keys de Resend por entorno** *(sale hoy)*
  Hoy hay una sola key `asi-dev` que **puede administrar dominios, webhooks y keys**: no es
  *Sending access* limitado. Crear key exclusiva de producción acotada al dominio, key aparte para
  dev/staging, migrar secretos y **retirar la key administrativa del runtime**.
  *Hecho cuando:* la key del runtime falla al intentar listar dominios, y el envío sigue en verde.

- [ ] **L3.5 · Alinear el remitente productivo y definir `Reply-To`**
  Hoy el secreto usa `ASI Rep. Dominicana <noreply@asidominicana.do>` en vez del acordado
  `ASI Dominicana <notificaciones@asidominicana.do>`, y el payload no envía `reply_to`.
  *Hecho cuando:* ambos valores aparecen en un correo recibido de verdad, no en la configuración.

- [ ] **L3.6 · Completar la matriz de entregabilidad**
  Hoy solo están comprobados `email.sent` y `email.delivered` con un destinatario de prueba.
  Faltan Gmail, Outlook, apertura, clic y rebote, visibles en Resend **y** en `/admin/correos`.
  *Hecho cuando:* los cinco eventos aparecen en la cronología de `/admin/correos`, se observan
  24-48 horas y se revoca la key de la cuenta anterior.

- [ ] **L3.7 · Re-correr los advisors de Supabase** *([TASK-175](https://linear.app/mooncode/issue/TASK-175))*
  De abril, sin evidencia de re-corrida. Parte se resolvió de rebote en TASK-269/273, pero
  `function_search_path_mutable`, las FK sin índice y sobre todo **el toggle de protección de
  contraseñas filtradas** siguen sin confirmar.
  *Hecho cuando:* la corrida de advisors contra el proyecto de producción está pegada aquí, y la
  protección de contraseñas filtradas está activa.

---

# L4 · Despliegue: dos topologías y publicación a mano

## Estado medido

| Hecho | Cómo se verificó |
|---|---|
| `netlify.toml` y `public/.htaccess` conviven | `ls -la netlify.toml public/.htaccess` → ambos existen |
| Convivencia declarada temporal | `ENVIRONMENTS.md:163` — «vuelta atrás mientras se valida Hostinger… vuelve a quedar una sola topología en cuanto se retire uno de los dos» |
| Staging sí despliega por CI | `ci.yml:269` job `deploy-staging`, con 6 jobs de calidad como `needs` |
| Producción **no** tiene job equivalente | `grep` en `ci.yml`: solo existe `deploy-staging` |
| Edge Functions se despliegan desde la laptop | `ENVIRONMENTS.md:160`, marcado ☐ |
| No hay regla efectiva de cero cambios manuales en el dashboard | `ENVIRONMENTS.md:159`, marcado ☐ |

Dos orígenes sirviendo la misma SPA implica redirect URLs de Auth duplicadas, SEO duplicado y dos
sitios que pueden divergir de versión — que es exactamente lo que L1 encontró ocurriendo.

## Tareas

- [ ] **L4.1 · Job `deploy-production` con GitHub Environment protegido**
  Espejo de `deploy-staging` pero sobre `refs/heads/main`, con su propio juego de variables
  (`ENVIRONMENTS.md` §4.6) y aprobación manual.
  *Hecho cuando:* un push a `main` publica `asidominicana.do` sin que nadie toque FTP a mano.

- [ ] **L4.2 · Retirar una de las dos topologías**
  Con L4.1 en pie, Netlify deja de ser vuelta atrás. Retirar `netlify.toml` **o** `public/.htaccess`
  y actualizar `ENVIRONMENTS.md:163` y `docs/pasarelaDePagos/despliegue-azul.md`.
  *Hecho cuando:* solo queda un origen sirviendo la SPA y el documento lo dice.

- [ ] **L4.3 · Desplegar Edge Functions desde CI**
  *Hecho cuando:* `supabase functions deploy` no vuelve a correr desde una laptop y existe el job
  que lo hace, con el proyecto como parámetro del environment.

- [ ] **L4.4 · Hacer efectiva la regla de cero cambios manuales en el dashboard**
  El vigilante de drift ya existe (`db-drift.yml`); lo que falta es que su fallo **bloquee** en
  vez de informar.
  *Hecho cuando:* un cambio hecho a mano en el dashboard pone el job en rojo, comprobado
  provocándolo una vez.

- [ ] **L4.5 · Activar la limpieza remota del mirror FTP**
  El primer mirror quedó deliberadamente sin `--delete` (commit `baaef79` ya avanzó parte).
  Verificar en hPanel que `HOSTINGER_PATH=/` no puede salir de su document root aislado antes de
  activarla.
  *Hecho cuando:* el aislamiento está confirmado y el contrato de `DESPLIEGUE_HOSTINGER.md` lo
  refleja.

---

# L5 · La home pública está rota

## Estado medido

| Hecho | Cómo se verificó |
|---|---|
| `videos/demoApp.webm` → **400** | `curl -o /dev/null -w "%{http_code}" $URL/storage/v1/object/public/public-media/videos/demoApp.webm` |
| `videos/christian-event.webm` → **400** | ídem |
| Los dos siguen referenciados | `institutional-home-page.tsx:393-394`, vía `publicStorageUrl('public-media', …)` |
| El demo de plataforma degrada; la card de evento **no** | `LazyAutoplayVideo` en `institutional-home-page.tsx:1141` no tiene poster ni fallback |

Es preexistente y salió del cierre de TASK-272: el bucket tiene 0 objetos. La card «Evento
destacado» se ve **vacía** para todo visitante.

## Tareas

- [ ] **L5.1 · Subir los dos videos a `public-media`**
  El tope de 50 MiB ya está alineado (`324087e`), así que el bucket puede recibirlos.
  *Hecho cuando:* las dos URLs devuelven 200 y la home muestra ambos videos.

- [ ] **L5.2 · Dar poster y fallback a `LazyAutoplayVideo`**
  Independiente de L5.1 y es lo que impide que vuelva a pasar: un video que no carga no puede
  dejar un hueco.
  *Hecho cuando:* con la URL rota a propósito, la card muestra imagen en vez de vacío.

---

# L6 · Producto sin cerrar

## Estado medido — recordatorios de renovación

| Hecho | Cómo se verificó |
|---|---|
| Hay 4 crons en migraciones | `grep -rn "cron.schedule" supabase/migrations` → despacho de correo, purga de `audit_logs`, de access logs y de `app_error_logs` |
| **Ninguno es de renovación** | ídem — no hay ninguna entrada de recordatorio |
| La métrica sí existe | `20260729160000_platform_ops_snapshot_membership_metrics.sql:9` — `membershipsExpiringSoon` |

O sea: el sistema **sabe** quién está por vencer y no le escribe a nadie. Es la única fase del
pipeline de membresía sin construir, y sin ella las membresías vencen en silencio.

## Tareas

- [ ] **L6.1 · Recordatorios de renovación de membresía**
  Plantilla + `notification_type` + cron que use `membershipsExpiringSoon`. Ventanas sugeridas:
  30, 7 y 1 día antes, y una tras el vencimiento. Debe pasar por el mismo `claim_email_deliveries`
  que el resto (idempotencia y lease ya resueltos en TASK-266), y **respetar `is_test`**.
  *Hecho cuando:* un usuario sintético con vencimiento a 7 días recibe exactamente un correo, y
  correrlo dos veces no manda dos.

- [ ] **L6.2 · Cerrar las seis decisiones de producto abiertas**
  Ninguna es trabajo de código todavía: son respuestas que hacen falta antes de estimar nada.
  Cada una se cierra escribiendo la decisión en "Decisiones tomadas".

  | Issue | Decisión que falta |
  |---|---|
  | [TASK-173](https://linear.app/mooncode/issue/TASK-173) / [TASK-174](https://linear.app/mooncode/issue/TASK-174) | ¿El MVP sale **sin** workflow pastoral del expediente ni endorsements territoriales por scope? Es el corazón del modelo de aprobación de ASI y están en Backlog. |
  | [TASK-244](https://linear.app/mooncode/issue/TASK-244) | ¿«Aplicar ahora» y «aplicar con tu perfil» son dos flujos o uno? Sin definir. |
  | [TASK-5](https://linear.app/mooncode/issue/TASK-5) | ¿Puede un usuario pertenecer a dos empresas? No hay switcher en `src/` (`grep setActiveTenant\|TenantSwitcher` → sin resultados) y `activeTenantId` se usa en 23 sitios. Si la respuesta es sí, es bug de día 1; si es no, se cancela. |
  | [TASK-160](https://linear.app/mooncode/issue/TASK-160) | ¿El formulario de membresía coincide con los documentos fuente de ASI? |
  | [TASK-163](https://linear.app/mooncode/issue/TASK-163) / [TASK-165](https://linear.app/mooncode/issue/TASK-165) | ¿Admin Console entra en el MVP o después? |

- [ ] **L6.3 · Re-verificar dos bugs viejos que probablemente ya no existen**
  [TASK-13](https://linear.app/mooncode/issue/TASK-13) (callback de confirmación móvil colgado) y
  [TASK-106](https://linear.app/mooncode/issue/TASK-106) (carrusel en Safari iOS). Son de la clase
  que solo aparece con usuarios reales, así que confirmarlos vale más que su coste.
  *Hecho cuando:* ambos reproducidos o cerrados con la evidencia de por qué ya no aplican.

- [ ] **L6.4 · Cerrar las cinco QA visuales pendientes**
  Todas quedaron abiertas por falta de navegador conectado, no por defecto conocido:
  índice de documentos legales en desktop (`/privacy`) · `/admin/membership` y
  `/admin/access-control` en móvil y desktop · `/account/recruiter-request` con y sin historial ·
  la pantalla de recuperación por versión desactualizada.
  *Hecho cuando:* las cinco están marcadas con el commit correspondiente en el comentario de
  frontend de TASK-255.

- [ ] **L6.5 · Filtros por evento real en `/admin/correos`**
  La cronología y las etiquetas existen, pero el filtro solo opera sobre estados agregados
  (`pending`, `sent`, `failed`, `read`, `clicked`). Faltan rebotes, quejas, retrasos, aperturas y
  clics como filtros explícitos.
  *Hecho cuando:* se puede filtrar por rebote y el frontend está publicado.

---

# L7 · Rendimiento: los 5 P1 siguen intactos

Los cinco están en `Duplicate` en Linear, así que **no aparecen en ninguna vista**. Re-verificados
en código el 2026-08-10: ninguno tiene trabajo empezado.

## Estado medido

| Issue | Qué sigue igual | Cómo se verificó |
|---|---|---|
| [TASK-274](https://linear.app/mooncode/issue/TASK-274) | Un `rpc('has_platform_permission')` **por permiso**, más `is_platform_admin` e `is_platform_owner` sueltos. No existe `get_session_snapshot`. | `auth-api.ts:394`; `grep -rn "get_session_snapshot" src supabase/migrations` → sin resultados |
| [TASK-275](https://linear.app/mooncode/issue/TASK-275) | Trae stages + **todas** las applications con sus nested selects, sin keyset por etapa | `pipeline-api.ts:12-32` |
| [TASK-276](https://linear.app/mooncode/issue/TASK-276) | `Promise.all([fetchPipelineBoard, listTenantJobs])` y **todo el agregado en el cliente** | `dashboard-api.ts:117-138` |
| [TASK-277](https://linear.app/mooncode/issue/TASK-277) | `listTenantJobs` sin paginación; contadores derivados en cliente | `jobs-api.ts:192` |
| [TASK-278](https://linear.app/mooncode/issue/TASK-278) | 203 chunks, 57-86 requests en frío | del informe original · **no re-medido hoy** (exige build) |

Y el épico [TASK-14](https://linear.app/mooncode/issue/TASK-14) con sus 9 subtareas
(TASK-15 a 24, más TASK-239) está **entero en `Todo`**: baseline de CWV, code splitting, hero,
fuentes, caché/SW, animaciones, imágenes responsivas, Lighthouse en CI. Es la superficie pública,
lo primero que ve un visitante.

## Tareas

- [ ] **L7.1 · TASK-276 y TASK-277 juntos**
  Son el mismo arreglo visto dos veces: el dashboard baja el pipeline entero **porque**
  `listTenantJobs` y `fetchPipelineBoard` no saben agregar. Existe el patrón de TASK-267/268 para
  copiar (keyset + agregado en RPC + índices).
  *Hecho cuando:* el dashboard no descarga ninguna postulación para calcular sus métricas, y la
  exactitud está comprobada contra el cálculo viejo sobre los mismos datos.

- [ ] **L7.2 · TASK-274 — snapshot de sesión**
  Un `get_session_snapshot` con contrato estable en vez de N llamadas por permiso.
  *Hecho cuando:* el arranque autenticado hace un número fijo de consultas, medido antes y después.

- [ ] **L7.3 · TASK-275 — paginar el pipeline por etapa**
  Keyset por etapa y detalle bajo demanda.
  *Hecho cuando:* abrir el tablero no depende del número total de postulaciones del tenant.

- [ ] **L7.4 · TASK-278 — reducir chunks y requests fríos**
  *Hecho cuando:* hay budgets verificables en CI para chunks, requests, gzip y carga fría — que es
  además [TASK-24](https://linear.app/mooncode/issue/TASK-24).

- [ ] **L7.5 · Decidir el alcance del épico TASK-14 para el día 1**
  Nueve subtareas es más de lo que cabe antes del corte. Escoger las que afectan a la primera
  impresión (hero, code splitting, imágenes) y mover el resto explícitamente a después.
  *Hecho cuando:* la selección está escrita aquí y las descartadas quedan en `Backlog` con nota.

---

# L8 · Higiene barata

Nada de esto bloquea, y todo es deuda con coste de arreglo mucho menor que su coste de convivencia.

## Estado medido

| Hallazgo | Cómo se verificó |
|---|---|
| `countries-states-cities` sigue instalado (~35 MB) y solo aparece en comentarios | `package.json:54` + `grep -rn` en `src/` |
| `engines` permite Node ≥22, sin `packageManager` ni `.nvmrc` | `package.json:7-9`; `ls .nvmrc` → no existe |
| `requireSupabase` duplicado en 18 archivos | `grep -rl "requireSupabase" src \| wc -l` → 18 |
| 5 componentes por encima de 1.700 líneas | formulario de membresía 2.745, perfil candidato 2.087, home 1.860, employer shell 1.736, jobs overview 1.716 |
| `anon` conserva `GRANT ALL` sobre `storage.objects` y `storage.buckets` | Derivado abierto del cierre de TASK-272 · *no re-verificado hoy contra el remoto* |
| La búsqueda del access log quedó en −11 % | Cierre de TASK-270: `ilike '%…%'` sin índice |

## Tareas

- [ ] **L8.1 · Eliminar `countries-states-cities`** — el más barato de la lista.
  *Hecho cuando:* `npm run verify` en verde sin la dependencia.
- [ ] **L8.2 · Fijar Node y builds deterministas** — major fijo, `packageManager`, `.nvmrc`, y
  `npm ci` en el Dockerfile de AZUL.
  *Hecho cuando:* raíz y servicio construyen con la misma versión declarada.
- [ ] **L8.3 · Centralizar `requireSupabase`** en un helper compartido tipado.
  *Hecho cuando:* queda una sola definición y un test lo vigila.
- [ ] **L8.4 · Índices trigram para la búsqueda del access log** — `pg_trgm` ya está instalado y el
  criterio se fijó en TASK-268. Columnas: email, nombre e IP.
  *Hecho cuando:* la búsqueda mejora sobre los 50.000 accesos sintéticos de
  `p1_access_log_page_probe`.
- [ ] **L8.5 · Extender la Fase C al esquema `storage`** — revocar el `GRANT ALL` de `anon` sobre
  `storage.objects` y `storage.buckets`. **Requiere plan de verificación propio**: subida y borrado
  reales de avatar, logo de empresa, CV y recibo de membresía **después** de revocar, porque
  `storage-api` conmuta de rol para evaluar RLS.
  *Hecho cuando:* las cuatro operaciones siguen funcionando y la probe lo vigila.
- [ ] **L8.6 · Dividir los componentes monolíticos** — extraer secciones, hooks y servicios por
  dominio, sin cambiar UX. Empezar por el formulario de membresía.
  *Hecho cuando:* ninguno supera las 1.000 líneas y las pruebas siguen verdes.

---

# L9 · Linear no refleja la realidad

**24 issues del proyecto viven en estado `Duplicate`** y por tanto no aparecen en ninguna vista.
Entre ellos están los 5 P1 de rendimiento que siguen abiertos: hoy son invisibles.

## Estado medido

| Hecho | Cómo se verificó |
|---|---|
| 24 issues de *Desarrollo ASI* en `Duplicate` | `list_issues project="Desarrollo ASI" state="Duplicate"` |
| 18 de los 23 hijos de TASK-255 están cerrados de verdad | Comentario maestro (17/18 de seguridad) + TASK-271 verificado hoy |
| 5 siguen vivos | TASK-274 a 278, re-verificados en código (ver [L7](#l7--rendimiento-los-5-p1-siguen-intactos)) |
| `PLATFORM_REGISTRATION_LOCKED = false` | El registro está abierto por decisión de producto |

## Tareas

- [ ] **L9.1 · Sacar TASK-274 a 278 de `Duplicate` a `Todo`**
  Son los únicos 5 vivos de ese grupo y hoy nadie los ve.
- [ ] **L9.2 · Pasar a `Done` los 18 cerrados** — TASK-256 a 270, 272, 273 y 271.
- [ ] **L9.3 · Cancelar [TASK-179](https://linear.app/mooncode/issue/TASK-179)**
  «Verificar cierre live de registros públicos» es obsoleto: el registro está abierto a propósito.
- [ ] **L9.4 · Cerrar los absorbidos** — [TASK-7](https://linear.app/mooncode/issue/TASK-7) por
  TASK-259, [TASK-8](https://linear.app/mooncode/issue/TASK-8) por TASK-261,
  [TASK-9](https://linear.app/mooncode/issue/TASK-9) por las Fases A-D,
  [TASK-164](https://linear.app/mooncode/issue/TASK-164) por el arnés implementado,
  [TASK-251](https://linear.app/mooncode/issue/TASK-251) y
  [TASK-271](https://linear.app/mooncode/issue/TASK-271) por lo verificado hoy.
- [ ] **L9.5 · Triar [TASK-166](https://linear.app/mooncode/issue/TASK-166)**
  «Resolver decisiones pendientes de producto» está en `Duplicate` y es en realidad el contenedor
  de [L6.2](#l6--producto-sin-cerrar). O se reabre apuntando aquí, o se cancela.
- [ ] **L9.6 · Enlazar este documento desde TASK-255**
  Un comentario que diga que el seguimiento del corte vive aquí, para que no se bifurque.

*Hecho cuando:* abrir el proyecto en Linear sin filtros muestra exactamente el trabajo que queda.

---

## Decisiones tomadas

| Fecha | Decisión | Por qué |
|---|---|---|
| 2026-08-10 | El seguimiento del corte vive en este documento, no en issues nuevos de Linear | `REGRESSION_RULES.md` R-133: el plan gratuito rechaza issues nuevos, y partir el seguimiento entre dos sitios garantiza que uno de los dos mienta. |
| 2026-08-10 | Numeración canónica L1…L9 por **bloque**, con el `TASK-###` como identidad cuando existe | Los bloques agrupan por *quién te hace esperar*, que es lo que decide el orden. El `TASK-###` se conserva para no tener que traducir al cruzar con Linear. |
| 2026-08-10 | L2 (crear el proyecto de producción) va antes que rotar la `service_role` | Rotar la llave del proyecto de desarrollo no protege producción y obliga a resincronizar `.env.local`, AZUL y las Edge Functions **dos veces**. |
| 2026-08-10 | Los pedidos a terceros (AZUL, Resend) salen antes que el trabajo técnico del corte | Su tiempo de respuesta no lo controlamos, y son los dos únicos elementos de la lista que pueden bloquear una fecha por completo. |
| 2026-08-10 | Las cuatro cosas que auditorías anteriores daban por pendientes se declaran cerradas con evidencia en código, no con memoria | TASK-251, TASK-271, el 402 de vector buckets y staging. Un checklist que arrastra ítems ya hechos se vuelve ruido y se deja de leer. |

---

## Bitácora

| Fecha | Qué se hizo | Commit |
|---|---|---|
| 2026-08-10 | Auditoría de lanzamiento: Linear completo contra repo, remoto y dominios en vivo. Hallazgo principal: `asidominicana.do` sirve la base de desarrollo. Cuatro pendientes anteriores verificados como cerrados | — |
