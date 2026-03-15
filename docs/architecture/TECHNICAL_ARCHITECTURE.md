# TECHNICAL_ARCHITECTURE.md — Implementation Architecture

## 1. Stack
- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- i18next + react-i18next
- react-hook-form + @hookform/resolvers
- next-themes
- sonner
- Supabase (Auth, Postgres, Storage, Realtime)
- PWA service worker + manifest strategy
- optional React Query / TanStack Query for server state
- optional Zustand for local UI state only when justified

---

## 2. Architecture principles
1. Keep the frontend modular and domain-driven.
2. Keep database schema and migrations as source of truth.
3. Use Supabase RLS for secure browser access.
4. Keep permission logic explicit and testable.
5. Prefer shared UI primitives and design tokens.
6. Prefer thin presentation components over business logic in views.
7. Treat offline/flaky-network states as a first-class concern.

---

## 3. Suggested app structure
```text
src/
  app/
    router/
    providers/
    layouts/
  features/
    auth/
    tenants/
    rbac/
    candidate-profile/
    companies/
    jobs/
    applications/
    pipeline/
    notifications/
    moderation/
    billing/
  components/
    ui/
    shared/
  lib/
    supabase/
    auth/
    permissions/
    pwa/
    utils/
    validations/
  hooks/
  pages/
  shared/
  styles/
  test/
docs/
  README.md
  product/
  domain/
  architecture/
  governance/
  adr/
  checklists/
tests/
  unit/
  integration/
  e2e/
```

---

## 4. Supabase architecture
### Core services
- Auth for user identity
- Postgres for relational domain data
- Storage for CVs, logos, attachments
- Realtime for targeted events only
- Edge Functions only where server-only behavior is needed and cannot remain in SQL + client safely

### Schema strategy
Use SQL migrations for:
- enums
- tables
- indexes
- constraints
- helper functions
- triggers where justified
- RLS policies

The initial identity migration must establish:
- `public.users` synced from `auth.users`
- recruiter approval requests before tenant creation
- platform and tenant RBAC tables with auditable assignments
- private storage buckets for user media, company assets, and verification documents

### Security strategy
- RLS enabled on exposed tables
- helper functions for permission checks
- least-privilege file access
- audit tables and row-change triggers for sensitive and operational actions
- security posture changes documented in `docs/governance/SECURITY_RULES.md`
- LLM/MCP access to Supabase must use project scoping, development or branch environments, and read-only defaults unless a reviewed exception is required

---

## 5. PWA architecture
### Minimum components
- web app manifest
- first-party service worker strategy
- install prompt handling
- offline fallback route/page
- cache partitioning by asset/data class
- push event handlers and notification-click handling for auditable web push delivery

### Cache strategy guidance
- static assets: long-lived versioned caching
- shell resources: cache-first or stale-while-revalidate depending on risk
- tenant-sensitive dynamic data: network-first or carefully scoped caching
- mutation flows: explicit failure/retry UX, avoid silent data loss
- avoid vulnerable plugin chains for delivery infrastructure when a first-party implementation is sufficient

---

## 6. State strategy
### Server state
Use query/mutation patterns for:
- jobs
- applications
- candidate profile
- tenant data
- RBAC data
- notifications

### Client/UI state
Use local state or lightweight store only for:
- drawers/modals
- temporary form progression
- filters in current session
- install prompt UX
- theme if later needed

Avoid using a client state store as a shadow backend.

---

## 7. Validation strategy
- shared schema validation where practical
- form validation near the boundary
- database constraints for hard invariants
- no reliance on frontend-only validation for security-sensitive behavior
- file uploads must share reusable validation helpers for allowed types, 5 MB maximum size, and actionable rejection messages
- raster image uploads should be optimized before storage when safe compression/transcoding is available

---

## 8. Observability guidance
Track:
- auth failures
- recruiter request submission failures
- recruiter approval failures
- tenant creation failures
- role assignment failures
- job publish failures
- application submission failures
- CV upload failures
- stage change failures
- notification delivery failures
- push subscription registration failures

Add structured logs/events for critical flows where possible.
- meaningful client-side failures should also persist into a Supabase-backed error log so admins can inspect operational issues after the fact

## 8.1 Audit and notification persistence
- `audit_logs` is enriched with request metadata, before/after payloads, and transaction ids.
- All public tables must receive `audit_row_changes` triggers automatically.
- `app_error_logs` stores user-visible client/runtime failures with route, source, severity, user message, and technical metadata for admin review.
- platform admins review those logs from an in-app error inbox and can mark incidents as corrected or reopen them when follow-up is still needed.
- Notification persistence is split into `notifications`, `notification_preferences`, `push_subscriptions`, `notification_deliveries`, and `notification_delivery_logs`.
- Browser subscriptions are registered from the client through SQL RPC helpers, not ad hoc table writes.
- Push dispatch runs through the `send-notification` Edge Function so VAPID secrets stay server-side while delivery status remains in Postgres.
- The current repository migration extends an already-existing remote identity/RBAC baseline. Backfill missing baseline migrations into `supabase/migrations/` before altering that identity layer again.

---

## 9. Testing strategy
### Minimum
- unit tests for domain helpers
- integration tests for permission-sensitive flows
- contract tests for required rule files and key folders
- smoke coverage for core pages
- manual QA checklist for mobile-first PWA behaviors

### Important targets
- tenant isolation
- RBAC helpers
- auth-to-profile sync and recruiter approval bootstrap
- job publishing
- application submission
- stage transitions
- document access rules

---

## 10. Deployment assumptions
- local development remains the primary day-to-day workflow
- GitHub Actions is the source of truth for CI quality gates
- `npm run verify` is the required CI command for pull requests and `main`
- Netlify handles preview deployments for pull requests once the repository is connected
- Netlify publishes production from `main`
- environment variables managed per environment
- Netlify manages build-time frontend environments for preview and production
- Supabase project separation is required once production data exists
- Supabase MCP or other LLM-connected developer tooling must target a non-production scoped project or branch by default
- migrations applied consistently
- storage buckets and policies versioned/documented
- PWA assets versioned

---

## 11. ADR rule
If a major architectural decision changes stack assumptions or patterns, create or update an ADR and reconcile this file.

## 12. Documentation governance
Structural, testing, and security changes must also reconcile:
- `docs/governance/DOCUMENTATION_RULES.md`
- `docs/governance/TESTING_RULES.md`
- `docs/governance/SECURITY_RULES.md`
