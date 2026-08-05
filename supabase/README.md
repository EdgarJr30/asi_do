# Supabase Structure

Use this folder as the source of truth for backend assets:

```text
supabase/
  config.toml  hosted project config for auth/storage services
  migrations/  schema evolution
  policies/    documented policy snippets or helpers when needed
  functions/   edge functions only when justified
  seeds/       local/dev seed data
  templates/   hosted auth email templates pushed through Supabase config
```

SQL migrations remain authoritative for schema, constraints, helper functions, and RLS policies.
`supabase/config.toml` is the source of truth for hosted Auth and Storage configuration that is managed through `supabase config push`.

> **`config push` no termina en este proyecto.** El paso de Auth se aplica, pero el de Storage falla con
> `402: Please upgrade the project to a paid tier to enable vector buckets`: el CLI envía
> `vector.enabled = true` por defecto y el plan gratuito lo rechaza. Consecuencia práctica: **Auth sí se
> sincroniza, Storage no**. Al terminar, comprueba que dice `Remote Auth config is up to date` — eso es lo
> que confirma que tu cambio llegó.

## Contraseñas: política y recuperación

**La política se declara una vez, en `config.toml`:** `minimum_password_length = 8` y
`password_requirements = "lower_upper_letters_digits"` (mínimo 8 caracteres con minúscula, mayúscula y
dígito). GoTrue solo admite tres presets en ese campo —`letters_digits`, `lower_upper_letters_digits` y
`lower_upper_letters_digits_symbols`—, así que no se puede expresar cualquier regla.

**El cliente la replica, no la define.** `passwordSchema` y `passwordPolicyRules` en
`src/features/auth/lib/auth-schemas.ts` existen solo para adelantar el rechazo y decirle al usuario qué le
falta; quien decide es el servidor. `tests/unit/password-policy.test.ts` lee este mismo `config.toml` y
falla si las dos declaraciones dejan de coincidir. **Si cambias la política aquí, ese test te avisa de lo
que falta actualizar allá.**

Dos detalles que no son obvios:

- **El formulario de acceso no valida la política**, solo que el campo no esté vacío. Antes del
  endurecimiento el servidor aceptaba 6 caracteres, y aplicar la regla nueva al login dejaría fuera a esas
  cuentas sin haberles cambiado nunca la contraseña.
- **El checklist visible sale de `passwordPolicyRules`**, la misma constante que valida. Estaba duplicado y
  era decorativo: mostraba «una mayúscula» y «un número» mientras el esquema solo pedía 8 caracteres.

### El flujo de recuperación, de punta a punta

1. `/auth/forgot-password` pide el correo y llama a `resetPasswordForEmail` con
   `redirectTo = {site_url}/auth/reset-password`. **Esa URL tiene que estar en `additional_redirect_urls`**
   o GoTrue la ignora en silencio y devuelve al `site_url`.
2. La confirmación en pantalla es idéntica exista o no la cuenta. Es deliberado: distinguir convertiría la
   pantalla en un verificador de quién tiene cuenta en ASI.
3. El correo usa `templates/recovery.html` con `{{ .ConfirmationURL }}`. Al abrirlo, GoTrue valida el token
   y redirige a `/auth/reset-password` con la sesión en el fragmento de la URL, que el SDK consume solo.
4. `/auth/reset-password` espera a que la sesión hidrate antes de decidir. **Sin sesión no muestra el
   formulario**: el enlace caducó (1 h), ya se usó, o alguien entró a la ruta a mano.
5. Al guardar, `updateUser({ password })` y **cierre de sesión inmediato**. La sesión de recuperación es una
   credencial de un solo uso que llegó por correo; mantenerla viva después del cambio alarga su vida sin
   razón, y obligar a entrar con la contraseña nueva es la única confirmación real de que quedó guardada.

### Verificar sin esperar un correo

El mínimo efectivo del remoto se lee provocando el rechazo, sin llegar a crear usuario:

```bash
curl -s -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -d '{"email":"probe@example.com","password":"a"}'
# -> weak_password; `reasons` lista "length" y/o "characters" según lo que incumpla
```

Una contraseña de un solo carácter incumple **todo** a la vez, así que `reasons` revela de una si hay
requisitos de caracteres configurados además del largo.

El ciclo completo de recuperación se prueba sin inbox generando el enlace con `service_role`
(`POST /auth/v1/admin/generate_link` con `{"type":"recovery"}`), canjeándolo con `verify` y llamando a
`PUT /auth/v1/user`. Es la forma de comprobar que `secure_password_change` no bloquea el restablecimiento.

## Regla: commitear antes de `db push`

**Git nunca debe ir por detrás de la base de datos.** El orden obligatorio para toda migración es:

```bash
supabase migration new <nombre>   # nunca crear el archivo a mano: el timestamp evita colisiones
# ...escribir la migración...
git add supabase/migrations/<archivo> && git commit
git push
supabase db push --linked          # solo ahora toca el remoto
# ...verificar con una probe de supabase/tests/...
```

**Por qué el orden importa.** Si `db push` va primero y algo se pierde entre medias —el disco falla, la rama se descarta, la sesión se interrumpe—, producción queda con cambios que **nadie puede explicar**: el SQL está aplicado, pero no existe el commit, ni el mensaje, ni el contexto de por qué se hizo. Recuperar eso significa arqueología sobre `pg_proc`.

Con el orden correcto, el peor caso es que git vaya por delante del remoto. Eso se arregla corriendo `db push`. El caso inverso no tiene arreglo.

Aplica igual a las migraciones que resultan "obviamente correctas" y a los arreglos de una línea: el riesgo no viene del tamaño del cambio, viene de la ventana entre aplicar y registrar.

### Corolarios

- **Una probe por migración de seguridad o de datos.** Viven en `supabase/tests/`, terminan siempre en `RAISE EXCEPTION` para que la transacción se revierta y no dejen filas de prueba en producción. Ver `p0_notification_authz_probe.sql` como referencia.
- **Las migraciones son inmutables una vez aplicadas.** Si una necesita corregirse, se añade otra encima. Editar el archivo ya desplegado hace que el repo y el remoto digan cosas distintas sin que nada lo detecte.
- **Toda RPC nueva que llame el cliente necesita su `grant execute ... to authenticated` explícito.** Se revocó el default privilege de Supabase, así que sin el grant falla en desarrollo — es intencional.
- **Un `REVOKE` sobre tablas que no son de `postgres` es un no-op silencioso.** Ver abajo.

### Los `REVOKE` del esquema `storage` no se pueden hacer, ni desde una migración ni desde el dashboard

**Estado: riesgo residual aceptado.** No es una tarea pendiente. Se intentó por las tres vías que existen y ninguna es posible en un proyecto hosted; queda documentado aquí para que nadie vuelva a gastar el tiempo.

Un `REVOKE` solo retira los grants que concedió **quien lo ejecuta**. Las migraciones corren como `postgres`, pero el grantor de `storage.objects`, `storage.buckets` y `storage.buckets_analytics` es `supabase_storage_admin` —su owner—, y `postgres` **no es miembro** de ese rol. Verificado contra el remoto en `information_schema.role_table_grants`: los 42 grants de `anon` y `authenticated` sobre esas tres tablas los concedió `supabase_storage_admin`, sin una sola excepción.

Postgres no trata ese desajuste como error: revoca cero filas y devuelve éxito. `supabase db push` termina en verde y el repo queda afirmando algo que no ocurrió. Le pasó a `20260805014037`, que está registrada como aplicada y **no surtió efecto**; se comprobó con `supabase/tests/p1_storage_truncate_grants_probe.sql`, que siguió reportando `TRUNCATE` vivo después del push.

Las tres vías, y por qué ninguna sirve:

