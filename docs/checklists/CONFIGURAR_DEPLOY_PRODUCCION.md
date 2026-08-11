# Configurar el deploy de producción

Lista de tareas. De arriba a abajo. Cada paso dice dónde se hace y con qué valor exacto.

`ci.yml` ya tiene los jobs. Falta la configuración de abajo.

**Flujo final:** PR `staging` → `main` → 6 checks → merge → apruebas el environment → publica solo.
Las migraciones **no** van en ese flujo: se aplican a mano antes de mergear.

---

## Bloqueantes (resolver antes de empezar)

- [ ] **Instancia Nano** 🔴 — el plan gratuito da 411 MB de RAM. Esa es la instancia que el 2026-08-10
      dejó la base 2 h 08 min sin aceptar conexiones, con **menos** tráfico del que trae un lanzamiento
      (`SALIDA_A_PRODUCCION.md` §K). Producción necesita Micro o superior, y eso exige plan Pro.
- [ ] **Sin respaldos** 🔴 — el gratuito no trae respaldos diarios ni PITR. Es la base que va a guardar
      los pagos.
- [ ] **Credenciales reales de AZUL** — merchant ID, merchant name y `AZUL_AUTH_KEY`. Las entrega AZUL;
      no depende de nosotros.

---

## 1 · Crear el proyecto Supabase

- [ ] supabase.com → New project, región `us-east-1`
- [ ] Guardar la contraseña de la base (no se vuelve a ver)
- [ ] Copiar el `project_ref` → de aquí en adelante, `<REF-PROD>`
- [ ] Anotarlo en `ENVIRONMENTS.md` §2 y commitear

## 2 · Levantar el esquema

```bash
supabase link --project-ref <REF-PROD>
supabase db push --linked
```

- [ ] `supabase db lint --linked` → sin errores
- [ ] `npm run test:probes` → 22/22
- [ ] `supabase db diff --linked --schema public,private,storage,auth` → vacío
- [ ] `supabase link --project-ref jgmojkzthfogynqixkob` ← **volver a desarrollo**

> `link` es global: mientras apunte a producción, cualquier `db push` o `db query` va ahí.
> El diff necesita colima: `colima start` + `export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock`.

**Viaja solo:** tablas, RLS, funciones, grants, extensiones, los 6 buckets (vacíos), las 18 tablas de
Realtime, los 6 cron, roles, permisos y las 3 categorías de membresía con sus precios.

- [ ] Settings → Storage: tope global **50 MiB** (vive en `config.toml`, que es de desarrollo, y no viaja)

## 3 · Secretos de Edge Functions

Supabase → Edge Functions → Secrets. **Ninguno copiado de desarrollo.**

| Secreto | Valor |
|---|---|
| `ASI_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` de producción |
| `ASI_SUPABASE_SECRET_KEY` | `sb_secret_…` de producción |
| `APP_URL` | `https://asidominicana.do` |
| `RESEND_API_KEY_DEV` | la key del paso 5 |
| `EMAIL_FROM_ADDRESS_DEV` | `ASI Dominicana <notificaciones@asidominicana.do>` |
| `RESEND_WEBHOOK_SECRET_DEV` | el `whsec_…` del paso 5 |
| `EMAIL_PROCESSOR_SECRET` | `openssl rand -hex 32` |
| `WEB_PUSH_VAPID_PUBLIC_KEY` / `WEB_PUSH_VAPID_PRIVATE_KEY` | par nuevo: `npx web-push generate-vapid-keys` |
| `WEB_PUSH_CONTACT_EMAIL` | `mailto:eperez@cilm.do` |
| `STRESS_HARNESS_ENABLED` | `false` |
| `HARNESS_ENV` | `production` |

- [ ] Los 12 cargados
- [ ] En el proyecto de **desarrollo**: añadir `<REF-PROD>` a `HARNESS_PRODUCTION_TARGETS`

> El sufijo `_DEV` es el nombre canónico en todos los entornos. No inventes variantes sin sufijo.

## 4 · `runtime_secrets` (SQL Editor de producción)

