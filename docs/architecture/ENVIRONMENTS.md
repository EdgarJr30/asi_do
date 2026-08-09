# ENVIRONMENTS.md — Entornos, promoción y salida a producción

Cómo se separan desarrollo, staging y producción, y qué hay que cambiar el día que se active staging.

Este documento está escrito **antes** de que exista staging, a propósito: su objetivo es que el día de la activación no haya que descubrir nada, solo ejecutar el runbook de la sección 6.

## 1. Estado actual (2026-08-02)

**Hay un solo proyecto Supabase.** Hace de entorno de desarrollo y, a la vez, es el que sirve el sitio publicado en Netlify. No existe staging.

Es una decisión consciente mientras el producto está en desarrollo: montar staging ahora añade fricción sin proteger nada, porque todavía no hay usuarios reales que puedan verse afectados por un error. **Deja de ser válida en cuanto entre el primer usuario real o el primer pago real.**

Consecuencias que hay que tener presentes mientras dure:

- Cada migración se estrena directamente contra el único entorno que existe. La red de seguridad son las probes de `supabase/tests/`, que revierten siempre la transacción.
- AZUL corre con el **merchant de pruebas** (`39038540035`, `AZUL_ENVIRONMENT=test`). No se procesan cobros reales.
- El arnés de estrés es *fail-closed* fuera de no-producción (`STRESS_HARNESS_ENABLED`, `HARNESS_ENV`), y así debe seguir.

## 2. Topología objetivo

| Entorno | Supabase | Frontend | AZUL | Datos |
|---|---|---|---|---|
| **Development** | proyecto `dev` (el actual) | local (`npm run dev`) | merchant de pruebas | sintéticos, desechables |
| **Staging** | proyecto `staging` | Netlify branch deploy | merchant de pruebas | sintéticos o anonimizados |
| **Production** | proyecto `prod` | Netlify production | **merchant real** | reales |

Tres proyectos Supabase distintos. La alternativa de pago es Supabase Branching (ramas efímeras integradas con Git), que evita mantener un proyecto staging permanente; si se contrata, sustituye a la fila de staging sin cambiar el resto del documento.

## 3. Flujo de promoción

```
   escribir migración + código
              │
              ▼
   commit + push a una rama ──────► CI: verify + replay de migraciones
              │
              ▼
        merge a main ─────────────► deploy automático a STAGING
              │                     (frontend + migraciones + Edge Functions)
              ▼
     verificación en staging
     (probes, smoke E2E, QA manual)
              │
              ▼
        tag de release ───────────► deploy a PRODUCCIÓN
```

Reglas que sostienen el flujo:

1. **Las migraciones fluyen en una sola dirección:** dev → staging → producción. Nunca al revés, y nunca saltándose staging.
2. **Producción no recibe `db push` desde una laptop.** Sale de CI, con el mismo commit que ya pasó por staging. Hoy se hace desde la laptop porque no hay a dónde promover; eso termina con la activación de staging.
3. **El artefacto que se promueve es un commit**, no un archivo suelto ni un cambio hecho a mano en el dashboard.
4. **Staging no lleva datos de producción con PII.** Si hace falta volumen realista, se genera con el arnés (`npm run harness:seed`) o se anonimiza antes de cargar.
5. **Los secretos no se comparten entre entornos.** Cada proyecto tiene su propio juego completo. Un secreto que sirve en dos entornos convierte un incidente de staging en un incidente de producción.

## 4. Inventario de conmutación

Todo lo que es específico de entorno. Esta es la lista que hay que recorrer al crear staging y de nuevo al crear producción.

### 4.1 Proyecto Supabase

| Elemento | Dónde vive | Nota |
|---|---|---|
| `project_id` | `supabase/config.toml` | Uno por entorno |
| `site_url`, `additional_redirect_urls` | `supabase/config.toml` (`[auth]`) | Deben apuntar al dominio del entorno o el login rebota |
| Llave publicable (`sb_publishable_…`) | Netlify, `.env.local`, AZUL, Edge Functions | Pública por diseño |
| Llave secreta (`sb_secret_…`) | Solo servidor: AZUL y Edge Functions | Omite RLS. Nunca en el browser |

> Las llaves migraron al formato `sb_publishable_` / `sb_secret_` el 2026-08-02; las JWT `anon` / `service_role` quedaron retiradas.

#### Correo de Auth por entorno

Cada proyecto posee su propia base de usuarios, configuración Auth y SMTP. Las plantillas HTML sí son el
mismo artefacto versionado: usan `SiteURL`, `ConfirmationURL`, `Data` y `Email`, variables que Supabase
resuelve dentro del proyecto que genera el correo. Así, un registro de desarrollo no puede construir el
logo, el acceso ni la confirmación con el dominio de producción.

`scripts/sync-auth-email-template.ts` promociona `Confirm sign up` mediante la Management API. Antes de
escribir, compara el `project_ref` y el `site_url` remoto con los valores esperados y conoce explícitamente
la identidad de producción; rechaza tanto producción apuntando a otro proyecto como desarrollo apuntando a
producción. El comando y sus variables están documentados en `supabase/README.md`.

