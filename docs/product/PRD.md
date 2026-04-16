# PRD.md — Product Requirements Document

## 1. Product summary
A **multi-tenant opportunity and applicant-management SaaS for approved ASI members** that allows:
- companies, ministries, projects, fields, and generic profiles to publish opportunities and manage applicants
- approved ASI members with active subscriptions to create reusable professional profiles, keep a preloaded CV, and apply quickly
- opportunity, project, volunteer, and services teams to collaborate through an ATS-lite workflow
- platform admins to govern moderation, plans, and compliance foundations

The product should launch as an **MVP** and scale gradually toward a more complete opportunity-management ecosystem.

---

## 2. Product vision
Create a modern ASI member platform that replaces fragmented opportunity management via spreadsheets, WhatsApp, email, and generic job boards with one mobile-first, installable, role-aware system.

---

## 3. Problem statement
Many ASI companies, ministries, projects, and fields still manage selection, service, recruiting, or participation workflows with disconnected tools:
- opportunities posted manually in multiple places
- CVs arriving by email or chat
- no structured applicant pipeline
- poor collaboration and auditability
- weak candidate experience
- no reliable permissions model
- no good mobile-native workflow for staff or candidates

Candidates also face friction:
- repeated form filling
- inconsistent company processes
- weak application tracking
- poor mobile experiences
- unclear status updates

---

## 4. Target users
### Candidate / ASI member
Needs an approved account, active ASI membership, reusable profile, protected opportunity discovery, fast applications, and status tracking.

### Tenant owner
Needs to request validation for an ASI company, ministry, project, field, or generic profile, get operator access approved, and then configure workspace, team, roles, opportunities, and permissions.

### Coordinador / revisor / responsable de oportunidad
Needs filtering, review, notes, ratings, and applicant stage movement across jobs, projects, volunteering, and professional services.

### Platform admin
Needs moderation, plan management, support tools, and governance.

### Platform support
Needs admin-console access to support tickets, operational errors, diagnostics, account assistance, and license activation without receiving full super administrator authority.

### Pastor
Needs a simple validated intake flow to prove pastoral identity, attach cedula evidence, declare union/association/district/church scope, and authorize normal professional users only inside that approved scope.

### Regional administrator
Needs a validated intake flow to prove administrative appointment, attach cedula plus official authorization evidence, declare union or association scope, and review pastors or normal professional users only inside that approved territory.

---

## 5. Jobs to be done
### Candidate JTBD
- When I find a relevant opportunity, I want to apply quickly using my existing profile and CV so I do not repeat information.
- When I manage my career, I want a reusable profile and status history so I can apply with confidence.

### Tenant operator JTBD
- When my company, ministry, project, field, or generic profile opens an opportunity, I want to publish it and receive structured applications so selection is organized.
- When my team evaluates applicants, I want permissions, notes, and stages so we can collaborate safely.

### Platform JTBD
- When multiple companies use the system, I need strong tenant isolation and moderation so the platform remains safe and scalable.

---

## 6. Product goals
### Business goals
- Reach MVP quickly without compromising architecture
- Support multi-tenant monetization and ASI membership/subscription gating
- Enable standard-user registration with admin-approved account creation and tenant onboarding
- Build a foundation for premium plans and advanced opportunity-management tooling

### User goals
- Reduce application friction for approved ASI members
- Improve opportunity visibility and selection speed for tenant operators
- Make mobile usage excellent
- Make permissions and team collaboration reliable

### Technical goals
- Supabase-first architecture
- RBAC from day one
- PWA-first delivery
- reusable design system
- documentation synchronized with implementation
- testing and security rules synchronized with implementation

---

## 7. Non-goals for MVP
The MVP should **not** initially include:
- advanced AI scoring as a required dependency
- complex payroll/HRIS features
- full messaging suite
- deep calendar integrations
- referral marketplace
- assessments marketplace
- enterprise SSO/SCIM
- public company reviews unless intentionally prioritized later

---

## 8. MVP feature set
## 8.1 Auth and onboarding
- sign up / sign in
- standard user registration request for everyone
- administrative approval before a user account becomes active
- tenant operator request submission with company, ministry, project, field, or generic-profile validation data
- admin approval flow before tenant operator access is activated
- candidate account flow
- tenant workspace creation after approval
- platform admin area
- pastor validation form with cedula upload, union, association, district, optional churches, and platform-admin approval before scoped pastor authorization is granted
- regional administrator validation form with cedula upload, appointment evidence, union/association scope, and platform-admin approval before scoped regional authorization is granted
- role-scope model that separates super administrator, platform support, platform moderator, readonly platform auditor, regional administrator, pastor administrator, tenant owner, tenant member, tenant billing contact, Joven Profesional candidate-only users, and other individual ASI members
- two-step authorization model where pastors or regional administrators may authorize normal users within scope, but final license activation remains limited to the super administrator or platform support
- avatar and document uploads with modern web formats, 5 MB guardrails, and clear validation feedback
- authenticated app entry redirect that sends employer users to `/workspace` and standard users to `/candidate/profile`

