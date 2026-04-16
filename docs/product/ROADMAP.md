# ROADMAP.md — Delivery Plan

## Phase 0 — Foundations
### Goal
Create a clean base for scalable development.

### Deliverables
- React 19 + Vite + TypeScript setup
- Tailwind CSS v4 setup
- PWA baseline
- Supabase client setup
- env/config strategy
- routing shell
- token/theme setup
- documentation governance baseline
- testing rules baseline
- security rules baseline
- core docs in repo
- lint/format/typecheck/test baseline

### Exit criteria
- app boots
- PWA shell exists
- docs are present
- CI-quality local checks run

---

## Phase 1 — Identity, tenants, and RBAC
### Goal
Establish secure multi-tenant access control.

### Deliverables
- auth screens
- standard user registration request
- platform-admin approval for user activation
- pastor and regional administrator validation forms
- scoped pastor/regional authorization workflow
- final license activation gate for super administrator or platform support
- role-scope presets for platform, church-territory, tenant, billing-contact, and professional users
- tenant operator request submission
- platform-admin approval for tenant onboarding
- tenant creation after approval
- canonical route-surface model for `public`, `candidate`, `workspace`, and `admin`
- memberships
- system tenant roles
- custom role CRUD
- permission helpers
- route guards
- audit logging baseline

### Exit criteria
- standard user can submit tenant-operator request
- pastor can submit cedula-backed validation request with union, association, and district scope
- regional administrator can submit cedula plus appointment-backed validation request with union or association scope
- approved pastors and regional administrators can authorize only requests inside their approved territory
- regional administrators authorize pastors and normal professional users inside their territory and may provide territorial endorsement for company/operator requests without finalizing tenant onboarding or license activation
- pastors may provide district/church-scoped endorsement for company/operator requests without finalizing tenant onboarding or license activation
- license activation remains separate from pastor/regional authorization
- only super administrators and platform support receive `license:activate` by default, and any extra activator requires explicit super-administrator assignment
- platform admin can approve or reject tenant-operator request
- user approval, ASI membership, and active subscription gate protected product content
- tenant approval creates tenant, tenant profile, and first owner membership
- `tenant_kind` supports company, ministry, project, field, and generic profile
- members can be invited
- roles can be assigned
- permissions affect UI and backend behavior

---

## Phase 2 — Candidate foundations
### Goal
Enable reusable candidate identity.

### Deliverables
- candidate profile
- experience/education/skills/languages
- CV upload
- profile completeness
- candidate dashboard
- opt-in visibility toggle for tenant candidate discovery
- private `candidate-resumes` storage bucket with self-service access policies

### Exit criteria
- candidate can complete profile
- CV upload works
- profile can be reused later in applications
- completeness score is updated from persisted candidate data, not only from client state
- candidate can choose whether the profile appears in tenant candidate sourcing

---

## Phase 3 — Employer foundations
### Goal
Enable company workspace setup.

### Deliverables
- company profile
- branding
- locations/basic metadata
- team management views
- workspace settings
- membership role reassignment from the app
- member invitation flow for already-registered platform users

### Exit criteria
- tenant can configure company presence
- team/admin screens work with RBAC
- workspace branding assets live in Supabase Storage under tenant-aware policies

---

## Phase 4 — Opportunities and discovery
### Goal
Ship protected opportunity publishing and candidate discovery for approved ASI members.

### Deliverables
- job CRUD
- protected jobs list
- protected job detail
- search/filter
- saved jobs
- basic alerts UI and CRUD
- coordinator-facing candidate directory for opt-in profiles
- coordinator candidate detail view with RBAC-protected full profile access
- opportunity type support for jobs, projects, volunteering, and professional services
- type-specific opportunity stage templates are seeded for later tenant pipeline customization
- shared ATS UI remains the default, with type-aware presets, labels, and optional per-type checklists as the preferred evolution path

### Exit criteria
- authorized tenant can publish an opportunity
- approved ASI member with active subscription can browse opportunities on mobile
- guest users cannot browse protected listing/detail routes
- authorized coordinators can search visible candidates without waiting for an application
- candidates can save published opportunities before the application phase is enabled

