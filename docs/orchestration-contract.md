# Afrows Engineering Orchestration Contract

How a non-trivial engineering task is executed by multiple agents, safely and
evidence-first. This is the human-readable contract; the executable form is
`.claude/workflows/engineering-task.js`, and the deterministic core is
`scripts/orchestration/impact-report.mjs`.

**This is not an autonomous agent.** Nothing here runs on its own. A human (or an
explicitly delegated main-loop session) starts it, and every side effect that
leaves the working tree stays human-gated.

---

## 0. Authority — read this first

The orchestrator does **not** define knowledge rules. `AGENTS.md`
§"Engineering Knowledge Layer — Operating Contract" is the single source for:

- the source-of-truth hierarchy (§1) and graph-authority rule (§2)
- fact-type semantics — VERIFIED / DERIVED / INFERRED / AMBIGUOUS (§3)
- the context-loading protocol (§4)
- the staleness rule (§5) and conflict recovery (§6)
- the impact-analysis workflow (§11)

Restating those rules here would create a second copy that drifts. Agents are
instructed to read `AGENTS.md` directly.

---

## 1. Invocation contract

```
Workflow({ name: 'engineering-task', args: {
  task:        'what to accomplish',       // required
  mode:        'analyze' | 'implement',    // default 'analyze' (read-only dry run)
  scope:       'which area/files',
  constraints: 'anything forbidden',
  riskLevel:   'low' | 'medium' | 'high' | 'unknown',
  maxParallel:  1..4                       // default 3
}})
```

`mode` defaults to **`analyze`** — the safe default. Analysis never edits a file.

---

## 2. Stages

| # | Stage | Input | Output | Success | On failure |
|---|---|---|---|---|---|
| 1 | **DISCOVERY + IMPACT_ANALYSIS** | task, scope | impact report (schema `afrows-impact-report/v1`) | evidence-backed file/dependency/table/test map + explicit `ambiguities` | BLOCKED — no plan is attempted without evidence |
| 2 | **DECOMPOSE** | impact | work packages + dependency graph | every package has `owned_files` + `forbidden_files`; parallel packages are file-disjoint | BLOCKED if no packages |
| 2b | **Overlap re-check** *(deterministic)* | plan | overlap list | zero shared owned files | BLOCKED — the agent's `parallel_safe` claim is verified in code, never trusted as prose |
| 3 | **PARALLEL_EXECUTION** | packages | agent results (Checklist-15 schema) | all `DONE` + `ready_for_integration` | any `conflict_detected` → BLOCKED and re-decompose |
| 4 | **INTEGRATION** (barrier) | all diffs | review findings | no BLOCKER/HIGH | returns findings **unfixed** to the orchestrator |
| 5 | **TARGETED_VALIDATION** | verified test links | gate results | targeted tests pass | FAIL classified with evidence |
| 6 | **FULL_VALIDATION** | risk + change surface | gate results | typecheck/build/backend/E2E/secrets pass as applicable | FAIL classified with evidence |
| 7 | **FINAL_REPORT** | everything | `READY_FOR_COMMIT` or `BLOCKED` | — | — |
| 8 | **COMMIT / CI** | *human-gated, outside the workflow* | commits, push, CI | remote checks green | loop back |

Transitions are strictly sequential; a stage only runs if the previous one
succeeded. A blocked stage returns immediately with everything gathered so far.

---

## 3. Impact analysis (deterministic)

`node scripts/orchestration/impact-report.mjs <files...> [--json]`
(or `--changed [--base <ref>]` to read the change set from git)

Read-only. Answers, **from evidence only**:

1. likely changed files → 2. DI dependents → 3. DI dependencies →
4. tables touched → 5. co-consumers of those tables → 6. deterministically
linked tests → 7. applicable ADRs/invariants → 8. risk level.

Fact types: `tests_verified`, `depends_on`, `dependents`, `tables` are **VERIFIED**
(each backed by a `source_location`); `co_consumers` and risk are **DERIVED**;
`tests_convention` is **INFERRED** (filename-stem match, *not* coverage); anything
absent is **AMBIGUOUS** — absence of a link is never proof of no dependency.

