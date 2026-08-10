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
- `npm run test:e2e:recovery`
- `npm run test:functions`
- `npm run test:probes`
- `npm run test:probes:catalogo`
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
A suite that passes locally and fails in CI is not a slower suite; it is a suite that reads something the repository does not control. Three things have already caused it here, and all three hid behind misleading failure messages.

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

### 9.3 Network: an unmocked query is a coin flip, not a background detail

`src/test/env.ts` gives the suite a *plausible* Supabase URL, so `supabase` is non-null and every unmocked data call becomes a **real outbound request** to a host that does not exist. Nothing fails loudly. The request simply resolves or rejects at an unpredictable moment, and whichever render happens to be on screen when the assertion runs is the one that gets asserted.

That produced the intermittent failure in `tests/integration/dashboard-failure-states.test.tsx`. The file mocked `listMyApplications` but left the fourth metric — *Vacantes para ti*, fed by `listPublicJobs` — talking to the network. When that request failed inside the assertion window, the metric flipped to its failed state and rendered one extra `aria-label="Dato no disponible"`:

| Test | Asserts | Saw when the network lost the race |
|---|---|---|
| `las métricas no muestran un 0 que miente…` | exactly 3 unavailable | 4 |
| `las métricas sí muestran 0 cuando el 0 es verdad` | none unavailable | 1 |

Measured before the fix: **1 failure in 14 full-suite runs**, and it surfaced mostly inside `npm run verify` — a busier machine shifts the timing, which is exactly why it looked like "the suite is flaky under load" rather than "this test never controlled its inputs".

Rules:
1. A test that renders a component must mock **every** data source that component reaches, not only the one the test is about. The others are not background: they are inputs, and an uncontrolled input is a random variable.
2. A double must return the **shape** the caller destructures. `listPublicJobs` returns `{ jobs, savedJobIds }` and the page reads `data?.jobs.length`; a `[]` double crashes the whole page and the resulting empty DOM says nothing about why.
3. Waiting for "at least one" and then asserting "exactly N" is the same defect wearing a different hat — see §10.2. Assert the terminal count *inside* the wait.

---

## 10. An assertion must be able to explain its own failure
A test that blocks the branch without saying what it saw costs more than it protects. The smoke asserted `getByText('Acceso restringido')` on `/workspace/pipeline` and reported `element(s) not found` from CI. That single message is equally compatible with four different endings — the app stayed on the platform loader, it went to `/auth/sign-in`, the onboarding gate diverted it to `/account/profile`, or the membership gate diverted it to `/account/membership` — and none of them is the authorization defect the test claims to guard. The trace existed, but nobody can read a trace from a failure message, and the local run passed.

Strictness is not the problem to solve; blindness is. These rules make a failure name its cause without weakening what is verified.

### 10.1 Assert the state, not the copy
Product copy is rewritten constantly and is the least stable thing on screen. A test about **authorization** must not break because a heading changed, and must not pass because an unrelated screen happens to contain the same words.

- Screens that represent a state publish that state as data: `SurfaceStatusPage` carries `data-testid="surface-status"` with `data-surface` and `data-kind`, and `PageLoader` carries `data-testid="page-loader"`.
- Prefer, in order: a role + accessible name (`getByRole('heading', { level: 1, name })`), then a `data-testid` that names a *state*, then text. Loose `getByText` on a decorative label — an eyebrow, a badge, a chip — is the weakest option available and must not carry the point of a test.
- Copy is still product, so it can still be asserted — as its own separate assertion. When it changes, what fails is a copy test, not the authorization test next to it.
- A `data-testid` is added to express a contract the DOM does not otherwise expose. It is not a shortcut around an accessible name that already exists.

### 10.2 Wait for the terminal state, not for a number
An assertion that races a client-side redirect times out on the budget and blames the element. Wait for the app to *finish*, then assert what it finished as.

- `page.getByTestId('page-loader')` is the "still working" signal. Waiting for it to disappear is a state wait; it fails fast and honestly when the app is stuck, instead of consuming the full budget.
- `role="status"` cannot be used for this: the onboarding wizard keeps a permanent one, so the count never reaches zero.
- Signing in is not finished when the URL changes. `sign-in-page.tsx` picks the destination client-side *after* hydrating session, profile, and permissions, so a `goto` fired inside that window races a navigation that has not happened yet. Serving the production build makes the race audible (`Navigation to "/workspace/pipeline" is interrupted by another navigation to "/account"`); under `vite dev`, which is how CI runs, the same race is silent — the pending navigation simply wins afterwards and the assertion then waits on the wrong screen until the budget runs out. Call `waitForAppSettled` from `tests/e2e/support/guards.ts` after any sign-in, before navigating anywhere else.
- Do not follow a `goto` immediately with an assertion on a route the app may still redirect away from. Either wait for the terminal state first, or navigate with `waitUntil: 'commit'` so a legitimate client-side redirect cannot report as `Navigation ... is interrupted by another navigation`.

