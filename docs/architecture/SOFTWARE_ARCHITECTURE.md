# SOFTWARE_ARCHITECTURE.md

## 1. Purpose

This document defines the recommended software architecture for the **Talent Marketplace SaaS** project.

The system is a **multi-tenant job and talent platform** where:

- companies can create profiles and publish job vacancies
- candidates can create professional profiles, upload CVs, and apply to jobs
- tenant administrators can manage members, roles, permissions, and workflows
- platform administrators can supervise moderation, subscriptions, and global settings

This project is designed to be built with **Codex** and must keep **business logic, technical decisions, and project rules synchronized** as the product evolves.

---

## 2. Recommended Architecture

The recommended architecture for this project is:

# **Modular Monolith, Domain-Oriented, Supabase-First, PWA-First**

This means:

- one main application
- one main codebase
- one shared deployment flow
- one local workflow with preview and production deployments
- clear separation by business domains/modules
- strict RBAC and tenant isolation
- reusable UI system and shared design rules
- ability to scale later without rewriting the foundation

This architecture is recommended because the project needs:

- fast MVP delivery
- strong product coherence
- low operational overhead
- clear business boundaries
- high development speed with Codex
- future scalability without premature infrastructure complexity

The deployment baseline should stay intentionally lean for solo development:

- local development for daily work
- Netlify Deploy Previews for pull request validation
- Netlify production deployment from `main`
- no long-lived staging environment until data, auth, or migration risk justifies it

---

## 3. Architecture Principles

The architecture must always follow these principles:

### 3.1 Modular by domain
The codebase must be organized by business domains, not by technical file type alone.

### 3.2 Supabase-first
Supabase is the default backend platform for:
- authentication
- PostgreSQL database
- row-level security
- file storage
- realtime features
- edge/serverless functions

### 3.3 Mobile-first
All modules, pages, components, and flows must be designed for small screens first, then progressively enhanced for tablet and desktop.

### 3.4 PWA-first
The application must be designed as a real Progressive Web App:
- installable
- responsive
- app-like navigation
- offline-aware
- fast loading
- resilient network behavior

### 3.5 RBAC-first
The platform must be fully role-based from the beginning:
- permissions must control access to modules, screens, actions, and data
- roles must be manageable from inside the application
- the system must support both platform-level and tenant-level roles
- standard users must not self-assign employer access; recruiter conversion is approval-driven

### 3.6 Secure multi-tenancy
The system must isolate data per tenant using a combination of:
- tenant-aware data modeling
- Supabase Row Level Security
- RBAC checks
- safe API/service boundaries

### 3.7 Reusable UI system
The UI must be built from shared reusable components and design tokens, not ad hoc per page.

### 3.8 Anti-regression discipline
Any error explicitly corrected by the product owner/user must become a persistent project rule to prevent repetition.

---

## 4. Why Modular Monolith

At this stage, **microservices are not recommended**.

A modular monolith is better because:

- it reduces infrastructure complexity
- it speeds up iteration
- it makes Codex guidance easier
- it centralizes product logic
- it simplifies authentication and RBAC
- it avoids premature distributed-system problems
- it is easier to maintain while the business model is still evolving

The architecture must therefore start as a modular monolith and only extract services later if truly necessary.

Examples of reasons to extract services later:
- very high traffic on a specific subsystem
- isolated scaling need
- compliance separation
- external public APIs with special demands
- independent engineering teams

Until then, the project stays as a **well-structured modular monolith**.

---

## 5. High-Level System Structure

The product should be understood as four major logical layers:

### 5.1 Presentation Layer
The React 19 application and PWA experience.

Responsibilities:
- UI rendering
- navigation
- client-side form state
- optimistic UX where appropriate
- mobile-first interactions
- permission-aware rendering
- local caching and offline-aware behavior

### 5.2 Application Layer
The orchestration layer for use cases.

Responsibilities:
- use-case coordination
- validation flow orchestration
- interaction between UI and backend services
- module-specific frontend services/hooks
- client-safe permission checks for UX

### 5.3 Domain Layer
The business rules and domain logic.

Responsibilities:
- entities
- value objects
- business rules
- workflow state transitions
- domain services
- permission semantics
- tenant constraints
- recruiter approval workflow that creates a tenant only after company validation
- lifecycle logic for jobs, candidates, companies, applications, and subscriptions

