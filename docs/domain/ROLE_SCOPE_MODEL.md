# ROLE_SCOPE_MODEL.md — Role and Scope Model

## 1. Purpose
This document defines the canonical role taxonomy, authority scope, and MVP permission expectations for ASI.

The product has three role layers:
- platform roles
- church-territory authorization roles
- tenant roles

These layers may overlap for one user, but they must not be collapsed into one generic admin concept.

---

## 2. Core role principles
1. RBAC is permission-driven; role names are presets, not shortcuts around permission checks.
2. License activation is a platform operation granted by default to super administrators and platform support; any extra holder of `license:activate` must receive that permission through explicit super-administrator assignment.
3. Pastor and regional authorization is territorial and does not activate licenses.
4. Tenant ownership is separate from platform authority.
5. Individual ASI members are not tenants and cannot create job postings by individual membership alone.
6. Only company tenants may create employment job postings.
7. Tenant team members receive only the permissions assigned by the tenant owner/admin.
8. Every elevated authorization, license activation, role assignment, and permission change must be auditable.

---

## 3. Platform roles

### Super Administrator
Scope: full platform.

Purpose:
- owns the complete platform authority model
- can approve/reject any platform, church-territory, tenant, moderation, support, or licensing action
- can grant or revoke platform roles
- can activate user licenses

Baseline permissions:
- `platform_dashboard:read`
- `user:read`
- `user:update`
- `user:approve`
- `license:activate`
- `tenant:read`
- `tenant:suspend`
- `tenant:restore`
- `recruiter_request:read`
- `recruiter_request:review`
- `pastor_authority_request:read`
- `pastor_authority_request:review`
- `regional_authority_request:read`
- `regional_authority_request:review`
- `scoped_user_authorization:read`
- `scoped_user_authorization:review`
- `role:read`
- `role:create`
- `role:update`
- `role:delete`
- `role:assign`
- `moderation:read`
- `moderation:act`
- `support_ticket:read`
- `support_ticket:update`
- `app_error_log:read`
- `audit_log:read`
- `plan:read`
- `plan:update`
- `billing:read`
- `feature_flag:read`
- `feature_flag:update`

Must not be confused with:
- tenant owner
- pastor administrator
- regional administrator

### Platform Support
Scope: operational support surfaces across the platform.

Purpose:
- developers or support users who handle tickets, operational errors, diagnostics, and support workflows in the admin console
- can activate licenses when explicitly assigned this role
- can help resolve account access issues without becoming tenant owners

Baseline permissions:
- `platform_dashboard:read`
- `user:read`
- `user:update`
- `license:activate`
- `tenant:read`
- `support_ticket:read`
- `support_ticket:update`
- `app_error_log:read`
- `audit_log:read`
- `subscription:read`
- `billing:read`

Guardrails:
- does not grant super administrator authority
- should not grant role creation/deletion by default
- should not grant moderation actions unless support and trust are intentionally combined later
- should not bypass audit logging

### Platform Moderator
Status: MVP role.

Purpose:
- reviews flagged users, tenants, opportunities, and abusive content
- keeps trust/safety work separate from support and licensing

Baseline permissions:
- `moderation:read`
- `moderation:act`
- `tenant:read`
- `user:read`
- `audit_log:read`

Why it is included:
- support tickets and trust/safety decisions are different workflows
- moderation may need stronger policy controls than ordinary support

### Readonly Platform Auditor
Status: MVP role.

Purpose:
- read-only operational review for leadership, compliance, QA, or external audit support

Baseline permissions:
- `platform_dashboard:read`
- `tenant:read`
- `user:read`
- `audit_log:read`
- `app_error_log:read`

Why it is included:
- not everyone who needs visibility should be able to mutate data

---

## 4. Church-territory authorization roles

### Regional Administrator
Scope: approved union or association.

Purpose:
- authorizes pastors and normal professional users inside the approved territory
- can provide territorial endorsement for company/operator requests inside the approved territory
- supports membership authorization, not license activation

Baseline permissions:
- `pastor_authority_request:read` within territory
- `pastor_authority_request:review` within territory
- `scoped_user_authorization:read` within territory
- `scoped_user_authorization:review` within territory
- `user:read` within territory authorization queues

May:
- approve or reject pastor validation requests within scope
- authorize normal users who will pay membership within scope
- endorse company/operator requests within scope as part of the platform approval flow
- request more information when evidence is incomplete

May not:
- activate licenses
- grant platform support or super administrator roles
- manage tenant roles
- authorize users outside the approved territory
- finalize tenant onboarding or license activation through this role alone
- create job postings through this role alone

### Pastor Administrator
Scope: approved district and optional churches.

Purpose:
- validates and authorizes normal professional users in the pastor's approved district/church scope
- can provide pastoral endorsement for company/operator requests inside the approved district/church scope
- acts as pastoral authorization, not as product administrator

