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
- Platform Owner
- Platform Admin
- Trust & Safety Analyst
- Support Agent
- Billing Admin
- Readonly Ops Analyst

---

## 2.2 Tenant RBAC
Used inside a company workspace.

### Example system tenant roles
- Tenant Owner
- Tenant Admin
- Recruiter
- Hiring Manager
- Reviewer
- Readonly Analyst

### Requirement
Tenant owners/admins must be able to create **custom roles** from the app.

Users do not sign up directly into tenant roles. Everyone enters as a standard platform user, and employer-side access starts only after a platform admin approves a recruiter request and validates the company.

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
- `audit_log:read`
- `user:read`
- `user:update`
- `recruiter_request:read`
- `recruiter_request:review`

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
- `candidate_profile:read_limited`
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

---

## 5. Role model rules
1. System roles may ship by default.
2. Some system roles may be locked.
3. Custom roles can be created per tenant.
4. Custom roles can be cloned from existing roles.
5. The first approved recruiter request for a company must bootstrap an initial owner-level tenant role assignment for the requester.
6. Roles without permissions should not be assignable unless explicitly allowed by product policy.
7. Role changes must generate audit logs.
8. Permission changes must be effective consistently across UI and server-side access rules.
9. Notification-management permissions must control who can create notifications, manage push subscriptions by tenant context, and inspect delivery logs.

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

---

## 7. UI behavior rules
1. Navigation items must respect permissions.
2. Buttons/actions must respect permissions.
3. Empty states should not mislead users into thinking a missing permission is a missing feature.
4. Unauthorized deep links must fail gracefully.
5. Permission checks in UI are supportive only; backend and RLS remain authoritative.

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

| Capability | Tenant Owner | Tenant Admin | Recruiter | Hiring Manager | Reviewer |
|---|---:|---:|---:|---:|---:|
| View workspace | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit company profile | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create jobs | ✅ | ✅ | ✅ | ❌ | ❌ |
| Publish/close jobs | ✅ | ✅ | ✅ | ❌ | ❌ |
| View applications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Move stage | ✅ | ✅ | ✅ | ✅ | ❌ |
| Add notes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rate candidates | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invite members | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export applications | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 10. Audit requirements
Audit important RBAC events:
- role created
- role updated
- role deleted
- permission attached/detached
- member invited
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
