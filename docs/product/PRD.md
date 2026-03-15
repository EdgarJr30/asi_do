# PRD.md — Product Requirements Document

## 1. Product summary
A **multi-tenant talent marketplace and recruiting SaaS** that allows:
- companies to publish jobs and manage applicants
- candidates to create reusable professional profiles, keep a preloaded CV, and apply quickly
- hiring teams to collaborate through an ATS-lite workflow
- platform admins to govern moderation, plans, and compliance foundations

The product should launch as an **MVP** and scale gradually toward a more complete recruiting ecosystem.

---

## 2. Product vision
Create a modern hiring platform for SMBs and mid-market companies that replaces fragmented hiring via spreadsheets, WhatsApp, email, and generic job boards with one mobile-first, installable, role-aware system.

---

## 3. Problem statement
Many companies still manage recruiting with disconnected tools:
- job ads posted manually in multiple places
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
### Candidate
Needs a reusable profile, easy job discovery, fast applications, and status tracking.

### Employer tenant owner
Needs to request company validation, get recruiter access approved, and then configure workspace, team, roles, jobs, and permissions.

### Recruiter / hiring manager
Needs filtering, review, notes, ratings, and candidate stage movement.

### Platform admin
Needs moderation, plan management, support tools, and governance.

---

## 5. Jobs to be done
### Candidate JTBD
- When I find a relevant job, I want to apply quickly using my existing profile and CV so I do not repeat information.
- When I manage my career, I want a reusable profile and status history so I can apply with confidence.

### Employer JTBD
- When my company opens a position, I want to publish a job and receive structured applications so hiring is organized.
- When my team evaluates applicants, I want permissions, notes, and stages so we can collaborate safely.

### Platform JTBD
- When multiple companies use the system, I need strong tenant isolation and moderation so the platform remains safe and scalable.

---

## 6. Product goals
### Business goals
- Reach MVP quickly without compromising architecture
- Support multi-tenant monetization
- Enable standard-user registration with admin-approved employer onboarding
- Build a foundation for premium plans and advanced recruiting tooling

### User goals
- Reduce application friction for candidates
- Improve hiring visibility and speed for employers
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
- standard user registration for everyone
- recruiter request submission with company validation data
- admin approval flow before employer access is activated
- candidate account flow
- employer workspace creation after approval
- platform admin area
- avatar and document uploads with modern web formats, 5 MB guardrails, and clear validation feedback

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
- CV rejection feedback that explains file-size limits and how to fix the problem

## 8.3 Company workspace
- company profile
- logo and description
- industry, size, locations
- team members
- workspace settings

## 8.4 Role and permission management
- view built-in roles
- create custom roles
- assign permissions
- assign role to tenant members
- permission-aware navigation and actions

## 8.5 Jobs
- create draft job
- publish/unpublish/close job
- job detail page
- search and filters
- saved jobs
- salary visibility toggle
- screening questions

## 8.6 Applications
- fast apply with stored profile
- answer screening questions
- attach CV / cover letter if needed
- application confirmation
- candidate application history
- employer applicant list

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
- new applicant alerts
- stage/status updates

## 8.9 Moderation/admin foundations
- review flagged jobs or tenants
- suspend or warn
- basic platform dashboard
- usage counters / plan hooks

## 8.10 PWA foundations
- installable shell
- manifest
- service worker
- offline fallback
- resilient loading and retry states
- actionable error states with technical logging for admin follow-up

---

## 9. Functional requirements
### FR-1 Authentication
The system must support secure sign-up and sign-in for standard platform users, with employer access granted only after approval.

### FR-2 Recruiter approval and tenant creation
A standard user must be able to submit a recruiter request with company data, and a platform admin must approve that request before the tenant/company workspace is created.

### FR-3 RBAC administration
Tenant owners/admins must be able to manage tenant roles and assign permissions from the app.

### FR-3.1 Admin error operations
Platform admins with the proper permission must be able to review user-facing platform errors from inside the app, inspect their context, and mark whether each issue is already corrected or still pending.

### FR-4 Candidate profile
Candidates must be able to create, edit, and reuse a structured profile.

### FR-5 CV/document management
Candidates must be able to upload and manage CV files, with explicit type and size validation, a maximum size of **5 MB**, and user-facing rejection messages that explain the reason and next step.

### FR-6 Job publishing
Authorized tenant users must be able to create, publish, edit, close, and archive vacancies.

### FR-7 Search/discovery
Candidates must be able to browse/search/filter vacancies.

### FR-8 Application submission
Candidates must be able to submit applications using existing profile data.

### FR-9 Application review
Authorized tenant users must be able to review applications and candidate details.

### FR-10 Pipeline movement
Authorized tenant users must be able to move applications across stages.

### FR-11 Notifications
Relevant actors must receive notifications for major workflow events.

### FR-12 Moderation
Platform admins must be able to take moderation actions on risky or abusive content/entities.

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
- retention of hiring teams

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
- a job can be published publicly
- a candidate can create a full profile and upload CV
- a candidate can apply from mobile without major friction
- a hiring team can review and move applications through stages
- key flows are permission-safe and tenant-safe
- the app is installable as a PWA
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
