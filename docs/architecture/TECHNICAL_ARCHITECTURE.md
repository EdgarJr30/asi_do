# TECHNICAL_ARCHITECTURE.md — Implementation Architecture

## 1. Stack
- React 19
- TypeScript
- Vite
- Tailwind CSS v4
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

### Security strategy
- RLS enabled on exposed tables
- helper functions for permission checks
- least-privilege file access
- audit tables for sensitive actions
- security posture changes documented in `docs/governance/SECURITY_RULES.md`

---

## 5. PWA architecture
### Minimum components
- web app manifest
- first-party service worker strategy
- install prompt handling
- offline fallback route/page
- cache partitioning by asset/data class

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

---

## 8. Observability guidance
Track:
- auth failures
- tenant creation failures
- role assignment failures
- job publish failures
- application submission failures
- CV upload failures
- stage change failures

Add structured logs/events for critical flows where possible.

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
- job publishing
- application submission
- stage transitions
- document access rules

---

## 10. Deployment assumptions
- environment variables managed per environment
- Supabase project separation per environment
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