```sql
insert into private.runtime_secrets (key, value) values
  ('email_dispatch_url',      'https://<REF-PROD>.supabase.co/functions/v1/process-email-deliveries'),
  ('email_dispatch_anon_key', '<sb_publishable_ de produccion>'),
  ('email_processor_secret',  '<el mismo EMAIL_PROCESSOR_SECRET del paso 3>')
on conflict (key) do update set value = excluded.value;
```

- [ ] Verificar el ref: `select key, left(value, 40) from private.runtime_secrets;`

> 🔴 Con el ref de desarrollo, el cron de producción dispara contra las funciones de desarrollo, sin
> ningún síntoma visible.

## 5 · Resend

- [ ] Dominio `asidominicana.do` verificado (SPF, DKIM, DMARC)
- [ ] API key nueva, solo *sending access* → va al paso 3
- [ ] Remitente `notificaciones@asidominicana.do` con `Reply-To` real
- [ ] Webhook → `https://<REF-PROD>.supabase.co/functions/v1/resend-webhook`; su `whsec_…` va al paso 3
- [ ] Revocar la key vieja **después** del paso 12

## 6 · Auth de producción

- [ ] Site URL: `https://asidominicana.do`
- [ ] Redirect URLs: `/auth/confirm`, `/auth/reset-password`, `/auth/sign-in`, `/candidate/profile`
      (sin `/auth/reset-password` la recuperación se rompe en silencio)
- [ ] Activar protección de contraseñas filtradas
- [ ] Plantilla del correo:

```bash
SUPABASE_ACCESS_TOKEN=<token> SUPABASE_PROJECT_REF=<REF-PROD> AUTH_DEPLOY_ENV=production \
EXPECTED_AUTH_SITE_URL=https://asidominicana.do \
PRODUCTION_SUPABASE_PROJECT_REF=<REF-PROD> PRODUCTION_AUTH_SITE_URL=https://asidominicana.do \
npx tsx scripts/sync-auth-email-template.ts --dry-run
```

> ⛔ No corras `supabase config push` contra producción: `config.toml` describe desarrollo.

## 7 · AZUL en Railway (servicio nuevo)

| Variable | Valor |
|---|---|
| `AZUL_ENVIRONMENT` | `production` |
| `AZUL_MERCHANT_ID` / `AZUL_MERCHANT_NAME` / `AZUL_AUTH_KEY` | los reales de la afiliación |
| `AZUL_PAYMENT_URL` | `https://contpagos.azul.com.do/PaymentPage/` |
| `AZUL_PAYMENT_ALT_URL` | `https://contpagos.azul.com.do/PaymentPage/Default.aspx` |
| `AZUL_MERCHANT_TYPE` / `AZUL_CURRENCY_CODE` / `AZUL_SHOW_TRANSACTION_RESULT` | `ECommerce` / `$` / `1` |
| `SERVICE_PUBLIC_URL` | la URL que dé Railway |
| `ALLOWED_ORIGIN` / `APP_URL` | `https://asidominicana.do` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | los de producción |
| `RECONCILE_ENABLED` / `RECONCILE_CRON` / `RECONCILE_STALE_MINUTES` | `true` / `*/5 * * * *` / `15` |
| `PORT` / `LOG_LEVEL` | `8080` / `info` |

- [ ] `GET <SERVICE_PUBLIC_URL>/healthz` → 200

## 8 · Hostinger

- [ ] `asidominicana.do` con HTTPS válido
- [ ] Cuenta FTP con document root de producción (no el de `dev.`). Probar:
      `lftp -u <user>,<pass> -p 21 <host> -e "set ftp:ssl-force true; ls; bye"`

## 9 · GitHub → environment `production`

https://github.com/EdgarJr30/asi_do/settings/environments → New environment → `production`

**Variables:**

| | |
|---|---|
| `VITE_DEPLOY_ENV` | `production` |
| `VITE_SUPABASE_URL` | `https://<REF-PROD>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` de producción |
| `VITE_AUTH_SITE_URL` | `https://asidominicana.do` |
| `VITE_PRODUCTION_SITE_URL` | `https://asidominicana.do` (idéntica a la anterior o el build aborta) |
| `VITE_AZUL_PAYMENTS_URL` | la del paso 7 |
| `VITE_WEB_PUSH_PUBLIC_KEY` | VAPID pública del paso 3 |
| `VITE_APP_NAME` | `ASI Rep. Dominicana` |
| `SUPABASE_PROJECT_REF` | `<REF-PROD>` — 🔴 si falta, hereda la del repositorio, que apunta a desarrollo |

