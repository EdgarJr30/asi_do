# Test Structure

```text
tests/unit/         fast logic tests
tests/integration/  app shell, contract, and cross-module tests
tests/acceptance/   executable Gherkin specifications for critical business rules
tests/e2e/          browser workflows once the interactive hiring loop is implemented
```

## Before you debug a failure that only happens in CI

Two things are fixed on purpose so the suite does not inherit the machine it runs on. Read `docs/governance/TESTING_RULES.md` §9 before working around either of them.

- **Supabase configuration comes from `src/test/env.ts`**, imported first by `src/test/setup.ts` — not from your `.env.local`, which does not exist in CI. Without it the app renders a degraded shell (`El acceso aún no está disponible` instead of the sign-in form) and tests report a missing heading as if the UI were broken.
- **Async budgets are shared**: `asyncUtilTimeout` (5s) in `src/test/setup.ts` and `testTimeout` (15s) in `vite.config.ts`. The 1s default of `findBy*` is wall-clock time, and a CI runner under `--coverage` spends it on the deferred route chunk alone. Do not patch a single call site.

See `docs/governance/TESTING_RULES.md` for the quality contract.
See `docs/governance/TDD_PLAYBOOK.md` for the Red-Green-Refactor workflow and the risk matrix.
See `tests/acceptance/README.md` for the business-readable scenario map and its executable evidence.
