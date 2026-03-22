# AGENTS.md — Codex Operating Guide

## Purpose
Build a mobile-first, multi-tenant recruiting SaaS where:
- companies publish jobs and manage applicants
- candidates maintain a reusable professional profile and CV
- hiring teams collaborate through an ATS-lite workflow
- platform admins govern access, moderation, and plans

This file is intentionally compact. Keep the root guidance lightweight and use `docs/` for detail.

## Canonical stack
- Frontend: React 19 + TypeScript + Vite
- Styling: Tailwind CSS v4
- Backend platform: Supabase
- App model: installable PWA
- Architecture: multi-tenant, RBAC-first, mobile-first, design-system-first
- Package manager and scripts: use `npm` with the committed `package-lock.json`

## Non-negotiable product rules
1. Mobile-first always.
2. PWA-first always.
3. RBAC is foundational, not optional.
4. Supabase is the default platform choice.
5. Multi-tenant assumptions must hold everywhere.
6. Reuse the design system before introducing one-off UI.
7. Documentation must stay aligned with implementation.
8. User corrections become durable rules.
9. Prefer the smallest correct MVP-safe implementation.

## Context-efficiency protocol
Use the minimum context needed to complete the task well.

1. Start from the smallest relevant surface:
- prefer targeted files over broad repo scans
- read only the docs directly related to the change
- avoid loading large architecture or product docs unless the task needs them

2. Keep root instructions compact:
- `AGENTS.md` should hold stable operating rules only
- detailed business, architecture, testing, and security guidance belongs in `docs/`

3. Work with progressive disclosure:
- inspect local `README.md` files near the code first
- expand into canonical docs only when behavior, architecture, or policy is affected
- summarize findings instead of repeatedly re-reading the same long files

4. For small tasks, optimize for narrow scope:
- one bug or UI change should not trigger a full documentation sweep unless behavior changes
- prefer focused validation commands over full-project verification when risk is localized

5. For prompts and task intake, prefer:
- one concrete objective
- exact file or feature scope
- expected output
- constraints only if they materially affect the solution

Reference the low-credit task checklist in `docs/checklists/CODEX_TASK_BRIEF.md`.

## Mandatory source-of-truth docs
Keep these aligned when the task affects their area:
- `docs/README.md`
- `docs/product/PRD.md`
- `docs/product/ROADMAP.md`
- `docs/product/BENCHMARK.md`
- `docs/domain/BUSINESS_RULES.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/RBAC_MODEL.md`
- `docs/architecture/TECHNICAL_ARCHITECTURE.md`
- `docs/architecture/SOFTWARE_ARCHITECTURE.md`
- `docs/governance/UI_UX_RULES.md`
- `docs/governance/CODING_RULES.md`
- `docs/governance/DOCUMENTATION_RULES.md`
- `docs/governance/TESTING_RULES.md`
- `docs/governance/SECURITY_RULES.md`
- `docs/governance/REGRESSION_RULES.md`

## Update triggers
- Product or workflow change: update PRD, business rules, domain model, and RBAC docs as needed.
- Technical or repo structure change: update architecture docs, coding rules, docs index, and README files as needed.
- UI or design-system change: update `docs/governance/UI_UX_RULES.md`.
- Testing or quality change: update `docs/governance/TESTING_RULES.md`.
- Security or permission change: update `docs/governance/SECURITY_RULES.md` and RBAC docs.
- Explicit user correction: update `docs/governance/REGRESSION_RULES.md` in the same task.

## Linear follow-up rule
- If any task ends with pending work of any kind, Codex must create one or more Linear issues automatically without asking for confirmation first.
- Those follow-up issues must be created in the canonical Linear project for this repo and written so the user can later confirm the work was completed.
- This rule applies to every prompt, including implementation work, documentation work, deployments, manual verification, external configuration, or any other unresolved follow-up.

## Core domain language
Prefer these names:
- tenant
- membership
- platform role
- tenant role
- permission
- candidate profile
- company profile
- job posting
- application
- pipeline stage
- activity log
- subscription plan
- feature flag

Do not introduce casual synonyms.

## Guardrails
- Never assume a user belongs to only one tenant.
- Never assume a company has only one recruiter.
- Never assume a candidate will have only one CV forever.
- Never treat desktop as the primary context.
- Never rely on UI checks alone for authorization.
- Never bypass RLS casually.
- Never use `pnpm` or `yarn` commands for this repo unless the repository configuration is explicitly changed first.

## Definition of done
A meaningful feature is not done unless:
- business logic works
- permissions and tenant isolation are preserved
- loading, error, and empty states exist where applicable
- tests or explicit verification were added when risk justifies them
- affected docs were reconciled
- regression risk was reduced, not deferred
