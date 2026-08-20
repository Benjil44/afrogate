# Afrows Agent Team

Parallel, role-specialized Claude Code sub-agents for Afrows. Invoke by name (e.g. "use the senior-frontend-designer to ..."). Independent tasks should be launched **in parallel** (multiple agents in one turn); dependent tasks are sequenced by the scrum-master.

| Agent | Role | Model | Owns |
|-------|------|-------|------|
| `cto-architect` | CTO / principal architect, final reviewer | Opus | whole system, `.claude/memory.md` |
| `scrum-master` | Delivery coordinator, planning & records | Sonnet | `.claude/progress.md`, `checklist.md` |
| `senior-frontend-designer` | UI/UX, responsive/mobile, a11y | **Fable 5** | `apps/dashboard`, `apps/web`, `apps/client` |
| `senior-backend-engineer` | API, billing/quota, traffic accounting | Opus | `apps/backend`, `packages/shared` |
| `network-infra-engineer` | Xray/VLESS routing, DNS, WireGuard, MikroTik, power resilience | Opus | `xray-config.json`, infra docs |
| `qa-tester` | Reproduce, test, verify, guard regressions | Sonnet | `tests/`, quality gates |

## Model policy
- **Fable 5** drives design + "improve and fix" UI work (senior-frontend-designer).
- **Opus** handles daily engineering, architecture, and network/infra reasoning.
- **Sonnet** handles lightweight coordination and QA.
Override per-invocation with the Agent tool's `model` field when a task warrants a different tier.

## Typical parallel flow
1. `scrum-master` decomposes the request into independent tasks.
2. Specialists run **in parallel**: frontend-designer + backend-engineer + network-infra-engineer.
3. `qa-tester` reproduces & verifies each fix.
4. `cto-architect` reviews the combined diff before release; scrum-master updates `.claude/` and bumps version.

## First run — 2026-07-24 (4 operator issues, in parallel)
- **senior-frontend-designer (Fable 5):** mobile customer table → extended `DataTable` with expandable detail rows (Edit/Config inline under each row); decimal-GB unit on the dashboard side; en+fa i18n.
- **senior-backend-engineer (Opus):** quota decimal-GB fix (`BYTES_PER_GB=1e9`) + tighter metering poll (Xray/WG 15s); unit audit; new quota-math test.
- **network-infra-engineer (Opus):** weather routing → trusted DNS block in `afrows-egress-mode-sync.py`; `xray.service` restart hardening; power-loss diagnosis (physical/UPS).
- Diagnosis matrix + status: `docs/afrows-fix-roadmap.md`. Session record: `.claude/progress.md` (2026-07-24).
- **Lesson learned → hard rule below:** an agent ran `git stash` on the shared working tree and swept concurrent agents' uncommitted edits (recovered from `stash@{0}`). Agents must never `git stash` a shared tree.

## Conventions every agent follows
- Read `AGENTS.md` + `.claude/` before changing code.
- Keep UI copy in the typed multilingual layer (Arabic + English).
- Typed, deduplicated, low-resource-friendly code; no secrets/PII committed.
- Version bump + `CHANGELOG.md` + `npm run version:check` per meaningful section.
- **Never `git stash` / `git checkout -- .` / `git reset --hard` on the shared working tree** when other agents may be running — it discards their uncommitted edits. To test on clean HEAD, use a git worktree or read the committed version with `git show HEAD:<file>`. Stage only your own files (`git add <your paths>`); do not commit, push, or bump version unless coordinated.