**Staleness:** if the knowledge manifest SHA ≠ HEAD, the report prints a loud
warning and every derived finding is downgraded to HINTS ONLY.

---

## 4. Agent assignment — by files and risk, never by title

| Change surface | Agent |
|---|---|
| `apps/backend`, `packages/shared` | `senior-backend-engineer` |
| `apps/dashboard`, `apps/web`, `apps/client` | `senior-frontend-designer` |
| Xray / WireGuard / MikroTik / routing / DNS | `network-infra-engineer` |
| `tests/**`, reproduction, regression guards | `qa-tester` |
| Telegram bot flow + copy | `telegram-bot-ux-designer` |
| Cross-cutting architecture, security, final review | `cto-architect` |
| Planning / decomposition | `scrum-master` |

No new agent definitions are introduced. Schema work maps to
`senior-backend-engineer`; security review maps to `cto-architect`
(+ `network-infra-engineer` for infrastructure).

---

## 5. Concurrency safety

The repo records a real incident: an agent ran `git stash` in the **shared**
working tree and swept other agents' uncommitted edits
(`.claude/agents/README.md`). Therefore:

- **Parallel writers run with `isolation: 'worktree'`** — each gets its own git
  worktree; results are merged at the barrier. Read-only/analysis packages share
  the tree (cheaper, no write risk).
- Parallel packages must have **disjoint `owned_files`**, verified in code.
- An agent that needs a file it does not own must **stop** and report
  `conflict_detected` rather than edit it.
- `git stash` / `git checkout -- .` / `git reset --hard` are **forbidden** on the
  shared tree. To read pristine code use `git show HEAD:<file>` or a worktree.
- A dead/timed-out agent resolves to `BLOCKED`, never to silent success.

---

## 6. Integration barrier

Runs **after** all parallel agents, **before** any commit. The reviewer
(`cto-architect`) inspects the real combined diff and checks: conflicting edits,
duplicate implementations, contradictory decisions, scope violations, forbidden
files, secrets/`.env`, formatting churn, and tests weakened to pass.

Findings are classified **BLOCKER / HIGH / MEDIUM / LOW**. The reviewer
**does not fix** BLOCKER/HIGH — it returns them to the orchestrator.

---

## 7. Validation strategy

**Targeted first** — the smallest complete set from VERIFIED test links.
Do not run the whole suite for a tiny change.

**Escalate to broader gates** when any of these hold (decided deterministically
by the impact report): HIGH risk, schema/entity change, migration/database path,
shared infrastructure, a table shared by ≥5 services, or a frontend/E2E surface.

Real project gates (verified working):

| Gate | Command |
|---|---|
| Typecheck | `npm run typecheck --workspaces --if-present` |
| Build | `npm run build --workspaces --if-present` |
| Backend tests | `npm run test:backend` |
| E2E | `npm run test:e2e` |
| Secrets | `npm run secrets:check` |
| Contrast | `npm run contrast:check` |
| Version | `npm run version:check` |

