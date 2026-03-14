# Supabase Structure

Use this folder as the source of truth for backend assets:

```text
supabase/
  migrations/  schema evolution
  policies/    documented policy snippets or helpers when needed
  functions/   edge functions only when justified
  seeds/       local/dev seed data
```

SQL migrations remain authoritative for schema, constraints, helper functions, and RLS policies.
