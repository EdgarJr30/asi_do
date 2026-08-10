# Configurar el deploy de producción

Qué hay que crear y dónde, en orden, para que un merge a `main` publique solo.
El código ya está: `ci.yml` tiene `deploy-production` y `deploy-edge-functions`. **Falta la configuración.**

## Cómo quedará el flujo

```
PR staging → main
      │  CI corre 6 jobs (verify · azul-service · mutation · edge-functions · e2e-smoke · audit)
      ▼
   merge a main
      │  environment `production` pide tu aprobación
      ▼
   deploy-production        deploy-edge-functions   (en paralelo)
   build + FTP Hostinger    supabase functions deploy
      │
      ▼
   smoke contra asidominicana.do
```

⚠️ **Las migraciones NO van en ese flujo.** Se aplican a mano con `supabase db push --linked` **antes** de mergear a `main`.

---

## Paso 1 · Proyecto Supabase de producción

| # | Acción | Cierra cuando |
|---|---|---|
| 1.1 | Crear proyecto en supabase.com. Anotar `project_ref` y contraseña de base | ref anotado en `ENVIRONMENTS.md` §2 |
| 1.2 | `supabase link --project-ref <ref-prod>` + `supabase db push --linked` | sin errores |
| 1.3 | `supabase db lint --linked` y `npm run test:probes` | lint limpio, probes 22/22 |
| 1.4 | Auth → URL Configuration: `site_url = https://asidominicana.do` + redirects `/auth/confirm`, `/auth/reset-password`, `/auth/sign-in`, `/candidate/profile` | recuperar contraseña vuelve al dominio real |
| 1.5 | Auth → activar **protección de contraseñas filtradas** | (C7) |

⛔ **No corras `supabase config push` contra producción.** `supabase/config.toml` describe el proyecto de desarrollo: le pondría `site_url = dev.asidominicana.do`.

## Paso 2 · Secretos dentro de Supabase producción

**Valores nuevos, ninguno copiado de desarrollo** (`ENVIRONMENTS.md` §4.3).

Edge Functions → Secrets:

`ASI_SUPABASE_PUBLISHABLE_KEY` · `ASI_SUPABASE_SECRET_KEY` · `APP_URL=https://asidominicana.do` · `EMAIL_FROM_ADDRESS_DEV` · `RESEND_API_KEY_DEV` · `RESEND_WEBHOOK_SECRET_DEV` · `EMAIL_PROCESSOR_SECRET` · `WEB_PUSH_VAPID_PUBLIC_KEY` · `WEB_PUSH_VAPID_PRIVATE_KEY` · `WEB_PUSH_CONTACT_EMAIL` · `STRESS_HARNESS_ENABLED=false` · `HARNESS_ENV=production`

Dentro de la base (`private.runtime_secrets`):

| Clave | Valor |
|---|---|
| `email_dispatch_url` | `https://<ref-PROD>.supabase.co/functions/v1/…` |
| `email_dispatch_anon_key` | publicable de producción |
| `email_processor_secret` | el mismo del secreto de arriba |

⚠️ `email_dispatch_url` con el ref equivocado = el cron de producción dispara contra las funciones de desarrollo. Es el error más caro de la lista.

Genera VAPID propias: `npx web-push generate-vapid-keys`. La pública va también al Paso 4.

## Paso 3 · Servicios externos

| Servicio | Qué configurar |
|---|---|
| **AZUL** | Nuevo servicio en Railway con `AZUL_ENVIRONMENT=production`, merchant real, `AZUL_AUTH_KEY` real, `AZUL_PAYMENT_URL=https://contpagos.azul.com.do`, `ALLOWED_ORIGIN`/`APP_URL`=`https://asidominicana.do`, llave secreta del Supabase de producción. Anotar su URL pública |
| **Resend** | API key propia de producción (sin permisos de admin), remitente `ASI Dominicana <notificaciones@asidominicana.do>`, webhook nuevo apuntando a `resend-webhook` del proyecto de producción → su secreto va al Paso 2 |
| **Hostinger** | Cuenta FTP cuyo document root sea el de `asidominicana.do`. Anotar host, puerto, usuario y contraseña |
| **DNS** | `asidominicana.do` apuntando a ese hosting, con HTTPS válido |

## Paso 4 · GitHub → Settings → Environments → **New environment: `production`**

**Variables** (públicas, van horneadas en el bundle):

| Variable | Valor |
|---|---|
| `VITE_DEPLOY_ENV` | `production` |
| `VITE_SUPABASE_URL` | `https://<ref-PROD>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` de producción |
| `VITE_AUTH_SITE_URL` | `https://asidominicana.do` |
| `VITE_PRODUCTION_SITE_URL` | `https://asidominicana.do` (idéntico al anterior o el build aborta) |
| `VITE_AZUL_PAYMENTS_URL` | URL del AZUL de producción (Paso 3) |
| `VITE_WEB_PUSH_PUBLIC_KEY` | VAPID pública de producción |
| `VITE_APP_NAME` | nombre visible de la app |
| `SUPABASE_PROJECT_REF` | `<ref-PROD>` — lo usa `deploy-edge-functions` |

**Secrets:**

| Secret | Valor |
|---|---|
| `HOSTINGER_HOST` / `HOSTINGER_PORT` / `HOSTINGER_USERNAME` / `HOSTINGER_PASSWORD` | los del Paso 3 |
| `SUPABASE_ACCESS_TOKEN` | token personal del CLI (dashboard → account → tokens) |

**Protection rules** (esto es la aprobación manual):

- ✅ Required reviewers → tú
- ✅ Deployment branches → **Selected branches: `main`**

## Paso 5 · Repositorio (fuera del environment)

Settings → Secrets and variables → Actions → pestaña **Variables**:

| Variable | Valor | Para qué |
|---|---|---|
| `PRODUCTION_SUPABASE_PROJECT_REF` | `<ref-PROD>` | segunda negación: impide que los E2E que escriben datos apunten a producción |

## Paso 6 · Que `main` solo se toque por PR

Settings → Rules / Branch protection → rama `main`:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass: `verify`, `azul-service`, `mutation-testing`, `edge-functions`, `e2e-smoke`, `dependency-audit`
- ✅ Block force pushes

Con eso, el único camino a producción es: **PR desde `staging` → checks verdes → merge → aprobar el environment → publica**.

## Paso 7 · Primer corte

1. `supabase db push --linked` contra producción (migraciones pendientes: bloque J + F1).
2. Abrir PR `staging` → `main` y mergear.
3. Aprobar el despliegue cuando GitHub lo pida.
4. Esperar el `Smoke de producción` del final del job.

**Verificación manual después:**

- [ ] El bundle público **no** contiene `jgmojkzthfogynqixkob` (ref de desarrollo)
- [ ] Registro + confirmación por correo desde `asidominicana.do`
- [ ] Solicitud de membresía → pago real mínimo → membresía activa
- [ ] Correo saliente visible en `/admin/correos`
- [ ] Notificación push
- [ ] La llave `service_role` vieja rotada y dando 401

---

## Lo que sigue quedando manual (por ahora)

| Qué | Por qué |
|---|---|
| `supabase db push` a producción | no hay job de CI que aplique migraciones al remoto |
| Vigilancia de drift | `db-drift.yml` usa un solo `SUPABASE_PROJECT_REF` de repositorio: vigila un proyecto, no los dos |
| Poda de bundles viejos en Hostinger | `deploy-hostinger-release.sh` no borra a propósito (D5) |
