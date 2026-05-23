# Versioning Policy

AfroGate uses one product version across the root package and every workspace package. The visible dashboard version is the same value as root `package.json`.

## SemVer Rules

- Use `patch` for bug fixes, UI refinements, documentation updates, security hardening that does not change public behavior, and small internal improvements.
- Use `minor` during `0.x` for meaningful new capabilities, new dashboard pages, schema/API contracts, agent capabilities, security foundations, or operational workflows.
- Use `major` after `1.0.0` for breaking API, data, or deployment changes.
- Do not bump for failed experiments, reverted drafts, or local-only scratch work that is not committed.

## Required Steps

Every meaningful implementation section must:

1. Run the correct version script.
2. Update `CHANGELOG.md`.
3. Run `npm run version:check`.
4. Commit the version bump together with the implementation section.

## Commands

```powershell
npm run version:patch
npm run version:minor
npm run version:major
npm run version:set -- 0.2.0
npm run version:check
```

The version script updates:

- `VERSION`
- root `package.json`
- workspace package versions
- internal `@afrogate/*` dependency versions
- local plugin manifest versions
- `package-lock.json`

The version check verifies that those files and `CHANGELOG.md` stay aligned.
