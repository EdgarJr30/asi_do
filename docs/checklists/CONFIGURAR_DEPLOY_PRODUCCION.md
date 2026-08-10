# Configurar el deploy de producción

Guía única y autosuficiente: de arriba a abajo, sin abrir otro documento.
Cada nombre de variable de aquí está verificado contra el código, no contra la documentación.

**El código ya está.** `ci.yml` tiene `deploy-production` y `deploy-edge-functions`. Lo que falta es
todo lo que sigue.

## Cómo quedará el flujo

```
PR staging → main
      │  CI corre 6 jobs (verify · azul-service · mutation · edge-functions · e2e-smoke · audit)
      ▼
   merge a main
      │  el environment `production` pide tu aprobación
      ▼
   deploy-production        deploy-edge-functions   (en paralelo)
   build + FTP Hostinger    supabase functions deploy
      │
      ▼
   smoke automático contra asidominicana.do
```

⚠️ **Las migraciones NO viajan en ese flujo.** Se aplican a mano con `supabase db push --linked`
**antes** de mergear a `main`. No hay job que las aplique.

## Mapa: dónde vive cada cosa

Cinco sitios distintos. Meter una variable en el sitio equivocado es el error más común de esta lista.

| Sitio | Qué vive ahí | Paso |
|---|---|---|
| **GitHub** → environment `production` | los `VITE_*` (públicos, van dentro del bundle), `SUPABASE_PROJECT_REF` y las credenciales FTP | 9 |
| **Supabase** → Edge Functions → Secrets | llaves de servidor: Resend, VAPID privada, llave secreta de Supabase | 3 |
| **Supabase** → la base, tabla `private.runtime_secrets` | lo que necesitan los cron de Postgres para llamar a las Edge Functions | 4 |
| **Railway** → servicio AZUL de producción | credenciales del merchant real | 7 |
| **El repositorio** (`.env.production`) | solo `VITE_DEPLOY_ENV=production`. **Nada más. Nunca endpoints ni llaves** | — |

**La regla:** si el navegador la necesita, es `VITE_*` y va en GitHub como *variable* (cualquiera puede
leerla en el JS publicado). Si es una llave que omite RLS o que cobra dinero, nunca sale del servidor.

## Antes de empezar

Necesitas a mano:

- [ ] Permiso de admin en `github.com/EdgarJr30/asi_do`
- [ ] Acceso al panel de Supabase (para crear un proyecto nuevo)
- [ ] **Credenciales reales de AZUL** — merchant ID, merchant name y `AZUL_AUTH_KEY` de la afiliación
- [ ] Acceso al panel de Resend y al DNS de `asidominicana.do`
- [ ] Acceso a hPanel de Hostinger
- [ ] CLI al día: `supabase --version` ≥ 2.111.0 y Node 22

---

# Paso 0 · Declarar el token y el ref en `staging`

`deploy-edge-functions` corre **también desde `staging`** y necesita `SUPABASE_ACCESS_TOKEN` y
`SUPABASE_PROJECT_REF`. El environment `staging` solo tiene variables de build del frontend.

**Esto no lo rompe: lo que un environment no declara, lo hereda del repositorio** — y el repositorio ya
tiene esas dos por `db-drift.yml`, apuntando al proyecto de desarrollo, que resulta ser el destino
correcto para `staging`. Funciona por casualidad, no por diseño.

**El peligro es el inverso, en el Paso 9:** si el environment `production` no declara
`SUPABASE_PROJECT_REF`, hereda ese mismo valor de desarrollo, el job pasa en verde y publica las
funciones de producción **en la base de desarrollo**. Es el fallo que deja al cron de producción
disparando contra las funciones equivocadas.

Desde `f74ce19` el job comprueba el **valor**, no solo que exista: `main` con un ref de desarrollo
—o `staging` con el de producción— falla nombrando el problema.

https://github.com/EdgarJr30/asi_do/settings/environments → **`staging`**

