# BUSINESS_RULES.md — Cross-Module Business Rules

## 1. Identity and accounts
1. A user may exist in the platform once and still participate in multiple contexts.
2. Every signup starts as a standard platform user request and must be approved by an admin before the user can access protected product content.
3. A standard user may become tenant-side staff only after a platform admin approves an operator request and validates the company, ministry, project, field, or generic profile.
4. A user may be:
   - a candidate / ASI member
   - a member of one or more tenants
   - a platform admin if granted
5. Candidate identity is global.
6. Tenant staff access is tenant-scoped through memberships.
7. Authentication does not equal authorization; permissions are checked separately.
8. Viewing or applying to protected product opportunities requires approved user status, ASI membership, and an active subscription.
9. Protected content access is granted only when `user_approval_status = approved`, `asi_membership_status in (active, grace_period)`, `user_subscription_status in (trialing, active, grace_period)`, the account itself is active, and any configured membership/subscription expiration has not passed, unless an auditable manual override is still active.
10. Pastor and regional administrator authority is request-based, evidence-backed, scoped to church territory, and separate from final user license activation.
11. Pastors may authorize standard professional users only inside their approved district/church scope, but pastors may not activate licenses, authorize companies, or approve other pastors/regional administrators.
12. Regional administrators may authorize pastors and standard professional users only inside their approved territory, but may not activate licenses or authorize companies by default.
13. Super administrators and platform support users may activate the final license after the required authorization and platform checks pass.

---

## 2. Tenant rules
1. Every ASI company, ministry, project, field, or generic profile workspace is a **tenant**.
2. A tenant is created only after an operator request is approved by an authorized platform admin.
3. Jobs, projects, volunteer opportunities, professional services, hiring pipelines, settings, role assignments, and team data are tenant-scoped.
4. A tenant must have at least one owner or admin-equivalent role.
5. Tenant-sensitive data must never leak across tenants.
6. Plan/feature limits are enforced at tenant level unless otherwise documented.

---

## 3. Candidate rules
1. A candidate profile is reusable across applications.
2. A candidate may update profile data over time.
3. A candidate may upload one or more CV versions, but one may be marked as default.
4. A candidate may apply to many opportunities.
5. A candidate must be able to review application history.
6. Sensitive candidate data must be accessible only to authorized parties.
7. Candidate identity remains global even if the same user later gains recruiter or tenant memberships.
8. Candidate profile completeness must be derived from persisted candidate data so later workflows can trust it.
9. Candidate visibility for recruiter discovery must be opt-in and disabled by default.
10. A candidate may stay hidden from recruiter search and still apply normally to opportunities.
11. Candidate opportunity discovery, saved jobs, and application flows are not public guest experiences; they require approved ASI membership and an active subscription.
12. A future anonymous opportunity preview is allowed as a deliberately limited public surface, but it must expose only non-sensitive summary information and must not include opportunity detail, saved jobs, application submission, candidate discovery, screening questions, or tenant-private workflow data.

---

## 4. Tenant profile rules
1. A company, ministry, project, field, or generic profile belongs to one tenant.
2. A tenant profile cannot become visible in protected opportunity contexts until its operator request has been approved.
3. Only authorized tenant members may edit tenant profile details.
4. Branding assets such as logos must follow file and storage rules.
5. Public tenant profile pages are out of scope for now; any future public exposure must be intentionally approved and documented.
6. A tenant may invite multiple internal members.
7. Tenant member invitations are only valid for users who already registered as standard platform users; MVP does not create tenant invites for unknown emails.
8. Tenant-side candidate sourcing is allowed even when the candidate has not applied yet, but only for visible opt-in profiles.
9. Recruiter requests enforce minimum data by `tenant_kind`: company requires legal name, ministry requires legal name plus operating scope, project requires sponsoring entity plus operating scope, field requires field region plus sponsoring entity, and generic profile requires conversion intent.
10. Tenant ownership does not imply platform authority; tenant owners can manage only their approved tenant scope.

---

## 5. Opportunity rules
1. A job, project, volunteer opportunity, or professional service opportunity belongs to exactly one tenant.
2. An opportunity has a lifecycle:
   - draft
   - published
   - closed
   - archived
3. Only authorized tenant roles may create or publish opportunities.
4. A closed or archived opportunity must not accept new applications.
5. Draft opportunities are not visible to candidates.
6. Opportunities may have screening questions.
7. Salary visibility may be optional based on tenant preference and plan.
8. Expiration behavior must be consistent and documented.
9. Published opportunities must not be fully discoverable by guest users for now; access requires approved user status, ASI membership, and an active subscription.
10. Candidates may save published opportunities without immediately entering the application flow.
11. Opportunity discovery and application submission use `opportunity_type` to distinguish employment, project, volunteer, and professional-service workflows while preserving one shared MVP posting table.
12. Minimum opportunity data is enforced by `opportunity_type`: projects require operating scope plus delivery timeline, volunteering requires operating scope plus engagement model, and professional services require service scope.
13. Only company tenants may create and publish employment job postings.
14. Professional individual users may view and apply to opportunities when approved and licensed, but may not create or publish job postings.
15. A future guest-facing opportunity preview may list limited opportunity cards without detail access, but it must be explicitly designed, documented, moderated, and separated from member-gated opportunity discovery.