### 5.4 Infrastructure Layer
Supabase and related integrations.

Responsibilities:
- authentication
- database
- storage
- edge functions
- notifications integrations
- analytics integrations
- logging/audit persistence with row-change triggers
- external services

---

## 6. Technology Stack

The software architecture assumes the following baseline stack:

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- i18next + react-i18next for localization
- react-hook-form + zod resolvers for form workflows
- next-themes for persisted theme switching
- sonner for app-level toast feedback
- PWA support
- feature-first folder structure
- reusable shared UI components

### Backend / Platform
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Supabase Row Level Security
- Supabase Edge Functions

### Quality / Tooling
- ESLint
- TypeScript strict mode
- Prettier if adopted by project rules
- testing strategy defined per module
- migration-driven database changes
- documentation updates required with business changes

---

## 7. Repository Organization

The repository should be organized to reflect product boundaries.

Suggested top-level structure:

```txt
talent-marketplace-saas/
  AGENTS.md
  README.md
  docs/
    README.md
    adr/
    architecture/
    checklists/
    domain/
    governance/
    product/
  src/
    app/
    components/
    features/
    hooks/
    lib/
    pages/
    shared/
    styles/
    test/
  supabase/
    migrations/
    seeds/
    policies/
    functions/
  public/
  tests/
    unit/
    integration/
    e2e/
```

### 7.1 `src/features`
This is the most important structural decision.

Every major business domain should live in its own feature folder, for example:

```txt
src/features/
  auth/
  onboarding/
  candidates/
  companies/
  jobs/
  applications/
  pipeline/
  messaging/
  notifications/
  rbac/
  billing/
  admin/
  moderation/
  analytics/
```

Each feature may contain:
- components
- hooks
- services
- schemas
- types
- pages
- utils
- tests

This keeps logic close to the business domain.

### 7.2 `src/components`
Reusable shared UI components that are not specific to one feature:
- buttons
- inputs
- cards
- modals
- dialogs
- typography
- navigation shells
- loaders
- pagination components
- tables/list wrappers

### 7.3 `src/shared`
Shared helpers, constants, guards, utilities, tokens, and cross-domain abstractions.

### 7.4 `supabase/`
Must contain versioned database and backend assets:
- SQL migrations
- seeds
- policies
- functions
- storage conventions
- access patterns documentation if needed

### 7.5 Root rule files
The root rule files remain the primary source of truth for product, architecture, testing, security, and regression behavior.
They must be updated whenever adjacent implementation changes.

---

## 8. Domain Modules

The architecture should be split into the following initial modules.

## 8.1 Identity & Access
Responsibilities:
- authentication
- session handling
- password recovery
- magic links or providers if adopted
- route protection
- permission evaluation
- role assignment
- role management
- user membership by tenant

## 8.2 Tenant / Organization Management
Responsibilities:
- tenant creation
- tenant settings
- tenant memberships
- subscription linkage
- tenant branding
- plan limits
- usage boundaries

## 8.3 Candidate Module
Responsibilities:
- candidate profile
- professional summary
- work experience
- education
- certifications
- skills
- CV upload
- profile completeness
- application history
- saved jobs

## 8.4 Company Module
Responsibilities:
- company profile
- employer branding
- logo and media
- offices/locations
- public company page
- company members
- company-level settings

## 8.5 Jobs Module
Responsibilities:
- job creation
- job publishing
- job draft management
- job expiration
- job visibility
- search filters
- job metadata
- salary visibility options
- remote/hybrid/on-site settings

## 8.6 Applications Module
Responsibilities:
- candidate application flow
- CV/profile submission
- status tracking
- recruiter review
- internal notes
- candidate progression
- rejection reasons
- archived applications

## 8.7 Pipeline / ATS-lite Module
Responsibilities:
- stage management
- kanban/list views
- recruiter actions
- shortlist actions
- assignment to reviewers
- activity timeline
- movement rules between stages

## 8.8 Messaging & Notifications Module
Responsibilities:
- in-app notifications
- email triggers
- status update notifications
- recruiter-candidate communication if enabled
- system alerts
- plan or billing notifications

## 8.9 Billing & Subscription Module
Responsibilities:
- plans
- quotas
- seat limits
- usage checks
- payment status
- subscription upgrades/downgrades

