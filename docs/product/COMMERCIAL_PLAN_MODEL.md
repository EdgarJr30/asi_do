# COMMERCIAL_PLAN_MODEL.md - Commercial Plan and Limits Model

## 1. Purpose
This document defines the canonical commercial model for ASI platform access, annual membership categories, tenant workspace plans, limits, and payment responsibility.

The model separates:
- individual ASI annual membership category / user subscription
- tenant workspace capacity plan
- tenant role permissions
- plan limits
- tenant kind eligibility

Roles answer: "What is this user allowed to do?"
Annual membership categories answer: "What ASI membership dues and personal access path applies?"
Tenant workspace plans answer: "Which workspace capacity and features are enabled?"

All relevant checks are required. A role must never bypass plan limits, and a plan must never grant permissions by itself.

---

## 2. Core commercial principles
1. Every user who accesses protected product content must have approved user status, active ASI membership, and active user subscription/license state.
2. Individual membership is personal access. It is not a tenant workspace capacity plan.
3. The candidate-only individual user who applies to opportunities but does not publish opportunities is the `Joven Profesional` membership path.
4. Tenant workspace plans unlock workspace capacity, publishing, ATS usage, collaboration, analytics, and tenant-level limits.
5. Tenant workspace plans do not activate individual user membership by default.
6. Tenant roles do not replace individual access gates.
7. User-level access is checked before tenant-level plan limits for protected product content.
8. Tenant-level publishing and ATS features require both user permission and active tenant subscription state.
9. Tenant Billing Contact can read plan and billing state, but cannot manage opportunity workflows or activate user licenses by default.
10. Free-plan assumptions must not leak into the core domain. A default tenant baseline may exist for provisioning, but public commercial packaging must remain explicit.
11. Plan enforcement must fail predictably with actionable user-facing copy.

---

## 3. Payment responsibility

### Individual user pays or is sponsored for ASI annual membership
Applies to:
- Joven Profesional candidate-only users
- other approved individual ASI membership categories
- candidates
- tenant staff users
- pastors/regional administrators when they need protected product access
- platform users when they use protected member product areas

Purpose:
- identity approval
- ASI membership status
- user subscription/license gate
- protected opportunity discovery
- candidate profile and applications
- ability to participate in tenant workflows when also assigned to a tenant

Important:
- being paid/active as an individual does not allow job posting
- being paid/active as an individual does not create a tenant
- being assigned to a tenant does not remove the individual membership gate
- `Joven Profesional` is the canonical candidate-only individual membership path for users who only apply to opportunities and do not publish opportunities

### Tenant pays for workspace capacity plan
Applies to:
- company tenants
- ministry tenants
- project tenants
- field tenants
- generic profile tenants when approved for a workspace baseline

Purpose:
- workspace availability
- team seats
- opportunity publishing capacity
- ATS pipeline capacity
- candidate sourcing limits
- analytics/export/features
- support or governance options

Paid by:
- Tenant Owner
- Tenant Billing Contact
- another authorized billing operator if a future `billing:update` permission exists

Important:
- a tenant plan unlocks workspace capacity, not user identity approval
- a tenant plan cannot grant candidate access to a user whose individual membership/subscription is inactive
- a tenant plan cannot grant employment posting rights to non-company tenant kinds

### Sponsored seats are future scope
A tenant may later sponsor individual memberships for staff or candidates, but this must be explicit.

Future sponsored-seat rules:
- sponsorship must create or renew user-level access records
- sponsorship must be auditable
- sponsored access must be revocable without deleting the user
- sponsored access must not bypass user approval or church-territory authorization where required

---

## 4. Annual membership categories and dues
The annual membership categories and dues are the source for individual or organization ASI membership qualification.

| Category | Annual dues | Platform meaning |
| --- | ---: | --- |
| Organizacional Sin Fines de Lucro | $250 | Organization membership category; may support tenant approval, but does not replace tenant workspace plan checks |
| Organizacional Con Fines de Lucro | $250 | Organization membership category; may support company tenant approval, but does not replace tenant workspace plan checks |
| Profesional Ejecutivo | $250 | Individual executive/professional membership category; may use protected product access when approved and active |
| Propietario Individual | $200 | Individual business-owner membership category; does not create tenant publishing rights by itself |
| Profesional o Empresario Jubilado | $150 | Individual retired member category; may use protected product access when approved and active |
| Asociado | $150 | Individual associate member category; may use protected product access when approved and active |
| Joven Profesional | $25 | Candidate-only individual path for users who apply to opportunities and do not publish opportunities |
| Asociado Internacional | $250 | International associate organization category; may require additional review before tenant capabilities |