---

## 6. Application rules
1. An application is created by one candidate for one opportunity.
2. Duplicate applications for the same candidate and opportunity are controlled by policy.
3. If duplicate applications are blocked, the user must receive clear feedback.
4. Application submission must snapshot relevant candidate-submitted data required for historical integrity.
5. Candidate status visibility must reflect the actual pipeline state or its candidate-facing mapping.
6. Candidate opportunity alerts are owned by the candidate profile and must remain private to that profile owner.
7. Recruiter CSV export must include only fields already authorized by `application:export` and tenant-scoped application visibility.
8. Only authorized tenant members may view or act on applications for their tenant opportunities.
9. Application review and talent sourcing are related but distinct flows.
10. Duplicate applications for the same candidate and opportunity must be blocked at the database layer, not only in the UI.

---

## 7. ATS-lite rules
1. Every application belongs to one current stage.
2. Stage changes create activity history.
3. Notes and ratings must be attributable to the author.
4. Stage transitions must respect permissions.
5. Rejection/hiring actions may require explicit confirmation depending on UX.
6. Important status changes should notify candidates when policy allows.
7. The system should preserve auditability of who moved which candidate and when.
8. Internal ATS notes and ratings are tenant-collaboration artifacts and are never public candidate content.
9. Candidate-facing application status may be derived from the internal stage mapping, but the mapping must stay explicit and deterministic.
10. ATS-lite applies to jobs, projects, volunteering, and professional services, not only employment vacancies.
11. The MVP seeds stage templates per opportunity type, but applications may continue using the existing shared pipeline until type-specific tenant pipelines are explicitly enabled.

---

## 8. RBAC rules
1. RBAC is mandatory across platform and tenant contexts.
2. Permissions drive both backend access and frontend affordances.
3. Tenant owners/admins may create custom tenant roles from the app.
4. Platform roles are separate from tenant roles.
5. System roles may be immutable or partially editable by policy.
6. A role change must be auditable.
7. A permission removed from a role must immediately affect guarded actions, subject to session refresh mechanics.
8. Navigation must not expose protected destinations unless intentionally designed.
9. Candidate directory search and full candidate detail require explicit tenant permissions separate from application review.
10. Internal developer access is a separate operational flag and must not implicitly grant platform or tenant permissions.
11. Pastor, association administrator, and union administrator permissions must be territory-scoped and auditable.
12. Pastor or regional authorization must never replace final license activation or subscription checks.
13. The canonical role taxonomy, scope definitions, and role recommendations live in `docs/domain/ROLE_SCOPE_MODEL.md`.

---

## 8.1 Church territory and validation rules
1. Church territory follows `Union -> Association -> District -> Church`.
2. For the Dominican Republic launch, the union represents the country, and associations such as Sur, Norte, and Sureste belong under that union.
3. Pastor validation requires cedula evidence, names, phone, district, association, and union; churches may be attached when known.
4. Regional administrator validation requires cedula evidence, names, phone, official position, appointment evidence, and union or association scope.
5. The exact MVP form contract is documented in `docs/product/PASTOR_REGIONAL_APPROVAL_FORMS.md`.

---

## 9. Moderation and trust rules
1. Platform admins may flag, suspend, hide, or investigate risky content/entities.
2. Fraudulent or abusive job posts may be closed immediately.
3. Suspended tenants/users/jobs must follow clear state rules.
4. Moderation actions must be auditable.
5. Public trust and candidate safety are prioritized over convenience when conflicts occur.
6. Moderation cases and actions must live as first-class operational records, not ad hoc support notes outside the product.

---

## 10. Notification rules
1. Notifications are event-driven.
2. Notifications should only be sent for meaningful events.
3. Email and in-app notifications should remain consistent in meaning.
4. Users should not be spammed by redundant events.
5. Push notification subscriptions must be explicitly permission-based and revocable by the user.
6. Every notification delivery attempt must persist technical history and logs in the database.
7. Notification preferences must support topic/category, channel, frequency, tenant context, role context, quiet hours, and user timezone as the system matures.
8. Critical notices for security, access, approvals, membership/subscription, compliance, and role/permission changes must not be fully disabled, though limited channel preference may be allowed when safe.
9. Non-critical notifications must be configurable by channel and frequency.
10. High-volume notifications must support digest, grouping, deduplication, and rate limiting.
11. Core workflow notifications must be emitted from durable server-side workflows for application submit, recruiter-request review, membership/access changes, tenant/team changes, candidate-facing status changes, interviews, and moderation/support operations.
12. The canonical notification implementation contract lives in `docs/product/NOTIFICATION_IMPLEMENTATION_PLAN.md`.

