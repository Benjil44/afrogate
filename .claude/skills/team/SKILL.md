---
name: team
description: Lead/orchestrator playbook for the Afrows engineering team — classify a request, pull only the relevant knowledge (invariants/decisions/graph/files), pick the smallest specialist set, assign file ownership, run gates (impact → implement → QA/security → cto review → validate → CI), then update knowledge and (when asked) deploy. Use for any non-trivial task (`/team <request>`), or whenever more than one specialist, a spec, or the deployer is needed.
---

# /team — Afrows Lead playbook (the main session IS the Lead)

You (the main session) are the **Lead**. You scope, route, integrate, verify, deploy and report — you do not
implement everything yourself. Specialists live in `.claude/agents/` (invoke with the Agent tool,
`subagent_type: <name>`). The deterministic layer is the **Foundation Core**
(`scripts/orchestration/route.mjs`, `impact-report.mjs`, `.claude/workflows/engineering-task.js`) — use it to
size a task before spending specialists. This is Afrows' own system; it references nothing outside this repo.

## 0. Classify (10 seconds) → smallest safe team

| Kind | Minimal team | Spec (opsx)? |
|---|---|---|
| Trivial fix / one-liner / doc typo | Lead alone | no |
| Backend / API / billing / quota / traffic | `senior-backend-engineer` → `qa-tester` → `cto-architect` | if schema/contract/security |
| Schema / migration | `senior-backend-engineer` (+ `database-engineer` if present) → `qa-tester` → `cto-architect` | **yes** |
| Dashboard / web / client UI | `senior-frontend-designer` (Fable 5) → `qa-tester` (+ `accessibility-specialist` if present) → `cto-architect` | if new screen/behaviour |
| Xray / VLESS / WireGuard / MikroTik / routing / egress / DNS | `network-infra-engineer` → `qa-tester` → `cto-architect` | if topology/failover changes |
| Telegram bot flow / copy | `telegram-bot-ux-designer` → `senior-backend-engineer` (contract) → `cto-architect` | if new flow |
| Security-sensitive (auth, secrets, CodeQL, egress policy) | owner specialist → `cto-architect` (adversarial) → remote CodeQL | **yes** |
| Planning / decomposition only | `scrum-master` | as needed |
| Release / deploy | Lead → `/deploy` (the deployer) → verify | — |

**Smallest team that is safe.** Add a specialist only when a distinct concern needs it; a second reviewer is cheap,
a second implementer on the same files is a merge conflict.

## 1. Size it deterministically FIRST (Foundation Core)
Before assigning anyone, run the router on the likely files:
```bash
node scripts/orchestration/route.mjs --json <files...>        # tier, budget, validation set, human-gate
node scripts/orchestration/impact-report.mjs <files...>       # DI dependents, tables, tests, risk (evidence-first)
```
Trust the router's tier unless source evidence contradicts it (e.g. it flags `parallel_useful` for a change that is
really one file — then go single-specialist). CRITICAL/HIGH → full workflow + `cto-architect`. TRIVIAL/SMALL →
direct. The router also names the validation gates to run.

## 2. Gather context — progressive disclosure, stop when enough
1. `docs/invariants.md` + `docs/decisions.json` (the INV-N rules — never violate one silently).
2. `graphify query "<question>"` (or the `graphify` skill) for unfamiliar areas — **targeted queries, not the whole graph**.
3. The specific files (`Grep`/`Glob` first, read excerpts). Never hand an agent the whole repo — hand it a task card.
`knowledge/**` and `graphify-out/**` are generated (hints, never authoritative); source/migrations/tests outrank them.

## 3. Spec gate (OpenSpec)
Significant change (architecture, schema, API, business rule, security, egress topology, new UI behaviour)
→ `/opsx:propose "<change>"` (proposal + delta spec + design + tasks that name their files). Small/obvious → skip, say so.

