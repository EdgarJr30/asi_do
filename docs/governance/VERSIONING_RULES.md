# VERSIONING_RULES.md — SemVer and Release Classification Rules

## 1. Purpose
This file defines how the project versions itself and how release bumps are classified.

Versioning is part of the project contract, not a manual guess.

---

## 2. Standard
The project uses:
- **Semantic Versioning**
- **Changesets** as the release classification workflow
- a repository script that calculates the next expected version from pending changes

---

## 3. Core rule
The repository should not try to infer the correct release bump from raw code diffs alone.

Instead, each meaningful change should declare its release intent through a changeset entry, and the project then calculates the next version from the highest pending bump type.

---

## 4. Bump definitions
### `patch`
Use `patch` for:
- bug fixes
- refactors without breaking behavior
- internal improvements that do not add a new product capability
- non-breaking tooling or release-process improvements

Example:
- `0.0.0` -> `0.0.1`
- `0.1.0` -> `0.1.1`

### `minor`
Use `minor` for:
- new features
- new backward-compatible modules, screens, or capabilities
- schema additions that do not break existing consumers
- visible UX improvements that add functionality

Example:
- `0.0.1` -> `0.1.0`
- `0.1.0` -> `0.2.0`

### `major`
Use `major` for:
- breaking API or contract changes
- incompatible schema or permission changes
- removals or behavior changes that require migration or adaptation
- architecture changes that intentionally break prior assumptions

Example:
- `0.1.0` -> `1.0.0`
- `1.4.2` -> `2.0.0`

---

## 5. No-release guidance
Not every task must create a version bump.

Usually no changeset is required for:
- spelling-only documentation edits
- comments only
- formatting only
- tests that do not alter shipped behavior

If a tooling change affects the project contract, release workflow, setup expectations, or developer-facing behavior, a `patch` changeset is acceptable.

---

## 6. Workflow
1. Create a changeset with `npm run changeset`
2. Select `patch`, `minor`, or `major`
3. Write a concise summary of the change
4. Run `npm run version:plan` to see the next expected version
5. Run `npm run version:apply` when ready to materialize the bump

---

## 7. Calculation rule
If multiple changesets are pending, the next version is determined by the highest bump type among them:
- `major` beats `minor`
- `minor` beats `patch`
- `patch` beats no bump

---

## 8. Verification expectations
- `.changeset/config.json` must remain present
- `scripts/release-plan.mjs` must remain present
- `npm run version:plan` must stay meaningful
- versioning workflow changes must update this file, `README.md`, `docs/README.md`, and affected governance docs

---

## 9. Anti-regression rule
Do not bump versions ad hoc without a documented release classification.
Do not replace SemVer or Changesets silently.
