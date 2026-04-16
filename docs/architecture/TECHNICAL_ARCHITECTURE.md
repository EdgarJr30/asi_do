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
  experiences/
    institutional/
    storefront/
    app/
  features/
    auth/
    tenants/
    rbac/
    candidate-profile/
    talent/
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
- tenant-operator approval requests before tenant creation
- platform and tenant RBAC tables with auditable assignments
- private storage buckets for user media, company assets, and verification documents

The candidate foundations migration must establish:
- `candidate_profiles` and related candidate section tables
- `candidate-resumes` as a private storage bucket for CV files
- database-driven completeness calculation triggered by candidate row changes

The employer/talent discovery migration must establish:
- employer workspace editing over `company_profiles`
- candidate opt-in discovery fields on `candidate_profiles`
- tenant permissions for candidate directory search and full sourced-profile review
- RPC helpers for coordinator candidate search and full profile detail with audit logging

The jobs/discovery migration must establish:
- `job_postings`, `job_screening_questions`, `saved_jobs`, and `job_alerts`
- authenticated, member-gated read access for published jobs through RLS
- tenant-authorized CRUD for draft/published jobs
- candidate-owned saved-job records and screening-question groundwork for the apply flow
- opportunity typing for jobs, projects, volunteering, and professional services
- `opportunity_stage_templates` so each opportunity type can start with an appropriate candidate-review language without splitting the application model too early

The applications migration must establish:
- `applications` and `application_answers`
- a server-validated `submit_application(...)` RPC for duplicate prevention and screening validation
- candidate-owned application history plus tenant-authorized applicant review
- submission snapshots that preserve key candidate data at apply time

The ATS-lite migration must establish:
- `pipeline_stages`, `application_stage_history`, `application_notes`, and `application_ratings`
- client-side coordinator filters and CSV export over tenant-authorized application datasets
- a server-validated `move_application_stage(...)` RPC for permission-safe stage transitions
- deterministic synchronization between internal stages and candidate-facing `status_public` (legacy column name, not a guest-public status)
- auditable collaboration artifacts for notes and ratings

The platform-ops migration must establish:
- `subscription_plans`, `tenant_subscriptions`, `feature_flags`, `moderation_cases`, and `moderation_actions`
- default tenant subscription bootstrap plus a first plan catalog
- basic plan-limit enforcement hooks for published jobs
- server-side workflow notifications and email-hook deliveries for key lifecycle events
- platform snapshot and moderation RPC helpers for in-app admin operations
- internal-console access helpers that distinguish developer tooling from platform RBAC

The ASI access-gating migration must establish:
- `tenant_kind`, `opportunity_type`, and generalized compensation enums
- user approval, ASI membership, and user subscription status columns
- auditable manual access override fields
- `has_active_asi_access`, `has_active_tenant_subscription`, and `can_publish_opportunity` helper functions
- RLS changes that remove anonymous job discovery
- follow-up validation triggers that enforce required operator-request metadata by `tenant_kind` and required opportunity metadata by `opportunity_type`

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
- user approval, ASI membership, and subscription status
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

### Product experience strategy
Keep the frontend split into three explicit top-level experiences:
- institutional portal routes under `/`
- storefront routes for product landing, pricing, and member-gated job entry under `/platform`
- authenticated app routes for product usage

Inside the authenticated app experience, keep explicit route surfaces:
- auth routes under `/auth/*`
- candidate app routes under `/candidate/*`
- employer workspace routes under `/workspace/*`
- admin console routes for operational tooling under `/admin/*`

The admin console may reuse product primitives, but it must remain route-isolated and must not be the default customer entrypoint.

Implementation note:
- `auth` must use its own route tree and shell, separate from both storefront marketing and authenticated dashboard shells
- candidate and employer routes may share primitives, but they should not share the same navigation chrome by default
- route-owned shells, layouts, and route trees should live under `src/experiences/*`
- domain modules in `src/features/*` should stay reusable across experiences instead of owning top-level route chrome
- legacy route families are not part of the active route contract and must not be reintroduced
- `/admin/bootstrap-owner` remains an explicitly restricted admin-only route for one-time first-platform-owner recovery/bootstrap, not a customer-facing flow

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
- operator request submission failures
- operator approval failures
- tenant creation failures
- candidate profile persistence failures
- candidate resume upload failures
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
- `process-email-deliveries` is the operational Edge Function that drains pending email deliveries and records sent/failed outcomes.
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
- auth-to-profile sync and operator approval bootstrap
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
