# CODING_RULES.md — Implementation Conventions for Codex

## 1. General coding principles
- Prefer clarity over cleverness
- Keep features modular by domain
- Avoid hidden coupling
- Prefer explicit types and contracts
- Avoid `any`
- Keep business logic out of presentation components where practical
- Prefer reusable primitives over duplication
- Use `npm` as the only package manager for local commands, scripts, installs, and lockfile updates
- Do not introduce or reference `pnpm`, `yarn`, or additional lockfiles unless the repo standard changes explicitly

---

## 2. TypeScript rules
- use strict typing
- prefer domain-specific types/interfaces
- avoid implicit `any`
- when handling errors, prefer `unknown` and narrow safely
- keep DTOs and domain types explicit
- centralize shared enums/types where appropriate

---

## 3. React rules
- use functional components
- keep components focused
- separate presentational vs orchestration responsibilities where practical
- reuse hooks for repeated logic
- avoid giant page components
- preserve accessibility and semantic structure

---

## 4. Styling rules
- use Tailwind CSS v4 utilities with design tokens/theme strategy
- do not scatter hard-coded hex values in feature components
- do not create one-off spacing/typography rules without reuse justification
- shared UI primitives live in `components/ui` or equivalent
- standardize reusable component primitives on the `shadcn/ui` approach, owned locally in `src/components/ui`
- standardize product icon usage on `lucide-react`
- standardize transient app feedback on `sonner`
- do not mix multiple general-purpose component or icon libraries for the same UI layer without a documented exception
- do not introduce `sweetalert`, `sweetalert2`, `react-toastify`, browser `alert/confirm/prompt`, or equivalent overlapping UI-feedback libraries for product flows

---

## 5. Data access rules
- centralize Supabase access helpers
- avoid permission assumptions in components
- prefer server-safe patterns for sensitive actions
- keep queries and mutations predictable
- do not bypass documented authorization patterns

---

## 6. Form rules
- use shared form primitives
- standardize labels, helper text, validation, and error rendering
- long forms should be sectioned or multi-step when helpful
- preserve drafts where required by UX/business logic

---

## 7. Testing rules
- add tests for critical domain helpers
- test RBAC-sensitive behavior
- test tenant isolation-sensitive behavior
- do not ship core workflow changes without at least minimal verification
- keep `npm run test`, `npm run test:contract`, and related quality commands meaningful

---

## 8. Security rules
- follow `docs/governance/SECURITY_RULES.md` for web security, OSINT, and architecture-integrity safeguards
- do not introduce insecure client-only authorization assumptions
- do not commit secrets or unsafe env handling patterns
- security-sensitive changes should include verification updates

---

## 9. Documentation rules
If code changes:
- business behavior
- permissions
- domain model
- architecture
- UI patterns
- testing expectations
- security posture
- repository structure

update the relevant docs in the same task.

---

## 10. Naming conventions
Prefer domain language already defined in the docs.
Do not create multiple names for the same concept without a documented reason.

Examples:
- tenant
- membership
- candidate_profile
- company_profile
- job_posting
- application
- pipeline_stage
- permission

---

## 11. Anti-regression rule
Before finalizing a task, check `docs/governance/REGRESSION_RULES.md` and confirm the implementation does not reintroduce corrected mistakes.

## 12. Versioning rule
- follow `docs/governance/VERSIONING_RULES.md` for release classification
- meaningful changes should ship with a changeset entry before version application
- do not guess SemVer bumps ad hoc outside the documented rules