Baseline permissions:
- `scoped_user_authorization:read` within district/church scope
- `scoped_user_authorization:review` within district/church scope
- `user:read` within pastoral authorization queues

May:
- authorize normal users who will pay membership within scope
- endorse company/operator requests within scope as part of the platform approval flow
- request more information when pastoral evidence is incomplete

May not:
- activate licenses
- approve pastors
- approve regional administrators
- finalize tenant onboarding or license activation
- manage tenant roles
- publish job postings
- access admin console modules outside pastoral authorization queues

---

## 5. Tenant roles

### Tenant Owner
Scope: one approved tenant.

Purpose:
- owns the company or organization workspace
- can manage workspace settings, team access, and opportunity publishing when the tenant kind allows it

Baseline permissions:
- `workspace:read`
- `workspace:update`
- `company_profile:read`
- `company_profile:update`
- `member:invite`
- `member:read`
- `member:update`
- `member:remove`
- `role:read`
- `role:create`
- `role:update`
- `role:delete`
- `role:assign`
- `job:create` only when tenant kind allows job creation
- `job:read`
- `job:update`
- `job:publish` only when tenant kind allows job creation
- `job:archive`
- `job:close`
- `application:read`
- `application:move_stage`
- `application:add_note`
- `application:rate`
- `application:export`
- `candidate_directory:read`
- `candidate_profile:read_limited`
- `candidate_profile:read_full`
- `candidate_resume:read`
- `analytics:read`

### Tenant Admin
Scope: one approved tenant.

Purpose:
- operational admin delegated by the owner
- can run most workspace workflows without necessarily owning billing or role governance

Baseline permissions:
- `workspace:read`
- `workspace:update`
- `company_profile:read`
- `company_profile:update`
- `member:invite`
- `member:read`
- `member:update`
- `job:create` only when tenant kind allows job creation
- `job:read`
- `job:update`
- `job:publish` only when tenant kind allows job creation
- `job:archive`
- `job:close`
- `application:read`
- `application:move_stage`
- `application:add_note`
- `application:rate`
- `application:export`
- `candidate_directory:read`
- `candidate_profile:read_limited`
- `candidate_profile:read_full`
- `candidate_resume:read`
- `analytics:read`

### Opportunity Manager
Status: MVP tenant role.

Purpose:
- creates and manages job postings for an approved company tenant without managing team roles
- appears in visible product copy as **Coordinador de oportunidad**

Baseline permissions:
- `workspace:read`
- `company_profile:read`
- `job:create`
- `job:read`
- `job:update`
- `job:publish`
- `job:archive`
- `job:close`
- `application:read`
- `application:move_stage`
- `application:add_note`
- `application:rate`

Why it is included:
- companies often need coordinators who can run opportunities but should not control workspace roles or ownership
- the visible label should emphasize ownership of the opportunity workflow, not a generic recruiter title

### Application Reviewer
Status: MVP tenant role.

Purpose:
- reviews candidates and collaborates in the ATS-lite workflow without creating jobs or managing the workspace
- appears in visible product copy as **Revisor de aplicaciones**

Baseline permissions:
- `workspace:read`
- `job:read`
- `application:read`
- `application:add_note`
- `application:rate`
- `candidate_profile:read_limited`

Optional permissions:
- `application:move_stage`
- `candidate_profile:read_full`
- `candidate_resume:read`

Why it is included:
- companies may invite interviewers, department leads, or assistants who should not own the whole selection process
- the visible label should remain narrow so reviewers are not confused with opportunity owners or tenant admins

### Tenant Billing Contact
Status: MVP tenant role.

Purpose:
- sees invoices, plan state, and billing status for a tenant without managing opportunities or candidates

Baseline permissions:
- `workspace:read`
- `plan:read` for the assigned tenant billing context
- `billing:read` for the assigned tenant billing context

May:
- view tenant plan state, invoices, billing contact details, and payment follow-up status

May not:
- create or publish job postings
- review applications or candidate resumes by default
- manage tenant roles or members
- activate platform user licenses
- mutate billing or plan state unless a future explicit billing-write permission is introduced

Why it is included:
- billing contact is usually not the same person as the opportunity owner

---

## 6. Standard user roles

### Joven Profesional
Scope: own account and candidate profile.

Purpose:
- pays or receives the **Joven Profesional** annual membership category
- is the canonical individual user who only applies to opportunities and does not publish opportunities
- can view protected opportunities and apply with a reusable profile after approval and active membership/license gates pass

May:
- manage own candidate profile and CVs
- view protected opportunities after approval, active membership, and active license
- save opportunities
- create job alerts
- apply to opportunities

May not:
- create job postings
- publish opportunities
- manage a tenant unless separately approved as a tenant owner/member
- manage tenant plans or billing
- authorize other users

### Other Individual ASI Member
Scope: own account and candidate profile unless separately assigned to a tenant.

