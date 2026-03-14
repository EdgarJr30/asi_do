# Documentation Guide

This folder contains the canonical Markdown documentation for the repository.

## Canonical layout

### `product/`
- `product/PRD.md`
- `product/ROADMAP.md`
- `product/BENCHMARK.md`

### `domain/`
- `domain/BUSINESS_RULES.md`
- `domain/DOMAIN_MODEL.md`
- `domain/RBAC_MODEL.md`

### `architecture/`
- `architecture/TECHNICAL_ARCHITECTURE.md`
- `architecture/SOFTWARE_ARCHITECTURE.md`
- `adr/README.md`

### `governance/`
- `governance/UI_UX_RULES.md`
- `governance/CODING_RULES.md`
- `governance/DOCUMENTATION_RULES.md`
- `governance/TESTING_RULES.md`
- `governance/SECURITY_RULES.md`
- `governance/REGRESSION_RULES.md`

### `checklists/`
- `checklists/README.md`

## Local operational READMEs
- `../src/README.md`
- `../src/features/README.md`
- `../supabase/README.md`
- `../tests/README.md`

## Placement rules
1. Keep strategic product, domain, architecture, and governance docs inside `docs/`, not in the repository root.
2. Keep folder-specific operational `README.md` files beside the code they explain.
3. Keep the repository root lightweight: `README.md` and `AGENTS.md` are the entrypoint docs.
4. Update this index whenever a canonical Markdown file is added, moved, or removed.