**Secrets:** `HOSTINGER_HOST` · `HOSTINGER_PORT` (21) · `HOSTINGER_USERNAME` · `HOSTINGER_PASSWORD` ·
`SUPABASE_ACCESS_TOKEN`

**Protection rules:**

- [ ] Required reviewers → tú (sin esto, el merge publica sin preguntar)
- [ ] Deployment branches → `main`

## 10 · Repositorio y rama

- [ ] Settings → Actions → Variables: `PRODUCTION_SUPABASE_PROJECT_REF` = `<REF-PROD>`
- [ ] Branch protection de `main`: require PR + los 6 checks + block force pushes
      (`Verify quality gate` · `Verify AZUL payments service` · `Mutation testing` ·
      `Lint and test Edge Functions` · `E2E smoke` · `Dependency audit policy`)

## 11 · Primer despliegue

- [ ] PR `staging` → `main`, esperar los 6 checks
- [ ] Merge → **Approve and deploy**
- [ ] Terminan `deploy-production` y `deploy-edge-functions`; el job corre el smoke solo
- [ ] Repuntar el DNS de `asidominicana.do` si aún no apunta al hosting nuevo

## 12 · Arranque y verificación

- [ ] Registrarse en `https://asidominicana.do` con la cuenta dueña y confirmar el correo
- [ ] Entrar a `/admin/bootstrap-owner` y reclamar la propiedad (**solo funciona una vez**)
- [ ] Subir los 2 videos al bucket `public-media`
- [ ] El bundle no contiene el ref de desarrollo:

```bash
curl -s https://asidominicana.do/ | grep -oE '/assets/[^"]+\.js' \
  | while read -r a; do curl -s "https://asidominicana.do$a"; done \
  | grep -c jgmojkzthfogynqixkob     # tiene que dar 0
```

- [ ] Recuperar contraseña vuelve a `asidominicana.do`
- [ ] Solicitud de membresía + **cobro real mínimo** → membresía activa y visible en la conciliación
- [ ] El correo aparece en `/admin/correos` con su evento del proveedor
- [ ] Push llega al dispositivo
- [ ] Correo llega a Gmail y Outlook sin ir a spam → revocar la key vieja de Resend
- [ ] Rotar la `service_role` de desarrollo (estuvo en claro en `audit_logs` desde marzo)

---

## Después del corte

- Migraciones: **dev → producción**, siempre por migración y antes de mergear a `main`.
  `link` a prod → `db push` → `link` de vuelta a dev → merge.
- Cero cambios desde el dashboard: no viajan y reaparecen como drift.
- `db-drift.yml` vigila desarrollo. Apúntalo a producción.
- Poda de bundles viejos en Hostinger: pendiente (D5).

## Revertir

| Qué pasó | Qué hacer |
|---|---|
| El frontend salió mal | Actions → corrida anterior de `deploy-production` → Re-run job |
| Necesitas el artefacto exacto | `production-dist-<sha>`, guardado 90 días |
| El código está mal | `git revert` en `staging` → PR a `main` |
| La migración está mal | No se revierte: se añade otra encima |

## Si algo falla

| Síntoma | Causa |
|---|---|
| El build aborta nombrando variables | falta una del paso 9, o `VITE_AUTH_SITE_URL` ≠ `VITE_PRODUCTION_SITE_URL` |
| «apunta a un proyecto Supabase de desarrollo» | `VITE_SUPABASE_URL` con el ref de dev |
| «SUPABASE_PROJECT_REF … no es el de produccion» | el environment `production` no la declara (paso 9) |
| El sitio carga pero nadie entra | `VITE_SUPABASE_ANON_KEY` de otro proyecto |
| Los correos no salen y el cron falla | `runtime_secrets` sin cargar o con el ref equivocado (paso 4) |
