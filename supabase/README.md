# Supabase Structure

Use this folder as the source of truth for backend assets:

```text
supabase/
  migrations/  schema evolution
  policies/    documented policy snippets or helpers when needed
  functions/   edge functions only when justified
  seeds/       local/dev seed data
```

SQL migrations remain authoritative for schema, constraints, helper functions, and RLS policies.

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

The deployed Edge Function `send-notification` dispatches browser push messages and expects these Supabase project secrets:

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_CONTACT_EMAIL`

Before changing the identity/RBAC schema again, backfill the missing baseline migrations into this folder so fresh environments and the connected project stay fully aligned.
