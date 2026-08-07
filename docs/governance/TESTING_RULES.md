# TESTING_RULES.md — Quality and Self-Verification Rules

## 1. Purpose
This file defines how the project verifies itself so that business logic, RBAC, multi-tenant isolation, and product rules do not drift silently.

Testing is a required safety layer, not a polish step.

---

## 2. Testing philosophy
1. Behavioral work follows Red-Green-Refactor as defined in `TDD_PLAYBOOK.md`.
2. Critical business flows must be verifiable locally.
3. RBAC, tenant isolation, and security-sensitive logic require explicit approval and denial tests.
4. The project must include contract tests that validate required rule files, quality configuration, and key architectural folders.
5. When a bug or correction reveals risk, reproduce it with a failing test before implementing the fix whenever execution is possible.
6. Fast feedback matters: lint, typecheck, unit, integration, and acceptance checks must be runnable from the repository root.
7. CI must mirror the same primary verification command used locally so quality gates do not drift.
8. Coverage is a non-decreasing ratchet; mutation testing proves the strength of assertions in critical pure logic.
9. Launch-readiness gaps must add either browser smoke coverage in `tests/e2e/` or a documented blocker in the same task.
10. WebKit-sensitive motion surfaces must be exercised in the browser family where they regress, not inferred only from Chromium.

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
- migration contracts for identity, tenant-operator approval, storage policies, and notification delivery workflow

### Contract and regression tests
Test the repo contract itself:
- required source-of-truth documents exist
- required architectural folders exist
- required CI workflow and deployment config files exist
- required PWA baseline files exist
- removed vulnerable dependency chains are not reintroduced
- critical rule changes are guarded

### Executable acceptance specifications
Business-readable critical rules live as Spanish Gherkin in `tests/acceptance/` and execute through Cucumber.
Use acceptance specifications for lifecycle, authorization, tenant isolation, billing, moderation, and destructive-action rules that product, QA, or operations must be able to review without reading implementation code.
Keep steps domain-focused and observable; implementation details belong in thin step definitions.
Maintain the shared rule-to-evidence map in `tests/acceptance/README.md`; do not duplicate helpers, rendering details, or other purely technical cases as Gherkin.

### Coverage and mutation tests
- `npm run test:coverage` enforces the repository's non-decreasing coverage baseline.
- `npm run test:mutation` uses Stryker to alter critical pure logic and verifies that the test suite detects every configured mutation.
- The initial permission-guard mutation scope has a 100% breaking threshold.
- Any task that changes critical pure logic outside the configured scope must add that module to the permanent mutation set or document why mutation is not technically meaningful there.
- A surviving mutant blocks completion unless it is proven equivalent and documented at the smallest possible scope.