---

## 11. Storage and documents
1. CVs, logos, and attachments must be stored in policy-controlled storage.
2. Access to private files must follow role and ownership rules.
3. Public files must be intentionally marked public.
4. Recruiter verification documents are private by default and only readable by the requester and authorized platform reviewers.
5. File naming and path conventions must support auditability and tenant separation where relevant.
6. Avatars, logos, CVs, recruiter verification documents, and any other multimedia or document attachment must be rejected if the file exceeds **5 MB**.
7. Modern web formats such as **SVG** and **WEBP** must be accepted where the use case allows them safely.
8. Multimedia uploads must be optimized internally before storage when the file type supports safe compression or transcoding, especially for raster images.
9. When an upload is rejected, the UI must explain the exact reason, include the detected file size when relevant, and suggest compressing the asset or uploading a file of **5 MB or less**.

---

## 12. Billing / plan rules
1. Tenants may belong to a subscription plan/tier.
2. Feature access may depend on plan.
3. Limits may apply to users, opportunities, applications, storage, or advanced features.
4. Plan enforcement must fail predictably and explain the limitation.
5. Free-plan assumptions must not leak into the core domain model.
6. New tenants must receive a default subscription baseline so plan hooks can operate from day one.
7. User-level ASI membership and subscription status gates protected platform content before tenant-level plan limits are evaluated.

---

## 13. UI/UX business rules
1. UI must follow `docs/governance/UI_UX_RULES.md`.
2. The same type of action must look and behave consistently across modules.
3. Shared components must be reused whenever possible.
4. New component variants require justification before adoption.
5. Mobile-first behavior is required for all primary workflows.
6. Loading, empty, error, success, and disabled states are not optional.
7. Error states must be actionable: the user should understand what failed, why it failed, and what to do next.
8. User-facing platform errors must explain the real business or operational cause only when that cause is actually known from verified evidence. If the platform cannot determine the cause yet, the UI must say so explicitly and must not invent explanations.
9. The public root experience under `/` must behave as an institutional portal, not as an internal control panel.
10. The SaaS product landing under `/platform` must include visible pricing and may include donation-oriented bridge UI as long as the experience clearly stays separate from the institutional portal.
11. Internal test, foundations, and launch-operations tooling must be visually and route-wise isolated from the customer-facing product experience.
12. The product must keep three explicit top-level experiences: institutional portal, SaaS storefront, and authenticated application.
13. The authenticated application experience must stay subdivided into `auth`, `candidate`, `workspace`, and `admin` route surfaces.
14. Candidate-owned authenticated workflows must live under `/candidate/*`; employer tenant workflows must live under `/workspace/*`.
15. The restricted platform console must use `/admin/*` as the canonical route family.
16. Historical aliases such as `/internal/*`, `/applications`, `/onboarding`, `/recruiter-request`, `/jobs/manage`, `/talent`, `/pipeline`, and `/rbac` are not part of the active route contract.

---

## 14. PWA rules
1. The product must remain installable when eligible.
2. Offline or flaky-network conditions must fail gracefully.
3. Users should always receive meaningful feedback when a network-dependent action cannot complete.
4. Cache policy must avoid stale or unsafe cross-tenant data exposure.
5. App-shell and navigation behavior should feel app-like on mobile.

---

## 15. Testing and quality rules
1. Automated verification is part of the product contract.
2. Critical workflows require tests or explicit documented verification.
3. Contract tests should protect required rule files and key architectural structure.
4. RBAC, tenant isolation, and security-sensitive flows require explicit coverage over time.
5. `docs/governance/TESTING_RULES.md` is mandatory guidance for quality decisions.

---

## 16. Security and trust rules
1. Security rules are defined in `docs/governance/SECURITY_RULES.md` and are mandatory.
2. Web security, authorization, storage protection, and auditability are not optional polish items.
3. OSINT may only be used for legitimate moderation, trust, fraud, or safety purposes documented by product policy.
4. OSINT must not be used to infer protected characteristics for hiring decisions.
5. Every meaningful mutation inside the app must leave a durable audit trail with actor, target entity, and change context.
6. Security-sensitive changes must update related tests and documentation in the same task.
7. User-facing errors from meaningful app flows must be durably logged to Supabase so platform admins can investigate and remediate operational issues.
8. Platform admins must have an in-app operational panel where they can review logged errors, identify the affected user when the session is known, and mark whether each error is already corrected or still pending.

---

## 17. Documentation rules
1. Business rules are part of the product contract.
2. Any implementation that changes business behavior must update this file.
3. User corrections become durable rules and must also be recorded in `docs/governance/REGRESSION_RULES.md`.
4. When a rule changes, related documents must be reconciled in the same task.
5. Rule files are living contracts and must self-update when architecture, security, testing, or repository structure changes affect them.
