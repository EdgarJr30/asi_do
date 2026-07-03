# Source Structure

The app is organized by domain and shared platform layers.

```text
src/
  app/         root runtime, providers, shared router glue
  components/  shared UI primitives and cross-module building blocks
  experiences/ route-owned product experiences
  features/    domain modules
  hooks/       reusable UI hooks
  lib/         infra and platform helpers
  shared/      constants, contracts, tokens, cross-domain types
  styles/      global styling entrypoints
  test/        shared test setup
```

Experience split:

```text
src/experiences/
  institutional/  ASI institutional portal under `/`
  storefront/     product landing, hidden pricing module, and member-gated job entry under `/platform`
  app/            authenticated application surfaces under `/auth`, `/account`, `/workspace`, and `/admin`
```
