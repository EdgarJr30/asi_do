# TESTING_RULES.md — Quality and Self-Verification Rules

## 1. Purpose
This file defines how the project verifies itself so that business logic, RBAC, multi-tenant isolation, and product rules do not drift silently.

Testing is a required safety layer, not a polish step.

---

## 2. Testing philosophy
1. Critical business flows must be verifiable locally.
2. RBAC, tenant isolation, and security-sensitive logic require explicit tests.
3. The project must include contract tests that validate the existence of required rule files and key architectural folders.
4. When a bug or correction reveals risk, add a regression test whenever practical.
5. Fast feedback matters: lint, typecheck, unit, and integration checks must be runnable by default from the repository root.
6. CI must mirror the same primary verification command used locally so quality gates do not drift.

---

## 3. Required verification layers
### Static verification
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Unit tests
Test pure logic such as:
- permission helpers
- domain formatters/mappers
- lifecycle decisions
- validation helpers

### Integration tests
Test cross-file behavior such as:
- permission-aware navigation
- app shell rendering
- route guards
- feature contracts
- configuration behavior

### Contract and regression tests
Test the repo contract itself:
- required source-of-truth documents exist
- required architectural folders exist
- required CI workflow and deployment config files exist
- required PWA baseline files exist
- removed vulnerable dependency chains are not reintroduced
- critical rule changes are guarded

### E2E smoke tests
E2E coverage becomes mandatory as soon as auth, job application, and ATS flows are interactive.
These tests should prioritize mobile viewport coverage for the core hiring loop.

### Manual QA
Manual checks remain required for:
- installability
- offline states
- flaky network feedback
- touch targets
- mobile layouts

---

## 4. Mandatory scenarios to cover over time
- tenant isolation
- RBAC helpers and route/action guards
- job lifecycle transitions
- application submission
- duplicate application policy
- pipeline stage transitions
- audit-sensitive actions
- storage access rules
- documentation/architecture contract integrity

---

## 5. Repository test organization
Use:

```text
src/test/               shared test setup
tests/unit/             pure logic and helper tests
tests/integration/      app shell, contracts, guards, module interactions
tests/e2e/              browser-level flows once introduced
src/features/*/tests/   feature-local tests when co-location helps
```

---

## 6. Rules for shipping changes
1. Every new module must ship with at least one automated check or a documented reason why it is temporarily blocked.
2. Every change to permissions, tenancy boundaries, security-sensitive workflows, or business invariants must add or update automated verification.
3. Failing tests block completion unless the user explicitly accepts a known failure.
4. If test coverage is intentionally deferred, document the gap in the same task.
5. Test names should describe business intent, not implementation trivia.
6. The `main` branch must stay gated by a successful CI quality run even when preview and production deploys are handled by a hosting platform.

---

## 7. Minimum command contract
The repository must keep these commands meaningful:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `npm run version:plan`
- `npm run verify`

---

## 8. Anti-regression rule
When a production bug, user correction, or architectural safeguard exposes a repeatable risk, add or update:
- an automated test when feasible
- `docs/governance/REGRESSION_RULES.md`
- any impacted source-of-truth document
