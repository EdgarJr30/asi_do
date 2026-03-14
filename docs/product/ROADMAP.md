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
- onboarding split by actor type
- tenant creation
- memberships
- system tenant roles
- custom role CRUD
- permission helpers
- route guards
- audit logging baseline

### Exit criteria
- user can create tenant
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

### Exit criteria
- candidate can complete profile
- CV upload works
- profile can be reused later in applications

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

### Exit criteria
- tenant can configure company presence
- team/admin screens work with RBAC

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

### Exit criteria
- authorized tenant can publish job
- candidate can browse jobs on mobile
- public listing/detail works cleanly

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

### Exit criteria
- candidate can apply from mobile
- employer sees submitted applications
- duplicate policy is enforced correctly

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

### Exit criteria
- hiring team can operate a simple pipeline
- candidate status can be surfaced appropriately
- stage history is auditable

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

### Exit criteria
- core workflow notifications exist
- moderation actions work
- basic plan enforcement hooks exist

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
Tenants + memberships + RBAC skeleton

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
