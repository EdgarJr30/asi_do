# DOCUMENTATION_RULES.md — Documentation Governance and Self-Update Rules

## 1. Purpose
This file defines how the project documentation stays synchronized with implementation, architecture, business rules, testing, and security decisions.

Documentation is a living contract, not an afterthought.

---

## 2. Living contract rules
1. Every rule file in this repository is a source-of-truth artifact.
2. If code changes behavior, the affected documents must change in the same task.
3. If a task changes architecture, permissions, UI patterns, testing expectations, security posture, or folder structure, the related documents must be reconciled before the task is considered done.
4. A task is incomplete if implementation and documentation diverge.
5. If a new recurring rule emerges, it must be recorded in the appropriate rule file and in `docs/governance/REGRESSION_RULES.md` if it originated from an explicit user correction.
6. Canonical project docs live under `docs/` grouped by concern, while the repository root stays limited to entrypoint docs such as `README.md` and `AGENTS.md`.
7. Keep `AGENTS.md` concise and operational. Detailed product, architecture, and governance content should be referenced from `docs/` instead of duplicated at the repo root.
8. If a task closes with any unresolved follow-up, that follow-up must be recorded immediately as a Linear issue in the canonical project for the repository without waiting for user confirmation.

---

## 3. Mandatory source-of-truth files
- `AGENTS.md`
- `docs/README.md`
- `docs/product/PRD.md`
- `docs/domain/BUSINESS_RULES.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/RBAC_MODEL.md`
- `docs/product/ROADMAP.md`
- `docs/architecture/TECHNICAL_ARCHITECTURE.md`
- `docs/architecture/SOFTWARE_ARCHITECTURE.md`
- `docs/governance/UI_UX_RULES.md`
- `docs/governance/CODING_RULES.md`
- `docs/governance/REGRESSION_RULES.md`
- `docs/governance/DOCUMENTATION_RULES.md`
- `docs/governance/TESTING_RULES.md`
- `docs/governance/SECURITY_RULES.md`
- `docs/governance/VERSIONING_RULES.md`
- `docs/product/BENCHMARK.md`
- `README.md`

---

## 4. Update trigger matrix
### Product or workflow changes
Update:
- `docs/product/PRD.md`
- `docs/domain/BUSINESS_RULES.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/RBAC_MODEL.md` when permissions or roles are affected

### Technical or structural changes
Update:
- `docs/architecture/TECHNICAL_ARCHITECTURE.md`
- `docs/architecture/SOFTWARE_ARCHITECTURE.md`
- `docs/governance/CODING_RULES.md`
- `docs/README.md`
- `README.md`
- `AGENTS.md` if the root operating model or task-intake expectations change
- `docs/governance/TESTING_RULES.md` if verification or structure changes
- `docs/governance/SECURITY_RULES.md` if risk posture changes

### UI or design system changes
Update:
- `docs/governance/UI_UX_RULES.md`
- `README.md` when setup or usage changes materially

### Security, trust, privacy, or OSINT changes
Update:
- `docs/governance/SECURITY_RULES.md`
- `docs/domain/RBAC_MODEL.md` if access control changes
- `docs/domain/BUSINESS_RULES.md` if product policy changes
- `docs/architecture/TECHNICAL_ARCHITECTURE.md` if technical enforcement changes
- `README.md` when developer setup or safe operational defaults for external tools such as MCP materially change

### Testing or quality changes
Update:
- `docs/governance/TESTING_RULES.md`
- `docs/governance/CODING_RULES.md`
- `docs/product/ROADMAP.md` if milestone expectations change

### Versioning or release workflow changes
Update:
- `docs/governance/VERSIONING_RULES.md`
- `docs/governance/DOCUMENTATION_RULES.md`
- `README.md`
- `docs/README.md`

### Explicit user correction
Update:
- `docs/governance/REGRESSION_RULES.md`
- every affected source-of-truth file in the same task

---

## 5. Self-update protocol for rule files
When a change request arrives:
1. Identify which rule files are impacted before editing code.
2. Implement the code or structural change.
3. Update all affected documents in the same task.
4. Add or revise tests if the change alters important behavior or safeguards.
5. If references to file names, folders, modules, or permissions changed, update every document that mentions them, including `docs/README.md`.
6. If repo guidance grew enough to increase task friction or context cost, compact `AGENTS.md` and move detail back into the relevant canonical docs.
7. Never leave a known documentation mismatch for “later” once the implementation already changed.
8. Never leave unresolved operational follow-up undocumented outside the repo. If work remains pending, create the Linear issue in the same task before closing it.

---

## 6. Required closure checklist
Before closing any meaningful task, confirm:
- business rules remain accurate
- architecture docs still match the repo
- `docs/README.md` still matches the documentation layout
- testing docs still match available scripts and expectations
- security docs still match the current posture
- versioning rules still match available scripts and expectations
- README setup instructions remain correct
- regression rules were updated if a user correction introduced a durable rule
- any remaining follow-up was turned into a Linear issue in the canonical project

---

## 7. Anti-drift rule
If documentation and implementation conflict, treat the conflict as a defect.
Resolve the mismatch in the same workstream whenever possible.