| Tipo | Nombre | Valor |
|---|---|---|
| secret | `SUPABASE_ACCESS_TOKEN` | token personal del CLI ([crearlo aquí](https://supabase.com/dashboard/account/tokens)) |
| var | `SUPABASE_PROJECT_REF` | `jgmojkzthfogynqixkob` (el proyecto de desarrollo) |

- [ ] Declaradas explícitamente en el environment, para que dejen de depender de la herencia.

---

# Paso 1 · Crear el proyecto Supabase de producción

1. [ ] supabase.com → **New project**. Región cercana a RD (`us-east-1`).
2. [ ] Guarda la **contraseña de la base** en tu gestor. No se puede volver a ver.
3. [ ] Copia el **`project_ref`** (lo ves en la URL del dashboard y en Settings → General).
       A partir de aquí lo llamo `<REF-PROD>`.
4. [ ] Anótalo en `docs/architecture/ENVIRONMENTS.md` §2 y commitéalo.

> El plan gratuito no admite Vector Buckets; el repo ya lo declara desactivado, así que no estorba.

---

# Paso 2 · Levantar la arquitectura de la base

**No se copia nada desde desarrollo.** Producción se construye desde cero reproduciendo las 116
migraciones del repositorio. Es la misma secuencia con la que se construyó desarrollo, así que el
resultado es idéntico por construcción, no por copia.

```bash
supabase link --project-ref <REF-PROD>    # ⚠️ esto te desenlaza de desarrollo
supabase db push --linked                 # aplica las 116 en orden
```

🔴 **`link` es global y persistente.** Mientras estés enlazado a producción, cualquier `db push`,
`db query` o `db diff` que corras —incluido el de otra tarea— va contra producción. Al terminar:

```bash
supabase link --project-ref jgmojkzthfogynqixkob    # de vuelta a desarrollo
```

### Qué viaja en el `db push` y qué no

Verificado el 2026-08-10 con `supabase db diff --linked` contra desarrollo: los esquemas `private`,
`storage` y `auth` no tienen ni una diferencia, y `public` solo difiere en dónde queda instalada
`pg_net` (artefacto del stack local, no una migración que falte). **El repositorio reproduce la
arquitectura completa.**

| Viaja solo ✅ | Hay que hacerlo a mano ❌ |
|---|---|
| Tablas, RLS, funciones, triggers, grants | Filas de `private.runtime_secrets` (Paso 4) |
| Extensiones: `pg_net`, `pg_cron`, `pg_trgm`, `pgcrypto` | Configuración de Auth: URLs, plantillas, protección de contraseñas (Paso 5) |
| Los 6 buckets de Storage (vacíos) | Su contenido: videos, logos, avatares (Paso 14) |
| Las 18 tablas de la publicación Realtime | Secretos de Edge Functions (Paso 3) |
| Los 6 cron de Postgres | El primer administrador (Paso 13) |
| Roles, permisos y las 3 categorías de membresía con sus precios | Tope global de subida de Storage (está en `config.toml`, que es de desarrollo) |

### Verificación

```bash
supabase db lint --linked     # sin errores
npm run test:probes           # 22/22
supabase db diff --linked --schema public,private,storage,auth   # debe salir vacío
```

El tercero es el que importa: si sale algo, producción tiene objetos que ninguna migración explica y
acabas de nacer con drift. (Necesita colima: `colima start` y
`export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock`.)

- [ ] Las tres verificaciones limpias.

**El push arranca seis cron de inmediato:** `dispatch-membership-emails`,
`membership-renewal-reminders`, `archive-audit-logs`, `purge-app-error-logs`, `purge-cron-run-details`
y `purge-user-access-logs`. Los dos primeros fallarán hasta que hagas el Paso 4 y hasta que las Edge
Functions estén desplegadas (Paso 12). Es ruido esperado, no un problema — pero no lo dejes ahí.

### Después del corte: cómo se mantienen sincronizadas

Una sola dirección, **dev → producción**, y siempre por migración:

1. Escribes la migración y la pruebas contra desarrollo (`db push` estando enlazado a dev).
2. Commit + push a `staging`, con CI en verde.
3. `supabase link --project-ref <REF-PROD>` y `supabase db push --linked`.
4. Vuelves a enlazar desarrollo y recién entonces mergeas a `main`.

La base va **por delante** del frontend a propósito: un esquema nuevo con el frontend viejo funciona;
al revés, no.

⛔ **Cero cambios desde el dashboard.** Un `GRANT` o una policy hechos a mano no existen en ninguna
migración: no viajan al siguiente entorno y reaparecen como drift.

---

# Paso 3 · Secretos de las Edge Functions

Supabase → **Edge Functions → Secrets** del proyecto de producción.
**Ninguno se copia de desarrollo.** Un secreto compartido convierte un incidente de dev en uno de prod.

| Secreto | Valor |
|---|---|
| `ASI_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` de producción (Settings → API Keys) |
| `ASI_SUPABASE_SECRET_KEY` | `sb_secret_…` de producción. **Omite RLS: jamás al navegador** |
| `APP_URL` | `https://asidominicana.do` |
| `RESEND_API_KEY_DEV` | la key de producción del Paso 6 |
| `EMAIL_FROM_ADDRESS_DEV` | `ASI Dominicana <notificaciones@asidominicana.do>` |
| `RESEND_WEBHOOK_SECRET_DEV` | el `whsec_…` del webhook del Paso 6 |
| `EMAIL_PROCESSOR_SECRET` | genera uno nuevo: `openssl rand -hex 32` |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | pública del par nuevo (abajo) |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | privada del mismo par |
| `WEB_PUSH_CONTACT_EMAIL` | `mailto:eperez@cilm.do` |
| `STRESS_HARNESS_ENABLED` | `false` |
| `HARNESS_ENV` | `production` |

> El sufijo `_DEV` de las tres de Resend **no significa desarrollo**: son los nombres canónicos en todos
> los entornos (`_shared/resend-config.ts`). No inventes variantes sin sufijo: el código no las lee.

Claves VAPID nuevas (compartirlas haría que una suscripción de dev reciba avisos de producción):

```bash
npx web-push generate-vapid-keys
```

Guarda la **pública** también para el Paso 9 (`VITE_WEB_PUSH_PUBLIC_KEY`).

- [ ] Los 12 secretos cargados. `HARNESS_PRODUCTION_TARGETS` no hace falta salvo que uses el arnés.

---

# Paso 4 · `private.runtime_secrets` (dentro de la base)

Los cron de Postgres llaman a las Edge Functions por HTTP y sacan de aquí a dónde llamar.
SQL Editor del proyecto de **producción**:

```sql
insert into private.runtime_secrets (key, value) values
  ('email_dispatch_url',      'https://<REF-PROD>.supabase.co/functions/v1/process-email-deliveries'),
  ('email_dispatch_anon_key', '<sb_publishable_ de produccion>'),
  ('email_processor_secret',  '<el mismo EMAIL_PROCESSOR_SECRET del Paso 3>')
on conflict (key) do update set value = excluded.value;
```

🔴 **Comprueba dos veces que `<REF-PROD>` es el de producción.** Si queda el de desarrollo, el cron de
producción dispara contra las funciones de desarrollo: es el error más caro de toda esta lista y no da
ningún síntoma visible.

```sql
select key, left(value, 40) from private.runtime_secrets;   -- verifica el ref a ojo
```

- [ ] Las tres claves cargadas y el ref verificado.

---

# Paso 5 · Auth del proyecto de producción

Supabase → **Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| Site URL | `https://asidominicana.do` |
| Redirect URLs | `https://asidominicana.do/auth/confirm`<br>`https://asidominicana.do/auth/reset-password`<br>`https://asidominicana.do/auth/sign-in`<br>`https://asidominicana.do/candidate/profile` |

Sin `/auth/reset-password` en la lista, recuperar contraseña se rompe en silencio.

⛔ **No corras `supabase config push` contra producción.** El `config.toml` del repo describe el
proyecto de desarrollo: le pondría `site_url = https://dev.asidominicana.do`.

Plantilla del correo de confirmación (Authentication → Email Templates queda desactualizado si no la
promocionas):

```bash
SUPABASE_ACCESS_TOKEN=<token> \
SUPABASE_PROJECT_REF=<REF-PROD> \
AUTH_DEPLOY_ENV=production \
EXPECTED_AUTH_SITE_URL=https://asidominicana.do \
PRODUCTION_SUPABASE_PROJECT_REF=<REF-PROD> \
PRODUCTION_AUTH_SITE_URL=https://asidominicana.do \
npx tsx scripts/sync-auth-email-template.ts --dry-run

# Quita --dry-run solo después de leer el destino que imprime.
```

También:

- [ ] Authentication → Providers → Email: **activar protección de contraseñas filtradas**
- [ ] Quitar del panel de Auth los 4 redirects viejos de `asi-do.netlify.app` si aparecen

---

# Paso 6 · Resend

- [ ] **Dominio verificado**: `asidominicana.do` con SPF, DKIM y DMARC en el DNS
- [ ] **API key propia de producción**, con permiso de *sending access* únicamente — no de administrar
      dominios ni keys (la actual `asi-dev` puede hacer todo eso). Va a `RESEND_API_KEY_DEV` del Paso 3
- [ ] **Remitente**: `notificaciones@asidominicana.do` con `Reply-To` real
- [ ] **Webhook nuevo** apuntando a
      `https://<REF-PROD>.supabase.co/functions/v1/resend-webhook`, con los eventos de entrega, rebote,
      queja, apertura y clic. Su `whsec_…` va a `RESEND_WEBHOOK_SECRET_DEV` del Paso 3
- [ ] Revocar la key vieja **después** de comprobar que producción envía (Paso 15)

> El webhook es la única función sin JWT (`verify_jwt = false`): su seguridad es exactamente ese
> secreto. No lo reutilices para nada más.

---

# Paso 7 · AZUL de producción (Railway)

Servicio **nuevo**, no reconfigures el de pruebas: quedarte sin el de staging te deja sin dónde probar.

| Variable | Valor de producción |
|---|---|
| `PORT` | `8080` |
| `SERVICE_PUBLIC_URL` | la URL pública que te dé Railway para este servicio |
| `ALLOWED_ORIGIN` | `https://asidominicana.do` |
| `APP_URL` | `https://asidominicana.do` |
| `SUPABASE_URL` | `https://<REF-PROD>.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_…` de producción |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` de producción |
| `AZUL_ENVIRONMENT` | `production` |
| `AZUL_MERCHANT_ID` | **el real** de la afiliación |
| `AZUL_MERCHANT_NAME` | **el que entregue AZUL** (no `Prueba AZUL`) |
| `AZUL_MERCHANT_TYPE` | `ECommerce` |
| `AZUL_AUTH_KEY` | **la real** |
| `AZUL_PAYMENT_URL` | `https://contpagos.azul.com.do/PaymentPage/` |
| `AZUL_PAYMENT_ALT_URL` | `https://contpagos.azul.com.do/PaymentPage/Default.aspx` |
| `AZUL_CURRENCY_CODE` | `$` |
| `AZUL_SHOW_TRANSACTION_RESULT` | `1` |
| `RECONCILE_ENABLED` | `true` |
| `RECONCILE_CRON` | `*/5 * * * *` |
| `RECONCILE_STALE_MINUTES` | `15` |
| `LOG_LEVEL` | `info` |

- [ ] `GET <SERVICE_PUBLIC_URL>/healthz` responde 200
- [ ] Anota esa URL: es `VITE_AZUL_PAYMENTS_URL` del Paso 9

🔴 Cruzar credenciales aquí significa cobrar de verdad desde staging, o no cobrar en producción.

---

# Paso 8 · Hostinger y DNS

- [ ] `asidominicana.do` resuelve al hosting y sirve HTTPS con certificado válido
- [ ] Cuenta FTP cuyo **document root sea el de `asidominicana.do`** (no el de `dev.`)
- [ ] Anota host, puerto (21, el script usa FTP con TLS explícito), usuario y contraseña

Comprueba la cuenta antes de meterla en GitHub:

```bash
lftp -u <usuario>,<contraseña> -p 21 <host> -e "set ftp:ssl-force true; ls; bye"
```

Debes ver el contenido del sitio de producción. Si ves el de `dev`, es la cuenta equivocada.

---

# Paso 9 · GitHub → environment `production`

https://github.com/EdgarJr30/asi_do/settings/environments → **New environment** → nombre exacto:
`production`

### Environment variables (públicas, quedan dentro del bundle)

| Variable | Valor |
|---|---|
| `VITE_DEPLOY_ENV` | `production` |
| `VITE_SUPABASE_URL` | `https://<REF-PROD>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` de producción |
| `VITE_AUTH_SITE_URL` | `https://asidominicana.do` |
| `VITE_PRODUCTION_SITE_URL` | `https://asidominicana.do` — **idéntica a la anterior o el build aborta** |
| `VITE_AZUL_PAYMENTS_URL` | la URL del servicio AZUL del Paso 7 |
| `VITE_WEB_PUSH_PUBLIC_KEY` | VAPID **pública** del Paso 3 |
| `VITE_APP_NAME` | `ASI Rep. Dominicana` |
| `SUPABASE_PROJECT_REF` | `<REF-PROD>` — 🔴 **obligatoria**: si falta, se hereda la del repositorio, que apunta a desarrollo |

### Environment secrets

| Secret | Valor |
|---|---|
| `HOSTINGER_HOST` | del Paso 8 |
| `HOSTINGER_PORT` | `21` |
| `HOSTINGER_USERNAME` | del Paso 8 |
| `HOSTINGER_PASSWORD` | del Paso 8 |
| `SUPABASE_ACCESS_TOKEN` | tu token personal del CLI |

### Protection rules (aquí vive la aprobación manual)

- [ ] ✅ **Required reviewers** → tú. Sin esto, el merge publica sin preguntar
- [ ] ✅ **Deployment branches** → *Selected branches* → `main`

> Si `VITE_SUPABASE_URL` apunta por error al proyecto de desarrollo, **el build se niega a publicar**
> (`required-env.ts`). Es la red que faltaba cuando `asidominicana.do` sirvió tres días la base de dev.

---

# Paso 10 · Variables a nivel de repositorio

Settings → Secrets and variables → **Actions** → pestaña **Variables** (fuera de todo environment):

| Variable | Valor | Para qué |
|---|---|---|
| `PRODUCTION_SUPABASE_PROJECT_REF` | `<REF-PROD>` | segunda negación: hace que los E2E que escriben datos se nieguen a apuntar a producción |

- [ ] Cargada. Los secretos `E2E_*` que ya existen siguen apuntando a desarrollo y así deben quedarse.

---

# Paso 11 · Que `main` solo se toque por PR

Settings → **Branches** (o Rules) → regla para `main`:

- [ ] ✅ Require a pull request before merging
- [ ] ✅ Require status checks to pass, y selecciona los seis:
      `Verify quality gate` · `Verify AZUL payments service` · `Mutation testing` ·
      `Lint and test Edge Functions` · `E2E smoke` · `Dependency audit policy`
- [ ] ✅ Block force pushes

Resultado: el único camino a producción es **PR desde `staging` → checks verdes → merge → tu
aprobación → publica**.

---

# Paso 12 · Primer despliegue

1. [ ] `supabase db push --linked` contra producción, ya con todo lo anterior hecho
2. [ ] Abre el PR `staging` → `main` y espera los seis checks
3. [ ] Merge
4. [ ] GitHub te pedirá aprobar el environment `production` → **Approve and deploy**
5. [ ] Espera a que terminen `deploy-production` y `deploy-edge-functions`
6. [ ] El propio job corre `Smoke de producción` al final: si eso pasa, el sitio responde

Si algo falla, el script restaura los `index.html` y `sw.js` anteriores: el sitio no queda a medias.

---

# Paso 13 · Reclamar el primer administrador

**La base de producción es nueva: no hay ningún administrador.** Se reclama una sola vez, desde el sitio
ya publicado.

1. [ ] Regístrate en `https://asidominicana.do` con la cuenta que será la dueña
2. [ ] Confirma el correo (esto ya prueba que Resend y Auth funcionan)
3. [ ] Entra a `https://asidominicana.do/admin/bootstrap-owner` y reclama la propiedad

Solo funciona mientras no exista ningún `platform_owner`. Después responde
*"Ya existe un primer admin activo"*.

---

# Paso 14 · Contenido inicial

La base y el storage están vacíos, así que la home pública sale incompleta:

- [ ] Subir `videos/demoApp.webm` y `videos/christian-event.webm` al bucket `public-media`
      (⚠️ no están en el repo: los tiene que aportar el propietario)

Sin ellos la página degrada a poster e imagen, no se rompe.

---

# Paso 15 · Verificación de punta a punta

Cierra el corte cuando todo esto pase **en `asidominicana.do`**:

- [ ] El bundle público **no** contiene `jgmojkzthfogynqixkob`
      → `curl -s https://asidominicana.do/assets/*.js | grep -c jgmojkz` debe dar `0`
- [ ] Registro + correo de confirmación + inicio de sesión
- [ ] Recuperar contraseña vuelve a `asidominicana.do/auth/reset-password`
- [ ] Solicitud de membresía completa
- [ ] **Un cobro real mínimo** con tarjeta: activa la membresía y aparece en la conciliación
- [ ] El correo enviado se ve en `/admin/correos` con su evento del proveedor
- [ ] Una notificación push llega al dispositivo
- [ ] Entregabilidad: el correo llega a Gmail y a Outlook sin ir a spam
- [ ] Revocar la API key vieja de Resend
- [ ] Rotar la llave `service_role` de desarrollo y resincronizar `.env.local`, AZUL de pruebas y las
      Edge Functions de dev — estuvo en claro en `audit_logs` desde marzo

---

## Lo que sigue siendo manual después del corte

| Qué | Por qué |
|---|---|
| `supabase db push` a producción | no hay job de CI que aplique migraciones al remoto; se hace antes de cada merge a `main` |
| Vigilancia de drift | `db-drift.yml` usa el `SUPABASE_PROJECT_REF` del repositorio, que apunta a desarrollo: **el día que exista producción, es a producción a quien hay que vigilar**. Cambia esa variable o duplica el job |
| Poda de bundles viejos en Hostinger | `deploy-hostinger-release.sh` no borra a propósito: los chunks viejos sostienen las pestañas abiertas durante el despliegue (D5) |

## Si algo falla

| Síntoma | Causa casi segura |
|---|---|
| El build aborta nombrando variables | falta una del Paso 9, o `VITE_AUTH_SITE_URL` ≠ `VITE_PRODUCTION_SITE_URL` |
| «apunta a un proyecto Supabase de desarrollo» | `VITE_SUPABASE_URL` quedó con el ref de dev |
| `deploy-edge-functions` falla nombrando token o ref | falta el secret o la var, y el repositorio tampoco la tiene (Pasos 0 y 9) |
| «SUPABASE_PROJECT_REF apunta a un proyecto que no es el de produccion» | el environment `production` no la declara y heredó la de desarrollo (Paso 9) |
| El sitio carga pero nadie puede entrar | `VITE_SUPABASE_ANON_KEY` de otro proyecto |
| Los correos no salen y el cron falla | `private.runtime_secrets` sin cargar o con el ref equivocado (Paso 4) |
| Los correos salen desde producción con datos de dev | `email_dispatch_url` con el ref de desarrollo (Paso 4) |