En CI, desarrollo y producción deben ser environments protegidos distintos, cada uno con su
`SUPABASE_PROJECT_REF`, `EXPECTED_AUTH_SITE_URL` y token. `PRODUCTION_SUPABASE_PROJECT_REF` y
`PRODUCTION_AUTH_SITE_URL` actúan como límite común, no como destino implícito.

**Llamando a las APIs a mano (`curl`, `fetch`):** la API de **Storage** rechaza las llaves nuevas si solo van en `Authorization: Bearer` — responde `403 {"message":"Invalid Compact JWS"}` porque intenta parsearlas como JWT. Hay que mandar **además** el header `apikey`. PostgREST se conforma con cualquiera de los dos, así que el fallo aparece solo al tocar Storage y el mensaje no apunta a la causa.

```bash
curl -X DELETE "$URL/storage/v1/object/avatars" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"prefixes":["<ruta>"]}'
```

Esto **no afecta al código del proyecto**: `supabase-js` pone los dos headers solo con `createClient(url, key)`, así que `scripts/media-orphans.ts` y las Edge Functions no necesitan nada especial. Es una trampa exclusiva de las llamadas crudas desde la terminal.

### 4.2 Frontend (build de Vite / Netlify)

`VITE_DEPLOY_ENV` · `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `VITE_AUTH_SITE_URL` · `VITE_PRODUCTION_SITE_URL` · `VITE_AZUL_PAYMENTS_URL` · `VITE_WEB_PUSH_PUBLIC_KEY`

Los archivos versionados solo declaran la clase del entorno: `.env.development`, `.env.staging` y `.env.production`. No contienen endpoints. En desarrollo, Auth siempre deriva el origen de `window.location.origin`, aunque una URL pública haya quedado por accidente en `.env.local`. Staging y producción reciben `VITE_AUTH_SITE_URL` y `VITE_PRODUCTION_SITE_URL` desde el proveedor de despliegue; el build falla si falta una, si usa HTTP/localhost, si producción no coincide con su origen canónico o si staging intenta usarlo.

Staging se empaqueta con `npm run build:staging`; producción con `npm run build`. Para cada proyecto Supabase, `site_url` y la lista de redirects deben configurarse con los dominios de ese mismo entorno. El `supabase/config.toml` versionado incluye además callbacks locales exactos para el stack de desarrollo; nunca se debe usar una lista global indiscriminada entre proyectos.

> En el build para **Hostinger** no hay panel: `vite build` corre en local y hornea en el bundle los `VITE_*` del `.env.local` de esa máquina. Revísalos antes de cada release (ver `DESPLIEGUE_HOSTINGER.md` §5).

### 4.3 Edge Functions (secretos del proyecto Supabase)

`ASI_SUPABASE_PUBLISHABLE_KEY` · `ASI_SUPABASE_SECRET_KEY` · `APP_URL` · `EMAIL_FROM_ADDRESS_DEV` · `RESEND_API_KEY_DEV` · `RESEND_WEBHOOK_SECRET_DEV` · `EMAIL_PROCESSOR_SECRET` · `WEB_PUSH_VAPID_PUBLIC_KEY` · `WEB_PUSH_VAPID_PRIVATE_KEY` · `WEB_PUSH_CONTACT_EMAIL` · `STRESS_HARNESS_ENABLED` · `HARNESS_ENV` · `HARNESS_PRODUCTION_TARGETS`

`RESEND_WEBHOOK_SECRET_DEV` es exclusivo de cada endpoint/entorno. La Edge Function `resend-webhook` valida el cuerpo crudo y los headers `svix-*`; nunca debe reutilizarse como llave de envío ni exponerse al frontend. El procesador y el webhook usan exclusivamente los tres nombres `_DEV` en todos los entornos; no se mantienen alias antiguos sin sufijo.

**Las claves VAPID deben ser distintas por entorno.** Compartirlas hace que una suscripción push de staging reciba notificaciones de producción.

### 4.4 `private.runtime_secrets` (dentro de la base)

`email_dispatch_url` · `email_dispatch_anon_key` · `email_processor_secret`

`email_dispatch_url` contiene el **ref del proyecto** en la URL de la Edge Function. Si se clona un entorno sin actualizarla, el cron de correo de staging dispara contra las funciones de producción. Es el error más fácil de cometer y el más caro de esta lista.

### 4.5 Microservicio AZUL (`services/azul-payments`)

| Variable | Staging | Producción |
|---|---|---|
| `AZUL_ENVIRONMENT` | `test` | `production` |
| `AZUL_MERCHANT_ID` | `39038540035` (pruebas) | **el de la afiliación real** |
| `AZUL_MERCHANT_NAME` | `Prueba AZUL` | el que entregue AZUL |
| `AZUL_AUTH_KEY` | de pruebas | **el real** |
| `AZUL_PAYMENT_URL` | `pruebas.azul.com.do` | `contpagos.azul.com.do` |
| `SERVICE_PUBLIC_URL` | dominio del servicio en staging | dominio en producción |
| `ALLOWED_ORIGIN` / `APP_URL` | dominio de staging | dominio de producción |

Cruzar credenciales aquí significa cobrar de verdad desde staging, o no cobrar en producción. Es el punto de mayor riesgo de toda la lista.

### 4.6 Netlify

Un sitio o dos contextos de build: `main` → staging, tag/rama de release → producción. Cada contexto con su propio juego de variables.

## 5. Qué dejar preparado ahora

Para que la activación de staging sea "cambiar entornos y ya", esto conviene resolverlo antes, no el día del corte:

- [x] **Contrato de URLs por entorno** sin endpoints versionados: origen vivo en desarrollo, variables inyectadas en staging/producción y validación cruzada en CI.
- [x] **Replay de migraciones en CI** (`.github/workflows/db-migrations.yml`): garantiza que un proyecto nuevo se puede construir desde cero. Sin esto, crear staging es una apuesta.
- [x] **Vigilancia de drift** (`.github/workflows/db-drift.yml`): detecta cambios hechos fuera de migraciones, que son justamente los que no se propagan a un entorno nuevo.
- [ ] **Rotar la `service_role` key antes del corte a producción.** Estuvo escrita en claro en `audit_logs` desde marzo hasta el saneamiento de TASK-260, legible por cualquier portador de `audit_log:read`. El saneamiento la quitó de la base pero **no invalida la llave**, y esa llave **bypassa RLS por completo**. Decisión del propietario (2026-08-02): **no se rota ahora**, porque el acceso a `audit_log:read` estuvo limitado a personas de confianza y no hay indicio de filtración. Queda como paso obligatorio del corte a producción, no como remediación pendiente. Al rotarla hay que resincronizar `.env.local`, el microservicio AZUL y las Edge Functions.

- [ ] **Cero cambios manuales desde el dashboard de Supabase.** Todo por migración. Un `GRANT` o una policy hecha a mano no viaja a staging.
- [ ] **Despliegue de Edge Functions por CI**, no `supabase functions deploy` desde la laptop.
- [x] **Unificar la topología documentada.** ✅ 2026-08-04. Resuelto: no era una decisión pendiente sino texto obsoleto en un solo documento. **No existe ni un archivo de configuración de Hostinger en el repositorio**, mientras que `netlify.toml`, `railway.json` y el `Dockerfile` del microservicio sí están, y tres documentos ya decían Netlify. La topología única —SPA en Netlify, `services/azul-payments` en Railway, plataforma en Supabase— queda declarada en `docs/pasarelaDePagos/despliegue-azul.md`, que es el runbook que manda.

  **Reabierto el 2026-08-07:** ahora sí hay configuración de Hostinger en el repo (`public/.htaccess`) y el dominio propio `asidominicana.do` está configurado en Supabase. Desde 2026-08-09 el frontend ya no lo conserva en `.env.production`: el entorno de despliegue lo inyecta y el build valida su correspondencia. La SPA se sirve desde **dos** sitios a propósito y de forma temporal: Netlify como vuelta atrás mientras se valida Hostinger. Runbook: `docs/architecture/DESPLIEGUE_HOSTINGER.md`. Vuelve a quedar una sola topología en cuanto se retire uno de los dos.

## 6. Runbook: activar staging

Cuando llegue el momento, en orden:

1. **Crear el proyecto Supabase de staging.** Anotar su `project_ref` y su contraseña de base de datos.
2. **Aplicar el historial completo:**
   ```bash
   supabase link --project-ref <ref-staging>
   supabase db push --linked
   ```
   Si el job de replay está verde, esto reconstruye el esquema entero sin sorpresas.
3. **Cargar los secretos** de las secciones 4.3 y 4.4 con valores **nuevos** de staging. Generar claves VAPID propias y un `EMAIL_PROCESSOR_SECRET` propio.
4. **Ajustar `email_dispatch_url`** al ref de staging. Verificar que apunta al proyecto correcto antes de habilitar el cron de correo.
5. **Desplegar las Edge Functions** al proyecto de staging.
6. **Desplegar el microservicio AZUL** de staging, con credenciales de prueba, y apuntar `VITE_AZUL_PAYMENTS_URL` ahí.
7. **Configurar el contexto de Netlify** para staging con su juego de variables.
8. **Sembrar datos** con `npm run harness:seed`. Nunca copiar producción con PII.
9. **Verificar de punta a punta:** login, solicitud de membresía, pago con tarjeta de prueba, envío de correo, notificación push.
10. **Promover el flujo de trabajo:** a partir de aquí, producción solo recibe cambios que ya pasaron por staging.

Al crear producción se recorre la misma lista, con dos diferencias: credenciales reales de AZUL y `STRESS_HARNESS_ENABLED` desactivado.

## 7. Lo que no cambia entre entornos

- Commitear **antes** de `supabase db push` (ver `supabase/README.md`).
- Las migraciones aplicadas son inmutables; se corrige añadiendo otra encima.
- Toda RPC nueva que llame el cliente necesita su `grant execute … to authenticated` explícito.
- Toda migración sensible lleva su probe en `supabase/tests/`.