## 8.2 Candidate profile
- personal info
- headline / summary
- work experience
- education
- skills
- languages
- links / portfolio
- CV upload
- profile completeness
- candidate profile dashboard with reusable sections and default CV selection
- candidate-directory visibility toggle that is opt-in by the candidate
- CV rejection feedback that explains file-size limits and how to fix the problem

## 8.3 Tenant workspace
- company, ministry, project, field, or generic profile
- logo and description
- industry, size, locations
- team members
- workspace settings
- role reassignment for tenant memberships from inside the app

## 8.4 Role and permission management
- view built-in roles
- create custom roles
- assign permissions
- assign role to tenant members
- permission-aware navigation and actions

## 8.5 Opportunities
- create draft job
- publish/unpublish/close job
- job detail page
- search and filters
- saved jobs
- salary visibility toggle
- screening questions
- tenant-side candidate directory for visible opt-in profiles
- full candidate profile review from employer side without requiring an application first
- protected `/platform/jobs` listing and `/platform/jobs/:slug` detail routes that require an approved user, ASI membership, and active subscription
- opportunity scope covers jobs, projects, volunteering, and professional services
- opportunity stage templates vary by opportunity type while sharing one MVP application model

## 8.6 Applications
- fast apply with stored profile
- answer screening questions
- attach CV / cover letter if needed
- application confirmation
- candidate application history
- employer applicant list
- duplicate application prevention with clear feedback
- application snapshots that preserve the candidate-facing submission context

## 8.7 ATS-lite
- default stages
- move applicant between stages
- notes
- ratings
- activity history
- simple filters/search

## 8.8 Notifications
- in-app notifications
- email notifications
- web push notifications with explicit opt-in and revocation
- preference center by topic/category, channel, frequency, tenant context, role context, quiet hours, and timezone
- auditable email delivery processing for workflow notifications
- new applicant alerts
- stage/status updates
- tenant-operator request review updates
- membership, access, tenant, opportunity, application, interview, moderation, support, and security alerts
- daily/weekly digest support for high-volume activity
- server-side workflow emission so alerts do not depend on a single client session
- canonical implementation details in `docs/product/NOTIFICATION_IMPLEMENTATION_PLAN.md`

## 8.9 Moderation/admin foundations
- review flagged jobs or tenants
- suspend or warn
- basic platform dashboard
- usage counters / plan hooks
- feature flag toggles for launch operations
- seeded plan catalog with tenant subscription baseline
- commercial model that separates individual ASI membership/subscription from tenant workspace plans
- tenant limits by plan, tenant kind, role, and feature eligibility
- release checklist plus mobile smoke coverage for launch QA

## 8.10 PWA foundations
- installable shell
- manifest
- service worker
- offline fallback
- resilient loading and retry states
- actionable error states with technical logging for admin follow-up
- public product landing with client-ready positioning
- visible SaaS pricing section for commercial review, even before billing is connected
- donation section and donation CTA as UI/UX-only surfaces until payment logic ships
- admin console isolated from the client-facing product experience
- canonical product experiences for `institutional`, `storefront`, and `app`
- authenticated `app` route surfaces for `auth`, `candidate`, `workspace`, and `admin`

---

## 9. Functional requirements
### FR-1 Authentication
The system must support secure sign-up and sign-in for standard platform users, with account activation, content access, and tenant operator access granted only after the required administrative approvals.

### FR-2 Tenant-operator approval and tenant creation
A standard user must be able to submit a tenant operator request with company, ministry, project, field, or generic-profile data, and a platform admin must approve that request before the tenant workspace is created.

### FR-2.1 Pastor and regional administrator validation
Pastors and regional administrators must submit form-backed validation requests before receiving authorization duties. Pastor requests require cedula evidence, names, phone, district, association, and union. Regional administrator requests require cedula evidence, names, phone, official position, appointment evidence, and union or association scope. Approval must grant only scoped authorization permissions and must not activate product access licenses by itself.

### FR-3 RBAC administration
Tenant owners/admins must be able to manage tenant roles and assign permissions from the app.

### FR-3.2 Tenant team invitations
Authorized tenant users must be able to invite already-registered platform users into the workspace, assign an initial role, and revoke pending invites.

### FR-3.1 Admin error operations
Platform admins with the proper permission must be able to review user-facing platform errors from inside the app, inspect their context, and mark whether each issue is already corrected or still pending.

### FR-4 Candidate profile
Candidates must be able to create, edit, and reuse a structured profile with headline, summary, location, desired role, work history, education, skills, languages, and relevant links.

### FR-4.1 Candidate visibility
Candidates must be able to control whether their profile appears in tenant candidate search, and the default state must be opt-in disabled.

### FR-5 CV/document management
Candidates must be able to upload and manage CV files, with explicit type and size validation, a maximum size of **5 MB**, and user-facing rejection messages that explain the reason and next step.