### Future consideration
- anonymous opportunity preview may later expose limited public summary cards, but full opportunity detail, saved jobs, applications, screening questions, and coordinator/candidate workflows remain member-gated unless a future phase explicitly changes that contract

---

## Phase 5 — Applications
### Goal
Enable end-to-end application submission.

### Deliverables
- apply flow
- screening questions
- confirmation states
- candidate application history
- employer applicant list
- duplicate prevention at database level
- application snapshots for candidate-facing historical integrity

### Exit criteria
- candidate can apply from mobile
- employer sees submitted applications
- duplicate policy is enforced correctly
- screening answers persist together with the application

---

## Phase 6 — ATS-lite
### Goal
Let teams manage applicants in structured stages.

### Deliverables
- stages
- stage transitions
- notes
- ratings
- activity history
- permission-aware actions
- simple coordinator filters and CSV export for authorized roles
- seeded system stages with tenant override capacity
- candidate-facing status synced from internal stage decisions
- auditable pipeline mutations for moves, notes, and ratings

### Exit criteria
- opportunity team can operate a simple pipeline
- candidate status can be surfaced appropriately
- stage history is auditable
- notes and ratings remain attributable to the author
- pipeline actions stay gated by tenant permissions in UI and Postgres

---

## Phase 7 — Notifications, moderation, plan hooks
### Goal
Operational maturity for launch.

### Deliverables
- in-app notifications
- notification event taxonomy and audience resolver contracts
- email event hooks
- email delivery processor edge function with durable sent/failed status updates
- web push opt-in, subscription, revocation, and click tracking
- notification preference center by topic/category, channel, frequency, tenant context, role context, quiet hours, and timezone
- daily/weekly digest and deduplication rules for high-volume events
- critical notice policy for security, access, approvals, membership/subscription, compliance, and role/permission changes
- moderation dashboard baseline
- plan/limits hooks
- annual membership category catalog based on Organizacional Sin Fines de Lucro, Organizacional Con Fines de Lucro, Profesional Ejecutivo, Propietario Individual, Profesional o Empresario Jubilado, Asociado, Joven Profesional, and Asociado Internacional
- tenant workspace capacity catalog based on `tenant_baseline`, `tenant_essential`, `tenant_growth`, `tenant_scale`, and `tenant_enterprise`
- separate individual membership/subscription gates from tenant workspace plan enforcement
- admin dashboards baseline
- workflow notifications emitted from durable server-side events
- seeded tenant plan catalog plus tenant subscription bootstrap
- platform feature-flag controls for launch operations
- release checklist and mobile smoke coverage
- client-ready public landing with SaaS pricing and donation sections, while job discovery remains member-gated
- admin console isolation for operational and QA-only tooling under `/admin/*`

### Exit criteria
- core workflow notifications exist
- pending email deliveries can be processed into sent/failed states with auditable logs
- non-critical notifications respect user preferences without disabling critical system notices
- high-volume notification types can be grouped or digested without duplicate spam
- push notifications require explicit consent and can be revoked
- moderation actions work
- basic plan enforcement hooks exist
- individual access, tenant plan, tenant kind, and RBAC checks remain separate and explainable
- platform admins can inspect launch-health counters from inside the app
- customer-facing entrypoints no longer expose internal launch tooling

---

## Phase 8 — Post-MVP enhancements
### Candidates
- alerts
- smarter recommendations
- richer profile portability

### Employers
- saved views
- exports
- collaborative notes improvements

### Platform
- analytics
- advanced moderation
- premium features
- AI matching
- integrations

---

## Suggested sprint framing
### Sprint 1
Foundations + PWA + auth shell

### Sprint 2
Tenant-operator approval flow + tenants + memberships + RBAC skeleton

### Sprint 3
Candidate profile + CV

### Sprint 4
Company profile + team management

### Sprint 5
Job posting + protected listing

### Sprint 6
Application flow

### Sprint 7
ATS-lite pipeline

### Sprint 8
Notifications + moderation + polish

---

## Prioritization rules
1. Core hiring loop beats edge cases.
2. Security and isolation beat convenience.
3. Mobile UX beats desktop embellishment.
4. Reusable system patterns beat fast one-off implementations.
5. Documentation updates ship with logic changes.
6. Testing and security guardrails ship with structural changes.