| Intento | Resultado |
|---|---|
| `revoke ...` desde una migración (como `postgres`) | Éxito falso: cero filas revocadas, `db push` en verde |
| `set role supabase_storage_admin` (migración **o** SQL editor del dashboard) | `permission denied to set role` (42501) |
| `grant supabase_storage_admin to postgres` para poder asumirlo | `"supabase_storage_admin" role memberships are reserved, only superusers can grant them` (42501) |

El detalle que hace inútil el dashboard: **su SQL editor también corre como `postgres`**, el mismo rol que el CLI. No hay ahí ningún privilegio extra que no tengas desde la terminal. Y `postgres` en Supabase hosted no es superusuario —tiene `CREATEROLE`, pero desde PG16 eso solo permite administrar los roles que él mismo creó, y `supabase_storage_admin` lo creó `supabase_admin`—. El superusuario no está disponible para el cliente en un proyecto gestionado, así que el revoke exigiría intervención de soporte de Supabase.

**Qué es lo que queda vivo.** `TRUNCATE` sobre `storage.objects`, `storage.buckets` y `storage.buckets_analytics` para `anon` y `authenticated`, más `TRIGGER` y `REFERENCES`. `TRUNCATE` no pasa por RLS: vacía la tabla entera sin evaluar una sola política. La probe lo comprobó por comportamiento —no solo por catálogo—: hoy ambos roles pueden ejecutarlo.

**Por qué se puede convivir con ello.** El privilegio existe en la base, pero no hay ruta para llegar a él: `storage` no está entre los esquemas expuestos por PostgREST (el default es `public, graphql_public`), y las APIs de Storage y de PostgREST no aceptan `TRUNCATE` como operación. Hace falta una conexión SQL directa con las credenciales de `anon` o `authenticated`, que son roles de conexión sin contraseña propia — un cliente con la anon key no obtiene una sesión de Postgres, obtiene un JWT que `authenticator` traduce.

**Qué lo convertiría en explotable, y por tanto qué vigilar:**

1. Que `storage` se añada a *Dashboard → Settings → API → Exposed schemas*. Es un clic, y es el único cambio que abre la puerta de par en par.
2. Que aparezca una vía de SQL directo con esos roles (un pooler mal configurado, una extensión que exponga consultas arbitrarias).

La probe cubre lo que se puede cubrir desde SQL: su bloque D vigila que ninguna política de `storage` apunte a `anon`. El punto 1 no es observable desde la base — es configuración de la plataforma— y va en la revisión de despliegue.

## Los dos jobs que vigilan la base

### Qué es el drift

Las migraciones son el plano; la base de datos desplegada es el edificio. **Drift** es que alguien movió una pared sin actualizar el plano: un índice creado desde el dashboard, un `GRANT` a mano en el SQL Editor, una policy ajustada en la interfaz. El cambio funciona, pero **ya no hay ningún archivo que lo explique**.

Da igual mientras exista un solo entorno. Importa el día que se levante staging o producción desde las migraciones: todo lo que no está en un archivo **no viaja**, y el entorno nuevo sale incompleto sin que nadie sepa qué falta. También importa para revisión: un `GRANT` hecho a mano no aparece en ningún diff, que es justo la clase de fallo que originó el P0 de las RPC `SECURITY DEFINER`.

**El primer run midió el drift de este repositorio y encontró exactamente un objeto:** `public.rls_auto_enable()` y su event trigger `ensure_rls`, creados a mano en el proyecto desplegado y ausentes de `migrations/`. Se destapó porque `20260801120000` revoca privilegios sobre esa función y, en una base vacía, la función no existía:

```
ERROR: function public.rls_auto_enable() does not exist (SQLSTATE 42883)
```

No era cosmético. Ese event trigger **activa RLS automáticamente en cada tabla nueva de `public`**, así que un entorno creado desde las migraciones se habría quedado sin esa red de seguridad, y nadie lo habría notado hasta que una tabla nueva quedara expuesta. Repuesto en `20260801110000_backfill_rls_auto_enable.sql`, con timestamp anterior a la migración que lo necesita.

