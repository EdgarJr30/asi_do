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

## Los dos jobs que vigilan la base

### Qué es el drift

Las migraciones son el plano; la base de datos desplegada es el edificio. **Drift** es que alguien movió una pared sin actualizar el plano: un índice creado desde el dashboard, un `GRANT` a mano en el SQL Editor, una policy ajustada en la interfaz. El cambio funciona, pero **ya no hay ningún archivo que lo explique**.

Da igual mientras exista un solo entorno. Importa el día que se levante staging o producción desde las migraciones: todo lo que no está en un archivo **no viaja**, y el entorno nuevo sale incompleto sin que nadie sepa qué falta. También importa para revisión: un `GRANT` hecho a mano no aparece en ningún diff, que es justo la clase de fallo que originó el P0 de las RPC `SECURITY DEFINER`.

Este repositorio **ya tiene drift**: hay objetos en el remoto que no están en `migrations/`. Lo que no está medido es cuánto.

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