## 8.10 Platform Admin Module
Responsibilities:
- global moderation
- abuse review
- support tooling
- feature flags
- platform-level analytics
- tenant oversight

---

## 9. Multi-Tenant Data Model Strategy

The project must use a **shared database with tenant isolation**.

### 9.1 Core rule
Business records that belong to a tenant must include `tenant_id`.

Examples:
- companies
- company_members
- jobs
- applications
- recruiter_notes
- role_assignments
- billing/subscription records
- plan usage records

### 9.2 Platform records
Some records may be global, not tenant-specific, such as:
- platform roles
- permission catalog
- plan catalog
- system configuration
- moderation taxonomy
- countries/languages catalogs

### 9.3 Isolation
Isolation is enforced with:
- tenant-aware schema design
- Supabase RLS policies
- permission checks
- safe queries and RPC/functions
- no direct trust in client-side filters

---

## 10. RBAC Architecture

RBAC is a foundational architecture concern, not an optional add-on.

The system must support:

### 10.1 Platform-level roles
Examples:
- super_admin
- platform_support
- moderation_admin
- billing_admin

### 10.2 Tenant-level roles
Examples:
- tenant_owner
- tenant_admin
- recruiter_manager
- recruiter
- hiring_reviewer
- company_editor
- company_viewer

### 10.3 Candidate-side capabilities
Candidate permissions may be simpler but still structured:
- manage_profile
- upload_cv
- apply_to_jobs
- save_jobs
- manage_preferences

### 10.4 Permission granularity
Permissions must control:
- module access
- page access
- action access
- record-level operations
- administrative actions
- role management actions

### 10.5 Role creation from the app
The application must support creating and editing custom roles from the UI, according to rules defined by tenant scope and security restrictions.

### 10.6 Enforcement layers
RBAC must be enforced in:
- navigation rendering
- route guards
- component visibility
- action enablement/disablement
- server/backend logic
- database policies where appropriate

---

## 11. Supabase Usage Strategy

Supabase is the backend platform of record.

### 11.1 Use the browser client directly for:
- safe authenticated reads protected by RLS
- normal CRUD flows
- user profile reads/updates
- candidate self-service flows
- simple tenant-scoped operations

### 11.2 Use database functions / RPC for:
- transactional workflows
- multi-table business operations
- state transitions
- complex validations close to the data
- permission-aware write operations
- atomic business events

Examples:
- publish job
- archive job
- submit application
- move application stage
- assign reviewer
- activate subscription limits

### 11.3 Use Edge Functions for:
- third-party integrations
- email sending orchestration
- webhook receivers
- secrets handling
- admin-only secure operations
- AI processing or external APIs
- background-like triggered actions if needed

### 11.4 Never expose privileged credentials in the frontend
Service-role access must never be used in the browser.

---

## 12. State Management Strategy

The architecture should avoid overengineering state.

Recommended approach:
- local component state for local UI concerns
- feature hooks/services for module orchestration
- server state patterns for Supabase-backed data
- shared providers only when truly cross-cutting

State categories:
- UI state
- form state
- server state
- session/auth state
- permission state
- offline/cache-aware state

The project must prefer simple state decisions before adopting heavy abstractions.

---

## 13. PWA Architecture Strategy

The system must behave like a real installable application.

### 13.1 Required PWA foundations
- manifest
- service worker
- icons and installability
- app shell behavior
- offline fallback strategy
- loading placeholders
- resilient navigation on unstable networks

### 13.2 Offline behavior
Not every feature must be fully offline on day one, but the app must be **offline-aware**:
- graceful failures
- retry strategy
- clear empty/offline states
- no broken shell experience
- selected cache strategy for static assets and safe reads

### 13.3 Mobile navigation
Because the app is mobile-first, navigation must prioritize:
- bottom navigation for primary areas where appropriate
- compact headers
- sticky key actions when useful
- large touch targets
- keyboard-safe layouts for forms

---

## 14. UI/UX Architecture Strategy

The UI must be built as a system, not screen by screen.

### 14.1 Design system layers
- design tokens
- typography rules
- spacing rules
- color system
- shared base components
- composed feature patterns
- page templates/layout shells

### 14.2 Reusable components required
At minimum the architecture must encourage reuse for:
- buttons
- badges/tags
- inputs
- selects
- textareas
- cards
- sheets/drawers
- modals/dialogs
- tabs
- empty states
- list items
- navigation items
- pagination
- loading states
- form field wrappers
- table/list wrappers

