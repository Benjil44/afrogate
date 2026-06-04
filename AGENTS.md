# Afrows Agent Instructions

Before changing code or architecture in this repository, read these files first:

1. `.codex/memory.md`
2. `.codex/progress.md`
3. `.codex/checklist.md`
4. `.codex/agent.md`
5. `docs/mvp-monitoring-prd-fa.md`
6. `docs/technical-architecture-fa.md`
7. `docs/roadmap-fa.md`
8. `docs/enhancement-approaches-fa.md`
9. `docs/implementation-start-plan-fa.md`
10. `docs/control-plane-egress.md`
11. `docs/server-access-and-outbound-management.md`
12. `docs/dashboard-sidebar-pages-checklist.md`
13. `docs/multilingual-ui.md`
14. `docs/versioning-policy.md`
15. `docs/repository-structure.md`
16. `docs/security-performance-policy.md`
17. `SECURITY.md`

After each meaningful implementation session:

- Update `.codex/progress.md` with what changed, what was verified, and what remains.
- Update `.codex/memory.md` when a stable product or technical decision is made.
- Update `.codex/checklist.md` when tasks move from pending to done.
- Bump the Afrows version, update `CHANGELOG.md`, and run `npm run version:check` for each meaningful implementation section.
- Keep dashboard user-facing labels in the typed multilingual layer instead of hardcoding English-only UI copy.
- Keep privacy, safety, and human-rights requirements visible in every design decision.
- Keep code clean, typed, and deduplicated.
- Optimize for low-resource VPS machines: low CPU, low RAM, compact metrics, no unnecessary services.
- Treat every public port and unauthenticated endpoint as a security risk until proven otherwise.

Do not commit secrets, server credentials, Telegram tokens, user personal data, or production config.
