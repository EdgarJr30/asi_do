# SECURITY_RULES.md — Security, OSINT, and Integrity Rules

## 1. Purpose
This file defines the mandatory security posture for the product across web security, Supabase access control, OSINT/trust workflows, and architectural integrity.

Security includes protecting:
- users and tenants
- data and documents
- permissions and workflows
- source-of-truth rules
- platform trust and moderation decisions

---

## 2. Secure-by-default principles
1. Multi-tenant isolation is mandatory.
2. RBAC and Supabase RLS are authoritative for access control.
3. Client-side checks are supportive only.
4. Sensitive actions require defense in depth: validation, authorization, auditability, and tests.
5. Secrets must never be hard-coded in client code or committed to the repo.
6. Security decisions must be documented when they change product behavior or operational posture.

---

## 3. Production web security rules
### Authentication and session handling
- Use Supabase Auth as the identity source.
- Do not trust session state in UI alone for authorization decisions.
- Protect sensitive actions with backend or database enforcement.
- Keep session renewal and sign-out flows explicit and testable.

### Input and output safety
- Validate untrusted input at the boundary.
- Encode or render user-generated content safely.
- Do not introduce unsafe HTML rendering without an explicit sanitization strategy.
- File uploads must validate type, size, and storage destination rules.

### Browser and deployment controls
- Production deployments must use HTTPS.
- Configure strong security headers, including CSP where feasible, plus frame, referrer, and MIME-sniff protections.
- Avoid loading third-party scripts without a documented reason and risk review.
- Service worker caching must not expose tenant-sensitive data across sessions or tenants.

### Dependency and release hygiene
- Keep dependencies reviewable and minimal.
- Remove or replace dependencies with known unresolved high-severity vulnerabilities when a compatible safe path exists.
- Run quality checks before release.
- Investigate security-relevant dependency updates promptly.

---

## 4. Supabase security rules
1. Exposed tables must use RLS.
2. RLS policies must align with memberships, roles, and permissions.
3. Helper SQL functions must be explicit and auditable.
4. Storage buckets must have clear public/private intent and scoped paths.
5. Signed URLs or controlled access must be used for sensitive private files.
6. SQL migrations are the source of truth for schema and policy evolution.
7. Never bypass RLS casually for convenience.

---

## 5. Business and architecture integrity rules
Security also means preventing unauthorized changes to the product contract.

### Required safeguards
- do not bypass documented business rules
- do not break tenant isolation
- do not weaken RBAC enforcement
- do not create client-only permission assumptions
- do not introduce architecture patterns that contradict the modular-monolith baseline without documentation
- do not leave docs stale after changing logic, testing, security, or structure

### Enforcement expectation
Changes that impact these safeguards must update:
- tests
- documentation
- regression rules when applicable

---

## 6. OSINT and trust-and-safety rules
OSINT may be used only for legitimate moderation, fraud prevention, trust verification, abuse review, or public safety workflows that the product intentionally supports.

### Allowed baseline
- use public, lawfully available information
- document the purpose of the check
- log sources, timestamps, and analyst/system attribution when the workflow becomes operational
- minimize retained data to what is relevant

### Prohibited or restricted behavior
- do not collect credentials or attempt intrusion
- do not access private or paywalled areas without authorization
- do not doxx users or expose personal data unnecessarily
- do not use OSINT to infer protected characteristics for hiring decisions
- do not automate adverse moderation or employment decisions without human review policy

### Fairness and privacy
- avoid collecting more personal data than necessary
- separate trust and safety review from employment decisioning
- keep moderation and risk signals auditable

---

## 7. Mandatory security verification areas
- permission helpers
- route/action guards
- tenant-scoped data access
- storage access rules
- job/application workflow authorization
- documentation integrity for security-sensitive changes

---

## 8. Release gate
Before release or major merge readiness, confirm:
- lint, typecheck, tests, and build pass
- required env vars are documented
- RLS and storage assumptions remain consistent with docs
- no new secrets were introduced
- security-relevant rule changes were documented

---

## 9. Incident and regression protocol
If a security issue, trust failure, or architecture-integrity regression is found:
1. fix or contain it
2. document the rule or safeguard update here
3. update related source-of-truth files
4. add a regression test when feasible
5. record a durable correction in `docs/governance/REGRESSION_RULES.md` if it reflects a recurring risk