### 14.3 UI rules
All modules must follow the same:
- typography scale
- spacing rhythm
- border radius strategy
- shadow usage
- card layout logic
- form alignment rules
- content density rules
- feedback states
- interaction states

### 14.4 Color system
The design language must use a modern pastel-oriented palette while preserving:
- readability
- contrast
- role/status clarity
- disabled state clarity
- error/warning/success distinction

---

## 15. Validation and Business Logic Placement

Validation must exist in multiple layers.

### 15.1 Frontend validation
Used for:
- immediate UX feedback
- required fields
- formatting
- basic constraints
- progressive form steps

### 15.2 Backend/domain validation
Used for:
- authorization-sensitive rules
- cross-entity validation
- workflow rules
- subscription limits
- stage movement rules
- job publishing requirements
- role assignment restrictions

### 15.3 Database integrity
Used for:
- foreign keys
- unique constraints
- check constraints
- not null constraints
- indexes
- transactional consistency

No critical rule may exist only in the UI.

---

## 16. Observability and Audit Strategy

The project must include operational visibility from early stages.

### 16.1 Required observability concerns
- error logging
- action logging for critical workflows
- audit logs for admin-sensitive actions
- admin-facing error triage with corrected/pending tracking
- role/permission change logs
- job publication logs
- application stage change logs
- subscription change logs

### 16.2 Audit examples
The system should be able to answer:
- who created a role
- who modified permissions
- who published or archived a job
- who changed a candidate stage
- who invited a company member
- who changed subscription-sensitive settings

---

## 17. File Storage Strategy

Storage must be structured from the beginning.

Suggested storage domains:
- candidate-cvs
- candidate-avatars
- company-logos
- company-media
- job-assets
- admin-review-attachments

Storage rules:
- access must be permission-aware
- tenant isolation must be respected where applicable
- file naming must be deterministic and safe
- sensitive files must not be publicly exposed by default

---

## 18. Search and Filtering Strategy

Search is a core architectural concern for this product.

The platform should be designed to support:
- job search
- company search
- candidate filtering for recruiters
- application filtering by stage/status
- saved search patterns later
- analytics-ready filtering dimensions

Architectural rule:
search/filter logic must be modeled early enough to avoid brittle ad hoc queries later.

---

## 19. Scaling Strategy

The architecture must scale in phases.

### 19.1 Phase 1
Single app, single repo, modular monolith.

### 19.2 Phase 2
Add more structured internal boundaries:
- stronger module contracts
- RPC standardization
- background job patterns if adopted
- analytics/event pipelines if needed

### 19.3 Phase 3
Extract specific services only if justified by real needs.

Possible future extractions:
- search service
- messaging service
- billing service
- AI/matching engine
- analytics pipeline

This extraction must be a later optimization, not a starting condition.

---

## 20. Decision Rules for Codex

Codex must follow these software architecture rules:

1. Prefer extending an existing domain module before creating a new architectural pattern.
2. Do not introduce microservices without explicit documented approval.
3. Do not bypass RBAC or RLS for convenience.
4. Do not create duplicate UI components when a reusable one should exist.
5. Any new module must document:
   - purpose
   - actors
   - permissions
   - main entities
   - business rules
   - UI states
6. Any important business rule must be reflected in:
   - docs
   - implementation
   - validation
   - permissions
7. Any explicit correction from the product owner must become a persistent rule if it reveals a repeated risk.
8. Prefer simple, composable abstractions over heavy theoretical patterns.
9. Keep modules cohesive and low-coupled.
10. Every architectural change with meaningful impact must update this document.
11. Structural, testing, and security guardrail changes must also reconcile `docs/governance/DOCUMENTATION_RULES.md`, `docs/governance/TESTING_RULES.md`, and `docs/governance/SECURITY_RULES.md`.

---

## 21. Final Recommendation

The official software architecture for this project is:

# **Modular Monolith + Domain-Oriented Modules + Supabase-First Backend + RBAC-First Security + Mobile-First PWA**

This architecture gives the project:
- fast delivery
- strong coherence
- safer tenant isolation
- easier Codex collaboration
- maintainable domain boundaries
- future scalability without premature complexity

This is the baseline architecture unless a future ADR explicitly changes it.
