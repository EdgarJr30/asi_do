# Source Structure

The app is organized by domain and shared platform layers.

```text
src/
  app/         router, providers, layouts
  components/  shared UI primitives and cross-module building blocks
  features/    domain modules
  hooks/       reusable UI hooks
  lib/         infra and platform helpers
  pages/       cross-feature pages
  shared/      constants, contracts, tokens, cross-domain types
  styles/      global styling entrypoints
  test/        shared test setup
```
