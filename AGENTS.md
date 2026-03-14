# AGENTS.md — Codex Operating Guide

## Project purpose
Build a **multi-tenant SaaS talent marketplace / job platform** where:
- companies publish vacancies and manage applicants
- candidates create a reusable profile and CV
- hiring teams collaborate through an ATS-lite pipeline
- the platform scales from MVP to a broader recruiting ecosystem

This repository exists so Codex can:
- understand the product and business logic
- generate architecture and code aligned with the roadmap
- keep documentation synchronized with implementation
- prevent regressions through explicit project rules

---

## Canonical stack (must be assumed unless an ADR changes it)
- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **Backend platform:** Supabase
  - Auth
  - Postgres
  - Storage
  - Realtime
  - Edge Functions only when justified
- **App model:** installable **PWA**
- **Architecture style:** multi-tenant, RBAC-first, mobile-first, design-system-first

---

## Non-negotiable product principles
1. **Mobile-first always.** Every screen starts from phone layout first.
2. **PWA-first always.** The app must behave like a true installable product, not only a responsive website.
3. **RBAC everywhere.** Visibility, actions, navigation, data access, and workflows must be permission-aware.
4. **Supabase-first.** Use Supabase capabilities before introducing custom backend complexity.
5. **Multi-tenant by design.** Never hardcode single-company assumptions.
6. **Design system first.** Reuse primitives and tokens. Avoid one-off UI patterns.
7. **Documentation evolves with code.** Logic changes must update the relevant docs in `docs/`.
8. **Rule files are living contracts.** Documentation, testing, and security rule files must update themselves whenever adjacent implementation or repository structure changes.
9. **User corrections become rules.** Any explicit correction from the user becomes a durable rule to avoid future repetition.
10. **No accidental regressions.** Fixes must add safeguards, tests, or documented rules.
11. **MVP discipline.** Prefer the smallest correct implementation that preserves future extensibility.

---

## Required companion docs
These files are part of the source of truth and must be kept aligned:

- `docs/README.md`
- `docs/product/PRD.md`
- `docs/domain/BUSINESS_RULES.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/RBAC_MODEL.md`
- `docs/product/ROADMAP.md`
- `docs/architecture/TECHNICAL_ARCHITECTURE.md`
- `docs/architecture/SOFTWARE_ARCHITECTURE.md`
- `docs/governance/UI_UX_RULES.md`
- `docs/governance/REGRESSION_RULES.md`
- `docs/governance/CODING_RULES.md`
- `docs/governance/DOCUMENTATION_RULES.md`
- `docs/governance/TESTING_RULES.md`
- `docs/governance/SECURITY_RULES.md`
- `docs/product/BENCHMARK.md`

If a code change affects any of those areas, Codex must update the affected documents in the same task.

---

## Product classification
This product belongs to:
- Job board software
- Recruitment platform
- ATS-lite
- Talent marketplace
- Career platform

Working positioning:
> A mobile-first, multi-tenant recruiting SaaS for SMBs and mid-market companies that want to publish jobs, manage applicants, and hire faster — with reusable candidate profiles and a modern PWA experience.

---

## Core user types
### 1. Candidate
Creates a professional profile, uploads CV, searches jobs, applies, and tracks application status.

### 2. Employer tenant owner
Creates company workspace, configures branding, team, roles, and publishes jobs.

### 3. Recruiter / hiring team member
Reviews applicants, moves them through stages, adds notes, rates, and coordinates hiring.

### 4. Platform admin
Moderates companies/jobs, manages plans/features, monitors abuse, and governs platform-level roles.

---

## Product scope
### MVP must support the full core loop
1. Company signs up
2. Company configures tenant/company profile
3. Company publishes vacancy
4. Candidate creates profile and uploads CV
5. Candidate discovers and applies to vacancy
6. Employer reviews candidate
7. Employer moves candidate through ATS-lite stages
8. Candidate sees status updates

### MVP modules
- Auth and onboarding
- Candidate profile + CV
- Company profile
- Job posting
- Job discovery and filters
- Application flow
- ATS-lite pipeline
- Notifications
- Admin moderation
- Billing foundations
- RBAC administration inside the app
- PWA shell and offline-aware foundations

---

## RBAC rules
RBAC is **not optional** and is **not a later enhancement**.

### RBAC requirements
- Support **platform roles** and **tenant roles**
- Support **custom roles created from the app**
- Support **permission-based UI**
- Support **permission-based route guards**
- Support **permission-based data access**
- Support **permission-based action guards**
- Support **system roles** that may be locked or partially immutable
- Support auditability for role/permission changes