### FR-6 Job publishing
Authorized tenant users must be able to create, publish, edit, close, and archive opportunities across jobs, projects, volunteering, and professional services.

Employment job creation and publishing must be limited to approved company tenants with the required tenant permissions. Joven Profesional users and other individual ASI members may view and apply to opportunities, but may not create or publish job postings unless separately assigned to an approved tenant role that permits it.

### FR-7 Search/discovery
Approved ASI members with active subscriptions must be able to browse/search/filter opportunities.

Future scope may add an anonymous opportunity preview that shows limited public opportunity summaries without exposing full details, saved jobs, applications, screening questions, or candidate/coordinator workflows. Full discovery remains member-gated unless that future surface is intentionally designed and documented.

### FR-7.1 Candidate opportunity alerts
Candidates must be able to save, pause, reactivate, and delete basic opportunity alerts based on discovery filters.

### FR-8 Application submission
Candidates must be able to submit applications using existing profile data.

### FR-9 Application review
Authorized tenant users must be able to review applications and candidate details.

### FR-9.1 Talent sourcing
Authorized tenant users must be able to search visible candidate profiles and open full candidate details outside the application workflow.

### FR-10 Pipeline movement
Authorized tenant users must be able to move applications across stages.

### FR-10.1 ATS collaboration artifacts
Authorized tenant users must be able to add internal notes and ratings to applications, and those artifacts must remain attributable and auditable.

### FR-10.2 ATS export
Authorized tenant users with the export permission must be able to download a CSV of applicants with the minimum launch fields.

### FR-11 Notifications
Relevant actors must receive notifications for major workflow events.

The notification system must support email, in-app, and web push channels; user preferences by topic/category, channel, frequency, tenant context, role context, quiet hours, and timezone; critical notices that cannot be fully disabled; digest/noise-control behavior for high-volume events; and auditable delivery history. The canonical event taxonomy and implementation path live in `docs/product/NOTIFICATION_IMPLEMENTATION_PLAN.md`.

### FR-12 Moderation
Platform admins must be able to take moderation actions on risky or abusive content/entities.

### FR-12.1 Plan operations
Platform admins must be able to inspect tenant plan state, seeded limits, and basic launch counters from inside the application.

The commercial model must separate individual ASI membership/subscription from tenant workspace plans. Individual access gates protected content and applications; tenant plans gate workspace capacity, publishing, ATS features, team seats, candidate sourcing, exports, analytics, and plan limits. Roles and plans must both pass before a tenant-scoped action is allowed. The canonical model lives in `docs/product/COMMERCIAL_PLAN_MODEL.md`.

The individual candidate-only user who applies to opportunities but does not publish opportunities is the `Joven Profesional` membership path with an annual dues amount of $25. Other annual membership categories and dues are documented in the commercial model and must not be replaced by generic "student" or generic paid-user labels.

### FR-13 Error transparency and diagnostics
Meaningful user-facing failures must provide actionable feedback in the UI and also be logged to Supabase so platform admins can investigate the root cause later.

---

## 10. Non-functional requirements
- mobile-first UX
- installable PWA
- strong tenant isolation
- RLS-backed data access
- permission consistency across UI and backend
- consistent design system
- accessible interaction patterns
- good perceived performance
- observability for critical workflows
- auditability for RBAC and major workflow changes

---

## 11. Success metrics
### Product metrics
- candidate profile completion rate
- application conversion rate
- job publish-to-first-applicant time
- employer activation rate
- time-to-first-value for new tenants
- applicant stage movement rate

### UX metrics
- mobile completion rates
- drop-off rate during application flow
- install rate for eligible users
- bounce rate on job detail pages

### Business metrics
- active tenants
- jobs published per active tenant
- applications per published job
- plan conversion from free to paid
- retention of opportunity teams

---

## 12. Risks
- scope creep toward full HR suite too early
- weak permission modeling causing rework
- poor tenant isolation decisions
- mobile usability gaps from desktop-first implementation
- inconsistent design system adoption
- underestimating moderation and trust/safety needs
- building too much AI before core loop works

---

## 13. MVP exit criteria
The MVP can be considered launch-ready when:
- a company can sign up and configure workspace
- tenant roles can be managed from the app
- already-registered users can be invited into a tenant and pending invites can be revoked
- an opportunity can be published for approved ASI members with active membership and subscription
- a candidate can create a full profile and upload CV
- a candidate can save and manage at least one job alert
- a candidate can apply from mobile without major friction
- an opportunity team can review and move applications through stages
- an opportunity team can leave notes and ratings while preserving auditable activity history
- an authorized coordinator can filter pipeline applicants and export the filtered set to CSV
- key flows are permission-safe and tenant-safe
- the app is installable as a PWA
- workflow email deliveries can leave `pending` and land in `sent` or `failed` with technical logs
- loading/error/empty states exist across core screens

---

## 14. Post-MVP opportunities
- interview scheduling
- messaging
- resume parsing
- AI matching
- semantic search
- employer branding pages
- referrals
- CRM/talent pools
- analytics and scorecards
- enterprise controls
