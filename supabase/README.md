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
