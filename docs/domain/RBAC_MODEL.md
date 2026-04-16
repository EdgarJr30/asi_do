# RBAC_MODEL.md — Role-Based Access Control Model

## 1. RBAC philosophy
RBAC is a foundational product capability, not an add-on.

The platform must support:
- **platform-level roles**
- **tenant-level roles**
- **custom roles created from the app**
- **permission-aware UI and backend**
- **auditable role/permission changes**

---

## 2. RBAC layers

## 2.1 Platform RBAC
Used for cross-platform operations such as:
- moderation
- subscription administration
- feature governance
- support operations
- system configuration

### Example platform roles
- Super Administrator
- Platform Support
- Platform Moderator
- Readonly Platform Auditor

---

## 2.2 Tenant RBAC
Used inside an ASI tenant workspace. A tenant may represent a company, ministry, project, field, or generic profile.

### Example system tenant roles
- Tenant Owner
- Tenant Admin
- Opportunity Manager
- Application Reviewer
- Tenant Billing Contact
- Readonly Analyst

### Requirement
Tenant owners/admins must be able to create **custom roles** from the app.

Users do not sign up directly into tenant roles. Everyone enters as a standard platform user request, protected product access starts only after admin approval plus active ASI membership/subscription, and tenant-side access starts only after a platform admin approves an operator request and validates the company, ministry, project, field, or generic profile.

---

## 3. Permission design
Permissions should be atomic and human-readable, following a stable naming convention:

`resource:action`

Examples:
- `tenant:read`
- `tenant:update`
- `company_profile:read`
- `company_profile:update`
- `job:create`
- `job:read`
- `job:update`
- `job:publish`
- `job:close`
- `application:read`
- `application:move_stage`
- `application:add_note`
- `application:rate`
- `role:read`
- `role:create`
- `role:update`
- `role:assign`
- `member:invite`
- `member:remove`
- `moderation:review`
- `billing:read`
- `feature_flag:update`

---

## 4. Suggested permission catalog

## 4.1 Platform permissions
- `platform_dashboard:read`
- `tenant:read`
- `tenant:suspend`
- `tenant:restore`
- `moderation:read`
- `moderation:act`
- `plan:read`
- `plan:update`
- `billing:read`
- `feature_flag:read`
- `feature_flag:update`
- `support:impersonate_limited` *(only if intentionally allowed later)*
- `support_ticket:read`
- `support_ticket:update`
- `app_error_log:read`
- `audit_log:read`
- `user:read`
- `user:update`
- `user:approve`
- `membership:review`
- `subscription:read`
- `license:activate`
- `pastor_authority_request:read`
- `pastor_authority_request:review`
- `regional_authority_request:read`
- `regional_authority_request:review`
- `scoped_user_authorization:read`
- `scoped_user_authorization:review`
- `recruiter_request:read`
- `recruiter_request:review`

Platform roles with `audit_log:read` must also be able to access the in-app operational error inbox backed by `app_error_logs`.
Platform launch-readiness screens must remain split between `platform_dashboard:read`, `moderation:read`, `moderation:act`, `plan:read`, `plan:update`, `feature_flag:read`, and `feature_flag:update` so support, trust, and billing scopes can stay separated.

## 4.2 Tenant permissions
- `workspace:read`
- `workspace:update`
- `company_profile:read`
- `company_profile:update`
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
- `application:export`
- `candidate_directory:read`
- `candidate_profile:read_limited`
- `candidate_profile:read_full`
- `candidate_resume:read`
- `member:invite`
- `member:read`
- `member:update`
- `member:remove`
- `role:read`
- `role:create`
- `role:update`
- `role:delete`
- `role:assign`
- `notification:read`
- `notification:manage`
- `analytics:read`

Protected opportunity discovery and application routes must also check approved user status, ASI membership, and active user subscription status before tenant-level or candidate-profile permissions are considered.
The canonical SQL helper for this prerequisite is `has_active_asi_access(user_id)`. Publishing an opportunity also requires active tenant subscription state through `can_publish_opportunity(tenant_id)`.

---

## 5. Role model rules
1. System roles may ship by default.
2. Some system roles may be locked.
3. Custom roles can be created per tenant.
4. Custom roles can be cloned from existing roles.
5. The first approved operator request for a tenant must bootstrap an initial owner-level tenant role assignment for the requester.
6. Roles without permissions should not be assignable unless explicitly allowed by product policy.
7. Role changes must generate audit logs.
8. Permission changes must be effective consistently across UI and server-side access rules.
9. Notification-management permissions must control who can create notifications, manage push subscriptions by tenant context, and inspect delivery logs.
10. Candidate sourcing permissions must be distinct from application review permissions.
11. Pastor and regional administrator validation flows must collect a form submission and require admin approval before granting elevated or tenant-operational access.
12. Pastor authorization must be scoped to the approved district/churches and may only authorize standard professional users inside that scope.
13. Regional administrator authorization must be scoped to the approved union or association and may review pastors and standard professional users inside that territory.
14. Pastor and regional administrator roles do not authorize company/operator account requests by default.
15. Final license activation is separate from pastor/regional authorization and must remain limited to super administrators and platform support.
16. Only company tenants may receive job creation and publishing permissions for employment job postings.
17. The full role and scope taxonomy is defined in `docs/domain/ROLE_SCOPE_MODEL.md`.