Commercial rule:
- these categories determine ASI membership qualification and dues
- they are not the same thing as tenant workspace capacity plans
- organization-level membership may support tenant approval, but tenant workspace capacity still lives in `tenant_subscriptions`
- `Joven Profesional` must not receive tenant publishing, tenant plan management, or job creation capability unless separately approved into a tenant role under a valid tenant

---

## 5. Tenant workspace capacity tiers
The annual membership categories above are the current public membership dues. Tenant workspace capacity tiers are separate product capacity records used internally or commercially when tenant features are sold or configured. Prices may be configured in `subscription_plans` when finalized.

### `tenant_baseline`
Purpose:
- provisioning state for newly approved tenants
- internal baseline so every tenant has a subscription record

Who gets it:
- every newly approved tenant by default

Typical limits:
- team seats: 1 owner
- published opportunities: 0 or platform-configured trial allowance
- applications: 0 or trial allowance
- candidate sourcing: off
- exports: off
- analytics: basic/off

Rule:
- this is not marketed as a public free plan unless product policy explicitly changes

### `tenant_essential`
Purpose:
- small tenant workspace that needs basic publishing and application review

Best fit:
- small company
- small ministry/project with limited opportunity volume
- early field workspace

Typical limits:
- included team seats: 3
- active opportunities: 3
- applications per month: 50
- candidate sourcing: limited
- exports: off or limited
- analytics: basic
- custom roles: off

### `tenant_growth`
Purpose:
- active organization with regular opportunities, team collaboration, and ATS usage

Best fit:
- growing company tenant
- active ministry/project tenant
- field coordinating several opportunities

Typical limits:
- included team seats: 10
- active opportunities: 10
- applications per month: 250
- candidate sourcing: standard
- exports: enabled for authorized roles
- analytics: standard
- custom roles: limited

### `tenant_scale`
Purpose:
- high-volume organization with advanced opportunity/team needs

Best fit:
- larger company
- field-level coordination
- multi-team ministry/project operations

Typical limits:
- included team seats: 25
- active opportunities: 30
- applications per month: 1,000
- candidate sourcing: expanded
- exports: enabled
- analytics: advanced
- custom roles: enabled
- priority support: optional

### `tenant_enterprise`
Purpose:
- custom plan for negotiated or governance-heavy tenants

Best fit:
- large institutions
- multi-region field/association needs
- special governance, billing, support, or reporting requirements

Typical limits:
- custom seats
- custom active opportunities
- custom application volume
- custom analytics/export/support
- custom billing terms

Rule:
- enterprise changes must be explicit in plan metadata and must not require code forks

---

## 6. Tenant-kind eligibility

### Company tenant
Allowed opportunity types:
- employment
- project
- volunteer
- professional_service

Commercial eligibility:
- may buy any tenant plan
- employment publishing requires company tenant kind, active tenant plan, and user permission

### Ministry tenant
Allowed opportunity types:
- project
- volunteer
- professional_service when enabled

Commercial eligibility:
- may buy tenant plans oriented to ministry operations
- must not publish employment job postings unless policy changes

### Project tenant
Allowed opportunity types:
- project
- volunteer when enabled
- professional_service when enabled

Commercial eligibility:
- may buy limited or project-focused plans
- should usually have lower seat and duration expectations than company tenants

### Field tenant
Allowed opportunity types:
- project
- volunteer
- professional_service
- coordination workflows

Commercial eligibility:
- may need growth, scale, or enterprise plans due to coordination volume
- must not publish employment jobs by default unless policy changes

### Generic profile tenant
Allowed opportunity types:
- none by default

Commercial eligibility:
- receives baseline workspace only
- may convert later into company, ministry, project, or field after review
- cannot publish opportunities until converted or explicitly approved for an allowed tenant kind

---

## 7. Limits by dimension

### User-level limits
Apply to the individual user.

Examples:
- candidate profiles per user: 1 active profile
- default CV: 1
- stored CV versions: plan/configurable, default 3
- saved opportunities: configurable, default 50
- active job alerts: configurable, default 5
- applications: not artificially limited in MVP unless abuse/rate limits require it