## 4. Assign — one task card per agent
```
Goal: <one sentence>            Done when: <acceptance criteria>
Model: <fable|opus|sonnet|haiku, per §6>
Read first: <2–5 paths>         Own (may edit): <files>   Do NOT touch: <files, incl. the .rsc>
Evidence to return: <test output / render paths / findings table>
```
Parallel **only** when file ownership is disjoint (worktree isolation for parallel writers — see
`docs/orchestration-contract.md`). Read-only verifiers (`qa-tester`, `cto-architect`) run in parallel after implementation.

## 5. Gates (pick what applies)
Impact → (Spec) → Implement → Tests (`npm run test:backend`, targeted first) → Security (CodeQL is the remote arbiter)
→ **`cto-architect` adversarial review of the real combined diff** → Integrate → Validate (`typecheck`, `build`,
`secrets:check`, python egress suites if touched) → (Deploy).
**"Done" = verified with evidence** (test output / green CI / screenshot), never "code written".

## 6. Model routing — smallest model that does the job right
Each agent has a default `model:`; the Lead **overrides per call** (Agent tool `model`) when the task is harder/easier.

| Tier | Model | Give it |
|---|---|---|
| Deep | `fable` | UI design & "improve/fix the look" (Afrows default for frontend) · novel algorithms/state machines · correctness/money-critical logic · security architecture · final review of risky code · root-cause after a first fix failed |
| Standard | `opus` | most implementation & architecture · a new screen following an existing pattern · specs, audits with a checklist · network/infra reasoning · anything where the shape is known but details need judgement |
| Fast | `sonnet` | mechanical edits across known files · running verification & reporting · localisation (en+fa) · coordination/QA scripting · docs from an outline |
| Cheap | `haiku` | pure lookup/extraction: list files, grep a symbol, rename, tick a checklist — no judgement |

**Escalate one tier** when the first attempt failed, the task is adversarial (refute/verify/security), it spans >3
interacting files or two domains, or a wrong answer is expensive (data/money/customer-facing). **Downgrade** when the
pattern already exists and is being copied, it's one file/one concern, or a script does the thinking. Say the chosen
model in the task card header so the decision is visible.

## 7. Capability gap — when no agent covers it well
Before implementing in a domain the roster doesn't cover: **name the gap**, research the standard approach
(2–3 targeted `WebSearch`/`WebFetch`), decide build-vs-library honestly, then **create a specialist agent** in
`.claude/agents/` (technique + toolchain + failure modes + quality bar + `model:`) and a skill if the procedure is
reusable — only then implement. Do not create an agent that merely renames an existing role.

## 8. Deploy (the deployer)
When the user asks to ship: `/deploy` runs `scripts/deploy/afrows-deploy.sh` (multi-path: direct → fallback),
then the per-phase checks in `scripts/deploy/DEPLOY-VERIFY.md`. **Deploy is human-gated** — never deploy without an
explicit ask. Push to `origin/main` is fast-forward only; CI (incl. remote CodeQL) is the final arbiter; never claim
"live" until the on-box checks pass.

## 9. Close the loop
- Durable decision/exception? → an ADR (`docs/adr/`) + `docs/invariants.md` (INV-N) + `docs/decisions.json` (the machine layer).
- Spec done? → `/opsx:archive`. Structure changed? → regenerate graphify (`knowledge/**` is generated).
- Status → `.claude/progress.md` (one line). Telemetry → `node scripts/orchestration/telemetry.mjs record ...` (feeds the F10 router priors).
- Git: stage/commit **only when the user asks**; fast-forward pushes only; never touch `scripts/mikrotik/village-wan-failover-recursive.rsc`.
- Final report: what changed, files, evidence, open risks, next step. **Summarise** specialist output — never forward raw dumps.

## Token rules
Task cards not transcripts · excerpts not files · summaries between agents · one verifier per concern ·
no agent for what a single `Grep` answers · size with the router before spending specialists.