### 10.3 A failed guard assertion must report where the app actually went
Use `expectSurfaceStatus` from `tests/e2e/support/guards.ts` for anything that asserts a guard blocked a route. On failure it raises the real URL, the visible `h1`, and whether the platform was still loading — which separates "authorization is broken" from "the session never hydrated" in the CI log itself, with no trace download and no local re-run.

New helpers that wait for a protected surface follow the same shape: catch the timeout, attach `describeCurrentScreen(page)`, rethrow. A helper that swallows context and re-raises a bare Playwright error is not acceptable.

### 10.4 What this does *not* license
1. No retries. §9.2 rule 4 stands unchanged: a flake and a defect must not be made to look alike.
2. No `expect.soft` on business invariants, no `try/catch` that downgrades a failure to a warning, and no assertion deleted because it is inconvenient. Diagnosis is added; verification is not removed.
3. Widening a matcher to make it pass — `/Acceso|Restringido|No puedes/` — is the opposite of this section. Narrow the assertion to the state and widen the *message*.
4. An unexplained CI failure is recorded per `REGRESSION_RULES.md` R-133 (checklist on `TASK-255`, area `Calidad, CI y observabilidad`), never closed as "it passes locally".

---

## 11. Auth email URLs are a CI contract

Registration and password recovery pass a redirect URL to Supabase. Supabase silently falls back to its `site_url` when that redirect is not allowed, so checking only that the SDK call succeeds does not protect the user journey.

CI must keep both layers executable:

1. `tests/unit/auth-callback.test.ts` proves that development always uses the live browser origin and that staging/production use their injected origin.
2. `tests/unit/required-env.test.ts` proves deployed builds reject missing or ambiguous environments, HTTP/localhost callbacks, production-to-staging mismatches, and staging-to-production reuse.
3. `tests/integration/project-contract.test.ts` proves the exact local confirmation and recovery routes remain in `supabase/config.toml` for both `localhost` and `127.0.0.1`.

Never replace these checks with a single snapshot of a committed production URL. Endpoints belong to deployment configuration; the repository owns the invariants that decide whether those values are safe.

### 11.1 Staging deployment is an executable repository contract

`tests/integration/project-contract.test.ts` must keep the staging branch in CI, require the Hostinger
job to wait for the quality jobs, build with the staging mode, use the protected `staging` GitHub
Environment, and preserve the production-safe activation order. Its contract rejects destructive root
mirrors and requires missing hashed assets first, temporary-file replacement, `index.html` before
`sw.js`, pre-activation asset checks, post-activation HTTPS verification, and automatic restoration of
the previous entrypoints on failure.

---

## 12. Database probes must announce a machine-readable verdict

Authorization in this product lives in the database, not in the client. The probes under `supabase/tests/` are what verifies it — and until `run-db-probes.ts` existed, none of them ran anywhere. They were executed by hand once, on the day each was written.

### 12.1 The verdict contract

Every probe ends in this exact shape:

```sql
raise exception 'PROBE_VERDICT status=% fails=% | %',
  case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
```

The `raise exception` stays. It is what rolls the transaction back so no test rows survive in production — it is *not* a failure signal, because a clean pass and a security hole exit with the identical error code. The verdict travels **inside the message**.

Three consequences that are not negotiable:

1. **A probe that emits no `PROBE_VERDICT` is a failure**, reported as `MUDA`. It is indistinguishable from a probe that never ran — including one that crashed on a syntax error before reaching its final `raise`.
2. **"Fixtures are missing" increments `v_fail`.** A probe that goes green because there was no subject to attack is worse than no probe: `p0_users_guard_probe` reported `BLOQUEADA` on an empty database because `update … where id = null` touches no rows and therefore never raises `insufficient_privilege`.
3. **Per-block counters must roll up into a single accumulator.** Resetting `v_ok`/`v_fail` between sections, as several probes did, silently discards the earlier section's failures.

Measured risk that is knowingly accepted — like the `storage` TRUNCATE grants that cannot be revoked on a hosted project — is reported as informational and excluded from the accumulator, with the reason written in the probe. A probe permanently in FAIL teaches the team to ignore it.

### 12.2 Registration is mandatory

`scripts/run-db-probes.ts` carries a manifest mapping each probe to a tier:

- `catalogo` — reads only `pg_catalog`, `information_schema` or `has_*_privilege`. Deterministic against a database replayed from migrations, and runnable without fixtures.
- `datos` — needs the business rows in `supabase/tests/fixtures.sql`, loaded with `--fixtures`.