---

## 6. Membership model
A user gets tenant permissions through:
- membership in the tenant
- one or more assigned tenant roles

A user gets platform permissions through:
- one or more platform role assignments

A user can therefore:
- be a candidate globally
- be a recruiter in tenant A
- be a readonly analyst in tenant B
- also be a platform admin if explicitly assigned

The platform also needs a one-time bootstrap path for the very first platform owner so that recruiter approvals can start without manual schema edits.

Internal developer access may also exist as an explicit operational flag on the global user profile. That flag only unlocks the admin console and must not be treated as a substitute for platform RBAC or tenant RBAC.

User approval, ASI membership, and active subscription status are prerequisite gates for protected product content. They do not replace tenant RBAC, and tenant RBAC does not bypass them.

---

## 7. UI behavior rules
1. Navigation items must respect permissions.
2. Buttons/actions must respect permissions.
3. Empty states should not mislead users into thinking a missing permission is a missing feature.
4. Unauthorized deep links must fail gracefully.
5. Permission checks in UI are supportive only; backend and RLS remain authoritative.
6. Admin console routes under `/admin/*` must require either platform-admin authority or the explicit internal-developer flag, and they must stay hidden from the normal customer navigation model.
7. `/platform/jobs*` routes must behave as protected member content for now, not guest-visible public browsing.

---

## 8. Supabase/RLS alignment
RBAC must align with Supabase authorization patterns:
- user identity from Auth
- memberships stored in Postgres
- roles/permissions stored in Postgres
- helper SQL functions may be used for permission checks
- RLS policies must use authenticated context and membership/role data

Recommended helper functions:
- `is_platform_admin()`
- `has_platform_permission(permission_code text)`
- `has_tenant_permission(p_tenant_id uuid, permission_code text)`
- `my_tenant_ids()`
- `bootstrap_first_platform_owner()`
- `review_recruiter_request(p_request_id uuid, p_decision recruiter_request_status, p_review_notes text)`

All permission changes must remain aligned with `docs/governance/SECURITY_RULES.md`, `docs/governance/TESTING_RULES.md`, and `docs/governance/DOCUMENTATION_RULES.md`.

---

## 9. Recommended starter role matrix

| Capability | Tenant Owner | Tenant Admin | Opportunity Manager | Application Reviewer | Readonly Analyst |
|---|---:|---:|---:|---:|---:|
| View workspace | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit company profile | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create employment jobs | ✅ company tenants only | ✅ company tenants only | ✅ company tenants only | ❌ | ❌ |
| Publish/close employment jobs | ✅ company tenants only | ✅ company tenants only | ✅ company tenants only | ❌ | ❌ |
| View applications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Search visible candidates | ✅ | ✅ | ✅ | ❌ | ❌ |
| Open full sourced candidate profile | ✅ | ✅ | ✅ | optional | ❌ |
| Move stage | ✅ | ✅ | ✅ | optional | ❌ |
| Add notes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rate candidates | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invite members | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export applications | ✅ | ✅ | ✅ | ❌ | ❌ |

## 9.1 Recommended platform authority matrix

| Capability | Super Admin | Platform Support | Regional Admin | Pastor Admin |
|---|---:|---:|---:|---:|
| Review pastor requests | ✅ | ❌ | ✅ within territory | ❌ |
| Review regional admin requests | ✅ | ❌ | ❌ | ❌ |
| Authorize professional users | ✅ | ❌ | ✅ within territory | ✅ within district/church scope |
| Authorize company/operator requests | ✅ | ❌ | ❌ by default | ❌ by default |
| Activate final license | ✅ | ✅ | ❌ | ❌ |
| Grant super administrator access | ✅ | ❌ | ❌ | ❌ |

---

## 10. Audit requirements
Audit important RBAC events:
- role created
- role updated
- role deleted
- permission attached/detached
- member invited
- member invite revoked

Launch defaults:
- `member:invite` only covers inviting users who already exist in the platform identity layer.
- `application:export` is the gate for applicant CSV downloads from candidate history and employer workspace pipeline surfaces.
- role assigned to member
- role removed from member
- notification-management grants changed

Store:
- actor
- tenant if relevant
- target entity
- previous value summary
- new value summary
- timestamp

---

## 11. Future-ready considerations
Later the model may expand to:
- permission conditions
- attribute-based rules
- approval workflows
- temporary delegated access
- environment/feature gated permissions

But MVP should stay on clear, explicit RBAC.
