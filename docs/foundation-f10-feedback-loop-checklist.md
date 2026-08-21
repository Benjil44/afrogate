# Foundation F10 — Closed-loop telemetry → routing feedback

**Gap closed:** telemetry was write-only (`telemetry.mjs` records outcomes; nothing
consumed them). The router (`route.mjs`) decided purely from static heuristics with
no memory of what actually happened. F10 makes historical outcomes *inform the
recommendation surface* — without ever mutating the deterministic, auditable base
score/tier.

**Design invariant:** the base complexity score/tier/plan stay a pure function of
source + impact (unchanged, existing tests still pass). History is an **advisory
overlay** — priors, a health/trend signal, reliability cautions, and a budget
calibration hint. Advisory only; it never silently changes the routed tier.

**Scope guard:** only `scripts/orchestration/**`, one backend test, and
`docs/orchestration-contract.md`. No app code, schema, migrations, or DB.

## Checklist

- [x] **1. `telemetry-priors.mjs`** — pure lib + CLI. `computePriors`, `tierPrior`,
      `healthSignal`, `budgetCalibration`, `routingAdvice`. Deterministic (append
      order is the time proxy; no `Date`/`Math.random`).
- [x] **2. Wire into `route.mjs`** — best-effort read of `runs.jsonl`; attach
      `routing.history` overlay (priors + health + cautions + budget hint). Missing
      log ⇒ `{available:false}`, routing unchanged. Base score/tier untouched.
- [x] **3. Tests** — `apps/backend/test/telemetry-priors.test.ts` (node --test,
      synthetic records, asserts priors/health/calibration/determinism).
- [x] **4. `telemetry.mjs health`** CLI — human-visible per-tier priors + trend,
      reusing the F10 lib (single source of the aggregation).
- [x] **5. Docs** — update `docs/orchestration-contract.md` §12 (loop now closed).
- [x] **6. Verify** — backend typecheck; targeted `node --test`; run `route.mjs` +
      `telemetry.mjs health` live; run each twice → byte-identical (determinism).
- [x] **7. Report** — files changed, test results, determinism proof, scope confirmations.
