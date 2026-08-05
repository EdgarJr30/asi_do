# TDD_PLAYBOOK.md — Test-First Delivery Playbook

## 1. Purpose

This playbook turns tests into an executable delivery contract for humans and coding agents. The objective is confidence in observable behavior without requiring reviewers to read every implementation line.

TDD does not mean “write more tests.” It means that behavior is specified before production code, the smallest implementation satisfies that specification, and refactoring happens only while the suite is green.

## 2. Mandatory Red-Green-Refactor loop

Every bug fix, business rule, permission decision, data transformation, or user-visible behavior change follows this loop:

1. **Describe:** state one observable outcome and select the lowest useful test layer.
2. **Red:** add the smallest example and run it. Confirm it fails for the expected reason, not because setup is broken.
3. **Green:** write the smallest production change that makes the example pass.
4. **Refactor:** improve names, duplication, seams, and structure without changing behavior; keep the suite green.
5. **Gauntlet:** run the gates required by the risk matrix below.
6. **Retain:** keep the test as a regression guard and reconcile affected documentation.

The final commit contains the green result. The pull request or task handoff records the Red and Green commands and outcomes. A test that is green before production code changes is characterization or regression coverage, but it is not evidence of the Red step for new behavior.

## 3. Test layer selection

Use the narrowest layer that can prove the behavior, then add broader coverage only for a distinct risk.

| Layer | Proves | Use for | Command |
| --- | --- | --- | --- |
| Static | code and type contracts | every change | `npm run lint && npm run typecheck` |
| Unit | one decision in isolation | pure domain logic, validators, mappers, RBAC helpers | `npm run test:unit` |
| Integration | collaborators agree | route guards, providers, Supabase adapters, component interactions | `npm run test:integration` |
| Contract | repository or external shape is preserved | migrations, configuration, required files, API/schema assumptions | `npm run test:contract` |
| Acceptance | business-readable rule is executable | critical lifecycle, access, tenancy, billing, moderation | `npm run test:acceptance` |
| E2E | real browser journey works | core hiring loop, auth, payments, mobile/PWA | `npm run test:e2e` |
| Mutation | assertions detect plausible defects | critical pure logic and security decisions | `npm run test:mutation` |
| Manual QA | human perception and environment behavior | installability, offline feedback, mobile layout, touch, deployed integrations | release checklist |

Do not duplicate the same assertion at every layer. A unit test can prove a boundary calculation; an E2E test should prove the user outcome, not recalculate every branch.

## 4. Risk matrix

| Change risk | Required minimum gauntlet |
| --- | --- |
| Copy, styling, or static presentation | focused test when a durable contract exists, lint, typecheck, visual/manual check when layout changes |
| Pure logic or validation | Red-Green-Refactor unit test, focused mutation when the module is critical, coverage |
| React interaction or route behavior | unit or integration test, mobile-relevant browser test when the browser owns the risk |
| Business lifecycle | unit/integration plus executable Gherkin; E2E for the primary happy path and material rejection path |
| RBAC, tenant isolation, privacy, billing, audit, or destructive action | denial and approval cases, cross-tenant negative case, integration/contract test, Gherkin, mutation for extracted decisions, E2E where deployable |
| Supabase schema, RLS, trigger, RPC, or Edge Function | migration/contract tests, local replay or schema inspection, positive and negative authorization cases; never rely on UI tests alone |
| Production bug | first reproduce with a failing test at the lowest useful layer, then retain it and update `REGRESSION_RULES.md` |

## 5. Test design rules

- Name tests in domain language and describe outcomes, not function internals.
- Prefer Arrange-Act-Assert with one behavioral reason to fail.
- Assert observable state, returned values, emitted effects, navigation, or user-visible output.
- Include boundary values and meaningful denials, not only happy paths.
- For RBAC and multi-tenancy, prove both authorized access and unauthorized isolation.
- Keep tests deterministic: control time, randomness, network, and generated identifiers.
- Avoid arbitrary sleeps. Wait for observable state or events.
- Use production code through public seams. Do not test private implementation details.
- Mock the boundary you do not own, not the business logic being tested.
- A mock must reflect a documented contract; prefer small fakes for stateful collaborators.
- One flaky failure blocks the gate. Quarantine requires a documented owner, reason, and removal condition; retries must not hide deterministic defects.
- Never weaken an assertion or threshold merely to make CI green.

## 6. Executable Gherkin

Gherkin lives in `tests/acceptance/*.feature`, in Spanish domain language, with TypeScript step definitions beside it.

Use Gherkin only when a product, operations, QA, or security stakeholder benefits from reading the rule. Each scenario should normally contain three to five steps:

- `Dado` establishes domain state.
- `Cuando` describes one business event.
- `Entonces` asserts an observable outcome.

Avoid UI selectors, HTTP verbs, table names, React components, and implementation details in `.feature` files. Step definitions may call domain code or test adapters, but must remain thin. Scenarios are independent and must not share mutable state.

The executable map in `tests/acceptance/README.md` covers the shared critical rules for access, membership, opportunities/applications, pipeline/governance, and notifications/offline. New critical rules should add their own feature or extend the closest domain feature; technical details remain in Vitest or Playwright instead of being duplicated as Gherkin.

## 7. Coverage policy

`npm run test:coverage` is a ratchet, not a quality score. Repository thresholds must never decrease without an explicit, documented decision. When measured coverage rises materially, raise the thresholds in `vite.config.ts` in the same task.

Expect 100% branch coverage for newly extracted critical decision functions when practical. Generated types, presentation-only JSX, and infrastructure glue may use a lower layer-specific expectation, but every exception must identify the untested risk and its compensating verification.

Coverage only proves execution. Mutation testing checks whether assertions notice altered behavior.

## 8. Mutation policy

Stryker uses Vitest and starts with the critical permission guards in `stryker.config.json`. That baseline has a 100% breaking threshold. A surviving mutant blocks completion until it is:

- killed by a meaningful behavioral assertion; or
- documented as equivalent with a precise explanation and the smallest possible disable scope.

When a task changes critical pure logic outside the current mutation set, add that module to `mutate`, establish its passing baseline, and keep it in the permanent gate. Do not point Stryker at UI, generated files, or network adapters merely to increase the file count.

Mutation runs in its own CI job because it is intentionally slower than the primary feedback loop. The HTML report is uploaded when the gate fails.

## 9. CI and review evidence

`npm run verify` gates lint, typecheck, Vitest, executable acceptance specifications, and build. CI additionally gates coverage, mutation, E2E smoke, Edge Functions, dependency policy, and database workflows where applicable.

Every pull request uses `.github/PULL_REQUEST_TEMPLATE.md` to record:

- the intended behavior;
- Red command and expected failure;
- Green command and passing result;
- refactoring performed;
- risk-specific gates and manual checks;
- any unresolved blocker tracked under the repository follow-up rule.

Branch protection should require `Verify quality gate`, `Mutation testing`, and other applicable CI jobs before merge. Administrators must not bypass a red required check for convenience.

## 10. Agent operating contract

For every behavioral task, an agent must:

1. read the nearest existing tests and this playbook;
2. state the behavior and risk before implementation;
3. create and observe the Red failure;
4. implement only enough for Green;
5. refactor while tests remain green;
6. run focused checks, then the proportional gauntlet;
7. report exact pass, failure, or skipped counts without turning skips into success;
8. update documentation and regression rules when triggered;
9. commit the completed repository change.

If the environment cannot execute a required gate, the task is not silently “done.” Record the exact blocker and the pending verification according to the repository follow-up rule.
