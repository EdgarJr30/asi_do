# Documentation Guide

This folder contains the canonical Markdown documentation for the repository.

## Canonical layout

### `product/`
- `product/PRD.md`
- `product/ROADMAP.md`
- `product/BENCHMARK.md`
- `product/PASTOR_REGIONAL_APPROVAL_FORMS.md`
- `product/NOTIFICATION_IMPLEMENTATION_PLAN.md`

### `domain/`
- `domain/BUSINESS_RULES.md`
- `domain/DOMAIN_MODEL.md`
- `domain/RBAC_MODEL.md`
- `domain/ROLE_SCOPE_MODEL.md`

### `architecture/`
- `architecture/TECHNICAL_ARCHITECTURE.md`
- `architecture/SOFTWARE_ARCHITECTURE.md`
- `adr/README.md`

### `governance/`
- `governance/INSTITUTIONAL_UI_RULES.md`
- `governance/UI_UX_RULES.md`
- `governance/CODING_RULES.md`
- `governance/DOCUMENTATION_RULES.md`
- `governance/TESTING_RULES.md`
- `governance/SECURITY_RULES.md`
- `governance/REGRESSION_RULES.md`
- `governance/VERSIONING_RULES.md`

### `checklists/`
- `checklists/README.md`
- `checklists/CODEX_TASK_BRIEF.md`

## Local operational READMEs
- `../src/README.md`
- `../src/experiences/README.md`
- `../src/features/README.md`
- `../supabase/README.md`
- `../tests/README.md`

## Placement rules
1. Keep strategic product, domain, architecture, and governance docs inside `docs/`, not in the repository root.
2. Keep folder-specific operational `README.md` files beside the code they explain.
3. Keep the repository root lightweight: `README.md` and `AGENTS.md` are the entrypoint docs.
4. Update this index whenever a canonical Markdown file is added, moved, or removed.

## Canonical product experiences
The modular monolith is organized around three top-level product experiences:
- `institutional` for the ASI portal under `/`
- `storefront` for the product landing, pricing, and member-gated job entry under `/platform`
- `app` for authenticated product usage

Inside `app`, the canonical route surfaces remain:
- `auth` under `/auth/*`
- `candidate` under `/candidate/*`
- `workspace` under `/workspace/*`
- `admin` under `/admin/*`
