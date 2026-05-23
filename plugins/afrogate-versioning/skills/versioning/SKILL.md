---
name: afrogate-versioning
description: Use after any meaningful AfroGate implementation section to decide and apply version bumps, changelog updates, and sidebar version checks.
---

# AfroGate Versioning

Use this skill whenever an AfroGate implementation session adds, changes, removes, or meaningfully documents product behavior.

## Workflow

1. Read `docs/versioning-policy.md`.
2. Inspect `git status --short` and understand the current implementation section.
3. Choose the smallest valid bump:
   - `patch` for bug fixes, UI refinements, docs, and safe internal improvements.
   - `minor` during `0.x` for new user-visible capabilities, database/API contracts, agent capabilities, security foundations, or new operational workflows.
   - `major` only after `1.0.0` for breaking product or API changes.
4. Run one of:
   - `npm run version:patch`
   - `npm run version:minor`
   - `npm run version:major`
   - `npm run version:set -- x.y.z`
5. Update `CHANGELOG.md` with the new version, date, and concise user-visible changes.
6. Verify with `npm run version:check`, then run the relevant typecheck/build/audit commands for the section.
7. Commit the version bump, changelog, docs, and implementation in the same focused commit.

## Rules

- Keep one AfroGate product version across root and workspace packages.
- Do not bump for failed experiments or discarded drafts.
- Do not leave a version bump without a changelog entry.
- Keep the dashboard sidebar version visible and sourced from root `package.json`.