### Los jobs

| Job | Pregunta que responde | Cuándo corre |
|---|---|---|
| `.github/workflows/db-migrations.yml` | ¿Mis migraciones construyen un esquema válido desde cero? | Al cambiar `supabase/**`, y a demanda |
| `.github/workflows/db-drift.yml` | ¿Lo que construyen coincide con lo desplegado? | Diario 08:00 (hora RD), y a demanda |

Ambos en verde significan que crear un entorno nuevo es trámite y no exploración.

**Cuando el job de drift falla**, publica en el resumen del run la diferencia **como SQL** y la guarda como artefacto `drift-sql`. Ese SQL es el parche que falta: se copia a `supabase migration new <nombre>` y el plano vuelve a coincidir con el edificio. Si el cambio no debía existir, se revierte en el remoto.

Corre a diario a propósito. El drift lo crean personas haciendo cosas puntuales, y la memoria caduca: al día siguiente todavía recuerdas por qué creaste ese índice; seis meses después nadie sabe si fue deliberado ni si borrarlo rompe algo.

### Configuración requerida

El job de drift necesita credenciales del proyecto. En GitHub → *Settings* → *Secrets and variables* → *Actions*:

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `SUPABASE_ACCESS_TOKEN` | Token personal del CLI (`supabase.com/dashboard/account/tokens`) |
| Secret | `SUPABASE_DB_PASSWORD` | Contraseña de la base del proyecto |
| Variable | `SUPABASE_PROJECT_REF` | Ref del proyecto a vigilar |

Sin estos tres, el job falla al enlazar. El de replay no necesita ninguno: corre contra una base local desechable.

> Los jobs programados se desactivan solos tras 60 días sin actividad en el repositorio. Si el repo queda inactivo, hay que reactivarlos a mano desde la pestaña *Actions*.

## Current baseline note

The connected Supabase project already contained the identity/RBAC baseline migrations:

- `initial_identity_access`
- `identity_access_hardening`

The repository migration `20260314113000_notifications_and_audit_hardening.sql` extends that baseline with:

- richer `audit_logs` metadata for row-level changes
- notification and push-subscription tables
- delivery history plus technical notification logs
- RPC helpers for push subscription registration and notification read state

The repository migration `20260314130000_push_delivery_workflow.sql` completes the operational flow with:

- explicit RLS enablement and grants for notification tables
- RPC helpers to upsert preferences, queue notifications, update delivery state, and track clicks
- support for auditable in-app plus web-push delivery attempts

The repository migration `20260415021000_asi_access_and_opportunity_kinds.sql` aligns the product with ASI member-gated opportunity access:

- tenant kinds for company, ministry, project, field, and generic profile
- opportunity types for employment, project, volunteer, and professional service postings
- user approval, ASI membership, and user subscription gates
- type-specific opportunity stage templates
- RLS changes that remove anonymous access to job discovery tables

The repository migration `20260415031500_asi_type_requirements.sql` adds enforcement for:

- recruiter-request minimum fields by `tenant_kind`
- opportunity minimum metadata by `opportunity_type`
- compensation currency checks when compensated opportunities include amounts

The deployed Edge Function `send-notification` dispatches browser push messages and expects these Supabase project secrets:

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_CONTACT_EMAIL`

The deployed Edge Function `process-email-deliveries` and the hosted Supabase Auth mailer expect the production app URL to stay aligned with the public Netlify surface:

- `APP_URL=https://asi-do.netlify.app`
- Auth `site_url=https://asi-do.netlify.app`
- confirmation callback route `/auth/confirm`

Custom hosted Auth emails now live in `supabase/templates/` and are pushed through `supabase/config.toml`.

Before changing the identity/RBAC schema again, backfill the missing baseline migrations into this folder so fresh environments and the connected project stay fully aligned.