### E2E smoke tests
E2E coverage becomes mandatory as soon as auth, job application, and ATS flows are interactive.
These tests should prioritize mobile viewport coverage for the core hiring loop.
Minimum smoke coverage now includes auth callback shell, first-run profile setup, tenant-operator request, jobs discovery, applications, and pipeline surfaces.
Institutional motion carousels that depend on looping, autoplay, or gesture negotiation must add browser coverage for the affected engines when their behavior changes, including WebKit desktop/mobile checks, Android-like mobile Chromium checks when touch behavior changes, and assertions that the visible viewport does not expose a blank edge while the loop advances.

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
- auth user mirroring into `public.users`
- tenant-operator request approval and tenant bootstrap
- first platform owner bootstrap
- upload validation for file type, 5 MB size cap, and exact user-facing rejection copy
- candidate profile persistence, completeness updates, and CV storage access
- candidate visibility opt-in and coordinator talent search permission gates
- job lifecycle transitions
- member-gated jobs listing/detail visibility and saved-jobs ownership rules
- user approval, ASI membership, and active subscription gates for protected product content
- schema contract coverage for `tenant_kind`, `opportunity_type`, opportunity stage templates, and anonymous job-access revocation
- application submission
- duplicate application policy
- candidate application history and employer applicant visibility
- pipeline stage transitions
- ATS notes, ratings, and stage-history attribution
- audit-sensitive actions
- operational error logging into Supabase for meaningful client failures
- user-facing error explanation quality for known platform failures, explicit uncertainty when the cause is not yet known, and admin error-state management
- notification delivery history and push subscription ownership rules
- moderation case lifecycle, action side effects, and plan-limit enforcement on published jobs
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
src/experiences/*/      route-owned experience tests when co-location helps
src/features/*/tests/   feature-local tests when co-location helps
```

---

## 6. Rules for shipping changes
1. Every new module must ship with at least one automated check or a documented reason why it is temporarily blocked.
2. Every change to permissions, tenancy boundaries, security-sensitive workflows, or business invariants must add or update automated verification.
3. Database changes that introduce RLS, audit triggers, or notification logging must be verified against Supabase advisors and schema inspection at minimum until SQL regression tests are added.
4. Push notification changes must verify service worker behavior, RPC contracts, and the deployed Edge Function path when the environment is available.
5. File upload changes must verify allowed formats, internal optimization behavior where applicable, 5 MB rejection, and actionable error copy.
6. Error-handling changes must verify both the user-visible state and the Supabase logging path when feasible.
7. Failing tests block completion unless the user explicitly accepts a known failure.
8. If test coverage is intentionally deferred, document the gap in the same task.
9. Test names should describe business intent, not implementation trivia.
10. The `main` branch must stay gated by a successful CI quality run even when preview and production deploys are handled by a hosting platform.
11. Manual release checks must stay codified in `docs/checklists/MVP_RELEASE_CHECKLIST.md`.
12. Pull requests must record the observed Red failure, Green result, refactor status, and risk-specific gauntlet using `.github/PULL_REQUEST_TEMPLATE.md`.
13. Skipped tests and unavailable environments must be reported as unverified, never as passing.

---

## 7. Minimum command contract
The repository must keep these commands meaningful:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `npm run test:acceptance`
- `npm run test:coverage`
- `npm run test:mutation`
- `npm run test:e2e`
- `npm run test:e2e:smoke`
- `npm run version:plan`
- `npm run verify`

---

## 8. Anti-regression rule
When a production bug, user correction, or architectural safeguard exposes a repeatable risk, add or update:
- an automated test when feasible
- `docs/governance/REGRESSION_RULES.md`
- any impacted source-of-truth document

---

## 9. CI parity: a test must not depend on the machine that runs it
A suite that passes locally and fails in CI is not a slower suite; it is a suite that reads something the repository does not control. Two things have already caused it here, and both hid behind misleading failure messages.

### 9.1 Environment: never read Supabase config from `.env.local`
`.env.local` is in `.gitignore`, so it exists on developer machines and never in CI. Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, `getSupabaseConfig()` returns `null` and the app renders a **degraded shell** instead of failing: `/auth/sign-in` shows `El acceso aún no está disponible` in place of the form. The test then reports a missing heading, which reads like broken UI.

Every runner therefore gets its own values, and all three must stay in sync:

| Runner | Where the values come from |
|---|---|
| Vitest (`test`, `test:coverage`, `test:mutation`) | `src/test/env.ts`, imported **first** by `src/test/setup.ts` so the stub lands before `src/shared/config/env.ts` evaluates `import.meta.env` |
| Playwright `webServer` | `webServerEnv()` in `tests/e2e/support/env.ts`, which fills stub credentials only when real ones are absent |
| CI job steps | `env:` blocks in `.github/workflows/ci.yml` |

Rules:
1. Do not make a test's result depend on `.env.local`. If a module reads an environment variable at load time and that variable changes what renders, stub it in `src/test/env.ts`.
2. The `build` that closes `verify` runs in production mode, so it passes through `validateProductionEnv`. Adding a variable to `REQUIRED_PRODUCTION_ENV` without adding it to the verify step's `env:` block aborts the build **in CI only**. Change both in the same task.
3. CI values are deliberately fictitious: CI proves the project compiles, bundles, and renders, not that the deployment is configured. The real guard stays in the Netlify build, which is the only one that publishes and the only one that sees real values.

### 9.2 Timing: budgets live in configuration, not in defaults
`findBy*` and `waitFor` default to one second of wall-clock time, spent by the route's deferred chunk, the first render, and animated step transitions. A CI runner is slower than a laptop, and `--coverage` instruments every module on top of that, so the default turns the slowest tests into machine-dependent coin flips.

Unit tests (vitest + testing-library):

- `configure({ asyncUtilTimeout: 5000 })` in `src/test/setup.ts` sets the async budget for the whole suite.
- `testTimeout: 15000` lives in `vite.config.ts`, so `npm test` and `npm run test:coverage` share it. Do not reintroduce it as a flag on one script only: the script-local value left `npm test` below the async budget, where a slow test died on the vitest timeout before it could report which element it never found.

End-to-end (Playwright): same principle, three budgets, all in `playwright.config.ts`.

- `expect.timeout: 20_000` is the assertion budget. It is not 10s because the CI runner is roughly 2x slower than a laptop (whole suite: 33s local, 70s on CI with 2 workers), and at 10s the slowest assertions became machine-dependent coin flips.
- `use.navigationTimeout: 30_000` bounds `goto` and `waitForURL`. Playwright leaves navigation unbounded by default, so it dies on the test timeout, which reports far worse.
- `timeout: 90_000` per test stays comfortably above both, so a test that runs out of time dies on the assertion that names the missing element, not on the global clock.

Rules:
1. Do not sprinkle per-call timeouts to rescue one slow assertion; raise the shared budget or make the test cheaper. A per-call number is only allowed when the wait is a *different category* from a normal assertion, and then it goes through a named constant with its reason written down — today that is `FRESH_SESSION_CONTENT_TIMEOUT` in `tests/e2e/support/timeouts.ts` (session rehydration + deferred route chunk + a remote query, all after a `goto`). A bare number inline is not allowed: it hides both latency and defects, and it quietly makes the shared budget a lie.
2. Raising a budget is legitimate only for latency. An element that never appears must still fail.
3. A test that only passes on a fast machine is unverified, not passing.
4. Retries are not a budget. `retries: 0` is deliberate: re-running the suite would paper over a flake and a real defect identically.