⚠️ `npm run lint` is currently a **placeholder** (backend prints "not configured
yet"). It is not treated as a real gate.

Every failure is classified **NEW_REGRESSION / PRE_EXISTING / ENVIRONMENT /
FLAKY / UNKNOWN** and must carry evidence. `PRE_EXISTING` may only be claimed
after verifying the failure on unmodified code.

> CI (`.github/workflows/ci.yml`) is a **single fail-fast job**: an early failure
> masks every later step. Run local gates in CI's order so masked failures surface.

---

## 8. Diff review, commit, CI

Before committing: inspect the complete diff; confirm no accidental refactor, no
unrelated formatting churn, intentional generated files, documented behaviour
changes, tests matching intended behaviour, no secrets, no `.env`, and that
`scripts/mikrotik/village-wan-failover-recursive.rsc` is still untracked and
unmodified.

Commits are **atomic per logical workstream**, conventional-prefixed
(`feat|fix|test|docs|chore(scope):`), with a body stating *what changed, why, and
what behaviour was deliberately preserved*. No "agent changes"/"temp fix" commits.
Never amend by default; never force-push.

Then: commit → inspect → push normally → **monitor CI**. Success is not claimed
until the remote checks report success. On CI failure: collect the exact failing
step, map it to the change surface, classify the cause, and re-enter the loop.

---

## 9. Continuation logic

- **CONTINUE** — the current gate passed and dependent work remains.
- **BLOCKED** — an unresolved blocker, insufficient evidence, or a human decision
  is required.
- **DONE** — the requested objective is complete, all required validation passed,
  and no approved next stage remains.

The orchestrator **never invents new tasks**.

---

## 10. Human approval boundaries

**Require explicit human approval:** production deployment; destructive DB
operations; deleting data; force-push; rewriting history; security/auth policy
changes; external infrastructure changes; major architecture changes; unusually
large token/compute spend.

**May proceed once explicitly delegated:** code implementation, tests,
deterministic analysis, docs, isolated commits.

The workflow itself never commits, pushes, merges, bumps versions, or regenerates
the Graphify graph.

---

## 11. Agent result contract (machine-readable)

Every implementing agent returns:

```
status:                   DONE | BLOCKED | NEEDS_REVIEW
files_changed:            [...]
files_forbidden_touched:  [...]        // must be empty
implementation_summary:   "..."
evidence:                 [...]        // source_locations, test output
tests:                    [...]        // run before AND after
risks:                    [...]
assumptions:              [...]
unresolved:               [...]
conflict_detected:        "..."        // set => orchestrator re-decomposes
ready_for_integration:    true | false
```

Enforced as a JSON Schema in the workflow, so the orchestrator collects results
structurally rather than parsing prose.

---

## 11b. Closed-loop history overlay (F10)

The router does not decide in a vacuum. `scripts/orchestration/telemetry-priors.mjs`
reads the F8 telemetry log (`graphify-out/telemetry/runs.jsonl`) and turns recorded
outcomes into **decision priors** the router layers on top of its deterministic base
score:

- **per-tier reliability** — fallback rate, success rate, avg human-interventions,
  avg tokens, and the most common fallback reason for each complexity tier;
- **a recent-vs-prior health signal** — `STABLE / DEGRADING / IMPROVING /
  INSUFFICIENT_DATA` from the tail window vs the window before it;
- **budget calibration** — flags a tier as `UNDER_/OVER_BUDGETED` when observed
  tokens diverge from the static budget, with a rounded recommendation;
- **reliability cautions** — surfaced when a tier historically falls back a lot or
  health is degrading.

This overlay is **advisory only**. It annotates `routing.history`; it never mutates
the auditable base `score`/`tier`/`plan`, and it degrades safely — a missing/empty
log yields `{available:false}` and byte-identical pre-F10 routing. It is pure and
deterministic (record append order is the time proxy; no wall-clock, no randomness),
covered by `apps/backend/test/telemetry-priors.test.ts`. Inspect it with
`node scripts/orchestration/telemetry.mjs health` (or `telemetry-priors.mjs`).

## 12. Known limitations

- The knowledge layer does not guarantee complete coverage; a missing link is not
  proof of no dependency.
- Impact risk scoring is a heuristic over verified edges — it prioritises, it does
  not prove.
- Worktree isolation costs setup time and disk per writing agent.
- Parallelism helps only when packages are genuinely file-disjoint.
- The F10 history overlay is only as good as the log: priors below
  `MIN_RUNS_FOR_PRIOR` are flagged `LOW_CONFIDENCE`, and the health signal needs
  `2×window` runs before it reads anything but `INSUFFICIENT_DATA`. It informs, it
  does not decide.
- `lint` is not yet a real gate.
- E2E depends on local dev servers and is sensitive to the environment (Linux CI
  font metrics differ from Windows).