### Separation of concern
- **Platform roles** govern cross-platform administration
- **Tenant roles** govern company workspace actions
- **Candidates** are not managed as tenant staff roles
- A user may have multiple memberships and different roles across tenants

---

## PWA rules
This is a **real PWA**, not just “responsive”.

Minimum expectations:
- installable
- manifest
- service worker strategy
- app shell
- offline fallback strategy
- cache policy per asset/data class
- network resilience
- meaningful loading/skeleton states
- mobile navigation patterns
- background sync can be considered later if justified

---

## Supabase rules
Use Supabase as the default platform choice.

### Must use deliberately
- Auth for identity
- Postgres as primary relational store
- RLS for data protection
- Storage for CVs, logos, attachments
- Realtime only where it creates real value
- SQL migrations as source of truth for schema evolution

### Must avoid
- bypassing RLS casually
- mixing authorization logic inconsistently between UI and database
- hiding insecure assumptions behind client checks only
- storing tenant-sensitive documents in ambiguous buckets without policy design

---

## Mobile-first rules
Codex must design and implement from the smallest viewport first.

### Implications
- one-handed usage matters
- dense admin desktop screens must still degrade gracefully to mobile
- tables require mobile alternatives
- filters on mobile use sheets/drawers
- primary actions remain reachable and obvious
- forms default to one column on small screens

---

## Design system rules
All UI must follow `docs/governance/UI_UX_RULES.md`.

Key enforcement:
- use shared tokens
- use shared primitives
- consistent buttons, inputs, cards, tables, dialogs, pagination, badges
- pastel accents with strong readability
- do not invent ad-hoc component variants per module
- all new reusable variants must be documented

---

## Documentation update protocol
Any task that changes logic must also evaluate whether to update:
- PRD
- business rules
- domain model
- RBAC model
- roadmap
- technical architecture
- software architecture
- UI/UX rules
- documentation rules
- testing rules
- security rules
- regression rules

If updated, mention:
- what changed
- why it changed
- what future implementations must now assume

---

## Regression prevention protocol
Whenever the user explicitly corrects:
- naming
- workflow
- scope
- business rule
- UI/UX pattern
- technical decision
- data model assumption
- permission behavior

Codex must:
1. apply the correction
2. record it in `docs/governance/REGRESSION_RULES.md`
3. update affected docs
4. avoid repeating the old pattern in future tasks

---

## Build-order guidance
Codex should generally build in this order:

### Phase 0 — repo foundations
- project scaffolding
- linting/formatting
- env strategy
- Supabase client setup
- routing shell
- PWA setup
- token/theme foundations
- auth shell
- documentation governance baseline
- testing rules baseline
- security rules baseline
- docs baseline

### Phase 1 — identity + tenant foundations
- auth
- tenant creation
- memberships
- RBAC base
- route guards
- base navigation
- audit tables

### Phase 2 — candidate foundations
- candidate profile
- CV upload
- profile completeness
- candidate dashboard

### Phase 3 — employer foundations
- company profile
- hiring team members
- role management UI
- workspace dashboard

### Phase 4 — jobs + applications
- job CRUD
- job listing/discovery
- application submission
- application records
- candidate and employer views

### Phase 5 — ATS-lite
- stages
- stage transitions
- notes
- ratings
- activity history
- notifications

### Phase 6 — moderation, plans, analytics baseline
- admin dashboard
- moderation tools
- feature flags
- quotas/counters
- baseline reporting

---

## Naming rules
Prefer stable domain language:
- tenant
- membership
- platform role
- tenant role
- permission
- candidate profile
- company profile
- job posting
- application
- pipeline stage
- activity log
- subscription plan
- feature flag

Do not introduce synonyms casually.

---

## Quality rules
- Types must be explicit
- Avoid `any`
- Prefer pure domain functions
- Prefer server-validated workflows
- Protect invariants in the database where reasonable
- Add tests for important business flows
- Avoid hidden magic
- Prefer readable code over clever code

---

## What Codex must never assume
- that every user belongs to one tenant only
- that every company has one recruiter only
- that a candidate has one CV forever
- that all jobs are public forever
- that permissions can be inferred from UI role names alone
- that desktop is the primary context
- that “responsive” is enough for PWA quality
- that user corrections are one-time comments instead of durable rules

---

## Definition of done for meaningful feature work
A feature is not done unless:
- business logic is implemented
- UI follows the design system
- permissions are respected
- tenant isolation is preserved
- security posture is preserved
- loading/error/empty states exist
- tests or explicit verification were added where needed
- docs are updated if needed
- regression risks are addressed