Governed by:
- user approval
- ASI membership status
- user subscription/license state
- abuse/rate-limit policy

### Tenant-level limits
Apply to the workspace.

Examples:
- team seats
- active opportunities
- monthly application volume
- candidate sourcing views
- exports
- storage
- custom roles
- analytics level
- notification/digest volume if needed later

Governed by:
- tenant subscription plan
- tenant status
- tenant kind
- feature flags
- moderation/trust state

### Role-level limits
Apply after user and tenant gates pass.

Examples:
- only roles with `job:publish` can publish
- only roles with `application:export` can export
- only roles with billing permissions can view billing
- only roles with `role:assign` can assign tenant roles

Governed by:
- platform role
- tenant membership
- tenant role assignment
- permissions

### Tenant-kind limits
Apply regardless of paid plan.

Examples:
- only company tenants may publish employment jobs
- generic profile tenants cannot publish opportunities by default
- ministry/project/field tenants may publish only allowed non-employment opportunity types when enabled

Governed by:
- `tenant_kind`
- opportunity type policy
- platform approval

---

## 8. Access and enforcement order
Use this order for protected product actions:

1. Authenticated session exists.
2. User account is active.
3. User is approved.
4. User has active ASI membership and active user subscription/license state.
5. Tenant context exists when the action is tenant-scoped.
6. Tenant is approved and active.
7. Tenant subscription is active or in an allowed grace/trial state.
8. Tenant kind allows the requested capability.
9. Tenant plan limit allows the requested volume/feature.
10. User has the required tenant/platform permission.
11. Action-specific validation passes.

If any step fails, the UI and backend should report the specific recoverable reason when known.

---

## 9. Role interaction summary

### Joven Profesional
- pays or receives `Joven Profesional` annual membership access
- is the canonical individual candidate-only user
- can discover/apply when active
- cannot publish opportunities
- cannot manage tenant plan by default
- cannot receive tenant publishing capability without a separate tenant approval and tenant role

### Other individual ASI member categories
- include Profesional Ejecutivo, Propietario Individual, Profesional o Empresario Jubilado, Asociado, and comparable approved individual categories
- can discover/apply when active
- cannot publish opportunities merely because their individual membership is active
- may later participate in a tenant only through a separate tenant membership and role assignment

### Tenant Owner
- may manage workspace and team
- may publish only if tenant kind, tenant plan, and role permissions allow it
- may read tenant plan/billing state

### Tenant Admin
- may operate most workspace workflows
- may read plan state if granted
- does not own billing by default unless policy grants it

### Opportunity Manager
- may create/manage opportunities within allowed limits
- cannot bypass active opportunity limits
- cannot manage billing or roles

### Application Reviewer
- may review applications within granted scope
- cannot create opportunities or change plan limits

### Tenant Billing Contact
- may read billing and plan state
- may receive billing notifications
- cannot publish, review applications, activate user licenses, or mutate billing unless future `billing:update` exists

### Platform Support
- may read subscription/billing state and activate final user licenses when assigned
- does not become tenant owner
- should not mutate tenant plans unless future explicit support billing permission is granted

### Super Administrator
- can govern plan catalog and overrides
- can update plans and platform billing policy
- all overrides must be auditable

---

## 10. MVP plan rules
1. Seed a default `tenant_baseline` plan for every approved tenant.
2. Store plan limits in `subscription_plans.limits_json`.
3. Store current tenant usage in `tenant_subscriptions.usage_snapshot` or computed usage views.
4. Keep user access in user-level membership/subscription fields.
5. Do not merge annual membership dues with tenant workspace capacity plans.
6. Do not expose a public free plan unless the commercial policy explicitly approves it.
7. Build plan-limit failures as product states, not generic errors.
8. Prefer feature flags for staged rollout, not hidden plan behavior.

---

## 11. Future decisions
These are intentionally not final in v1:
- exact public prices for tenant workspace capacity plans
- whether tenants can sponsor user memberships
- whether nonprofit/ministry/project tenants receive discounted tenant workspace capacity plans
- whether field tenants can centrally pay for child tenants
- whether application volume is hard-capped, soft-capped, or billed overage
- whether candidate sourcing views are counted per user or per tenant

Until these are decided, code should keep the model configurable through plan metadata and avoid hardcoded commercial assumptions.