Purpose:
- covers individual annual membership categories such as Profesional Ejecutivo, Propietario Individual, Profesional o Empresario Jubilado, and Asociado
- can view protected opportunities and apply with a reusable profile after approval and active membership/license gates pass
- may later participate in tenant workflows only through a separate tenant membership and role assignment

May:
- manage own candidate profile and CVs
- view protected opportunities after approval, active membership, and active license
- save opportunities
- create job alerts
- apply to opportunities

May not:
- create job postings merely because individual membership is active
- publish opportunities merely because individual membership is active
- manage a tenant unless separately approved as a tenant owner/member
- manage tenant plans or billing unless separately assigned a tenant billing role
- authorize other users

### Company User Without Tenant Ownership
Scope: assigned tenant membership.

Purpose:
- belongs to a company tenant but does not own the tenant
- receives only delegated tenant permissions

May:
- access workspace modules allowed by assigned tenant role
- perform opportunity workflows only if granted tenant permissions

May not:
- manage roles or members unless explicitly granted
- activate licenses
- act outside the tenant

---

## 7. Tenant-kind rules for job creation
Only company tenants may create employment job postings.

Other tenant kinds may have future opportunity types, but they must not receive `job:create` or `job:publish` for employment jobs unless product policy explicitly changes.

Joven Profesional users and other individual ASI members are never allowed to create job postings merely because they pay membership or hold an approved professional profile.

---

## 8. MVP role set
Ship these role presets first:
- Super Administrator
- Platform Support
- Regional Administrator
- Pastor Administrator
- Tenant Owner
- Tenant Admin
- Opportunity Manager
- Application Reviewer
- Platform Moderator
- Readonly Platform Auditor
- Joven Profesional
- Other Individual ASI Member
- Tenant Billing Contact

---

## 9. Permission matrix

| Capability | Super Admin | Platform Support | Platform Moderator | Readonly Auditor | Regional Admin | Pastor Admin | Tenant Owner | Tenant Admin | Opportunity Manager | Application Reviewer | Tenant Billing Contact | Joven Profesional |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Full platform governance | yes | no | no | no | no | no | no | no | no | no | no | no |
| Support tickets/admin console support | yes | yes | no | read only | no | no | no | no | no | no | no | no |
| Moderate flagged content/entities | yes | no by default | yes | read only | no | no | no | no | no | no | no | no |
| Read audit logs | yes | yes | yes | yes | no | no | no | no | no | no | no | no |
| Activate licenses | yes | yes | no | no | no | no | no | no | no | no | no | no |
| Authorize pastors | yes | no | no | no | yes, within territory | no | no | no | no | no | no | no |
| Authorize normal professional users | yes | no | no | no | yes, within territory | yes, within scope | no | no | no | no | no | no |
| Own tenant workspace | no by default | no | no | no | no | no | yes | no | no | no | no | no |
| Manage tenant team and roles | no by default | no | no | no | no | no | yes | limited if granted | no | no | no | no |
| Read tenant billing/plan state | yes | yes | no | no by default | no | no | yes | optional | no | no | yes | no |
| Create employment job postings | no by default | no | no | no | no | no | yes, company tenants only | yes, company tenants only | yes, company tenants only | no | no | no |
| Review applications | no by default | no | no | no | no | no | yes | yes | yes | yes | no | own applications only |
| View/apply to opportunities | yes if member gate passes | yes if member gate passes | yes if member gate passes | yes if member gate passes | yes if member gate passes | yes if member gate passes | yes if member gate passes | yes if member gate passes | yes if member gate passes | yes if member gate passes | yes if member gate passes | yes, candidate-only |

---

## 10. Naming notes
Use customer-facing labels carefully:
- `Super Administrator` may appear only in internal admin surfaces.
- `Platform Support` is internal staff/support.
- `Regional Administrator` is the territory admin label.
- `Pastor Administrator` is the scoped pastoral authorization label.
- `Platform Moderator` is an internal trust/safety label.
- `Readonly Platform Auditor` is an internal read-only governance label.
- `Tenant Owner`, `Tenant Admin`, `Opportunity Manager`, `Application Reviewer`, and `Tenant Billing Contact` are internal tenant-side operational role labels.
- Visible product language should use `Responsable de oportunidad` for the accountable tenant-side owner of a published opportunity, `Coordinador de oportunidad` for users who create/manage opportunities and move applicants, and `Revisor de aplicaciones` for users who review, rate, comment, or optionally move candidates without owning the full opportunity.
- Avoid `recruiter` and `hiring manager` in visible product copy. They may remain in technical identifiers such as legacy permission codes, routes, table names, RPC names, or migration history until a deliberate schema/refactor task renames them safely.
- `Joven Profesional` is the canonical customer-facing role/category for an individual user who only applies to opportunities and does not publish opportunities.
- `Other Individual ASI Member` covers other individual annual membership categories and is not a tenant or platform admin role by itself.