Both tiers run in `db-migrations.yml` against the database it has just replayed from migrations.

A `.sql` file in `supabase/tests/` that is absent from the manifest fails the runner, and so does a manifest entry whose file is gone. This is deliberate: an unregistered probe would be born already outside CI, which is exactly how seventeen of them ended up unexecuted.

### 12.3 Commands

```bash
npm run test:probes            # loads fixtures, then runs all 17 — what CI runs
npm run test:probes:catalogo   # the 5 that need no fixtures
node scripts/run-db-probes.ts --filter=fase_d
node scripts/run-db-probes.ts --db-url=…   # defaults to the local stack
```

`--fixtures` writes rows and **commits them**, unlike the probes themselves. Point it only at a disposable database — the local stack or the one CI replays. Never at the remote project.

---

## 13. Edge Functions: keep the decisions out of `Deno.serve`

`ci.yml` already runs `deno test supabase/functions`, so **any `*.test.ts` under that directory joins CI by existing** — no workflow change needed. What blocks coverage is structural, not infrastructural.

### 13.1 The shell holds no decisions

A function whose logic lives inside the `Deno.serve` callback cannot be tested at all: importing the module starts a server. Split it the way `resend-webhook/` and `process-email-deliveries/` are split:

- `index.ts` — the HTTP shell only: authentication, `Deno.env`, `createClient`, response shaping.
- a sibling module — everything that decides *what happens*, taking its side effects as parameters.

### 13.2 Inject the boundary, not a summary of it

`process-email-deliveries/process.ts` receives the database and `fetch` itself, not a `sendEmail()` helper. That keeps the parts where the damage actually lives — the `Idempotency-Key` header, the `to` array, the bearer token — inside the assertion surface. A higher-level port would have hidden all three.

Declare the client surface **structurally** (`rpc`, `from().insert()`) instead of importing `SupabaseClient`. The double then implements four methods instead of the whole client, and `deno check` still proves the real client satisfies the interface with no cast — so the double cannot drift away from the real shape unnoticed.

### 13.3 Doubles live in `_shared/email-test-doubles.ts`

`createDatabaseDouble` records every RPC call and insert, and **fails loudly on an RPC the test did not declare** rather than returning a silent `null`. `createResendDouble` records what would have been sent and rejects any URL that is not Resend's endpoint. No production module imports them, so they never reach a deployed bundle.

### 13.4 Local runs need Deno installed

CI provisions it with `denoland/setup-deno`; a workstation does not have it by default.

```bash
brew install deno
npm run test:functions
```

---

## 14. A client RPC without its grant is a runtime failure, not a type error

The Supabase default privilege on functions was revoked in this project, so a new RPC
without an explicit `grant execute … to authenticated` compiles, ships, and then fails
with `permission denied` the first time a real user calls it. TypeScript cannot see it:
`supabase.rpc('name')` type-checks against generated types, not against privileges.

`npm run check:rpc-grants` (part of `npm run verify`, therefore part of CI) closes the
cheap half of that gap statically. It extracts every `.rpc('…')` name from `src/` and,
for each one, asserts against `supabase/migrations/`:

1. the function is created somewhere, and
2. the **last** privilege event naming it together with `authenticated` is a `grant`,
   not a `revoke` — ordered by migration filename, then by position within the file,
   which is the order Postgres applies them.

Two limits worth stating, because a guard whose reach is misunderstood is worse than no
guard. It reads **files**, so it inherits R2's weakness: the deployed database is not
fully derivable from `migrations/`. And it indexes **by name, not by signature**, so an
overload where only one version carries the grant still passes. Exercising the RPC for
real is a separate, more expensive check (R9.2 in `docs/checklists/COBERTURA_CRITICA_EN_CI.md`).

### 14.1 The guard must fail when the guard breaks

Its worst possible ending is the one the probes of §12 already had: staying green while
checking nothing. If the extractors stop matching, "0 problems out of 0" reads exactly
like "everything is fine".

A partial failure on the migration side is self-announcing — fewer grants found means
*more* RPCs reported as non-compliant. The two silent paths carry an explicit floor:

- no `.rpc()` call found in `src/` at all → exit 1;
- either grant parser (the static statements, or the dynamic `foreach … loop` block of
  `20260807042236`) finding zero statements → exit 1.

The second floor is not hypothetical. Every one of today's 51 RPCs draws its *current*
grant from the dynamic block, so breaking the static parser alone left the guard green —
verified by injecting it. The static parser is precisely the one that has to carry the
future, since new migrations write `grant execute … to authenticated` by hand.
