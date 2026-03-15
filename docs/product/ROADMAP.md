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
- standard user registration
- recruiter request submission
- platform-admin approval for employer onboarding
- tenant creation after approval
- memberships
- system tenant roles
- custom role CRUD
- permission helpers
- route guards
- audit logging baseline

### Exit criteria
- standard user can submit recruiter request
- platform admin can approve or reject recruiter request
- approval creates tenant, company profile, and first owner membership
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
- opt-in visibility toggle for recruiter discovery
- private `candidate-resumes` storage bucket with self-service access policies

### Exit criteria
- candidate can complete profile
- CV upload works
- profile can be reused later in applications
- completeness score is updated from persisted candidate data, not only from client state
- candidate can choose whether the profile appears in recruiter sourcing

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

### Exit criteria
- tenant can configure company presence
- team/admin screens work with RBAC
- workspace branding assets live in Supabase Storage under tenant-aware policies

---

## Phase 4 — Jobs and discovery
### Goal
Ship public vacancy publishing and candidate discovery.

### Deliverables
- job CRUD
- public jobs list
- public job detail
- search/filter
- saved jobs
- basic alerts groundwork
- recruiter-facing candidate directory for opt-in profiles
- recruiter candidate detail view with RBAC-protected full profile access

### Exit criteria
- authorized tenant can publish job
- candidate can browse jobs on mobile
- public listing/detail works cleanly
- authorized recruiters can search visible candidates without waiting for an application
- candidates can save published jobs before the application phase is enabled

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
- seeded system stages with tenant override capacity
- candidate-facing public status synced from internal stage decisions
- auditable pipeline mutations for moves, notes, and ratings

### Exit criteria
- hiring team can operate a simple pipeline
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
- email event hooks
- moderation dashboard baseline
- plan/limits hooks
- admin dashboards baseline
- workflow notifications emitted from durable server-side events
- seeded free/growth plan catalog plus tenant subscription bootstrap
- platform feature-flag controls for launch operations

### Exit criteria
- core workflow notifications exist
- moderation actions work
- basic plan enforcement hooks exist
- platform admins can inspect launch-health counters from inside the app

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
Recruiter approval flow + tenants + memberships + RBAC skeleton

### Sprint 3
Candidate profile + CV

### Sprint 4
Company profile + team management

### Sprint 5
Job posting + public listing

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
