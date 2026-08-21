# ADR-0010 — Egress P3: uplink pool stability scoring

- **Status:** accepted
- **Date:** 2026-08-21
- **Relates to:** Egress redesign Phase P3; follows P2 (ADR-0009);
  machine layer `docs/decisions.json` (`INV-18`).
- **Scope lock:** improves *which stable relay* the pool selects — no topology / ladder
  order / eligibility / safety change.

## Context

The uplink pool selector (`afrows-uplink-pool-sync.py`) chooses the set of VLESS relays
rendered into the live pool. Its old score was `success_rate*1000 + healthy_avg` — no
recency (an old sample counted the same as a new one) and no variance term (a relay that
flaps 5↔30 Mbps scored the same as a steady relay of the same mean). Best-practice gap:
raw instantaneous throughput could win the pick.

Crucially, **live latency selection is already handled downstream** by the pool xray's
observatory + leastPing balancer among the chosen set, so the pool selector's job is to
pick the *stable* set — not to rank latency. P3 targets exactly that.

## Decision

Refine `score_relay` to a **stability score**, leaving eligibility and safety untouched:

- **success_rate stays dominant** (`*1000`) so a reliable relay always outranks a flaky one.
- **Recency-weighted** success + throughput (linear weights, newest heaviest) — a
  lightweight stale-decay within the sample window, so a recovering relay outranks a
  recently-degrading one.
- **Variance penalty** — `stability = 1/(1 + CV)` over passing samples, so a steady relay
  outranks an equal-mean flapper and raw throughput alone never wins.

The **eligibility gate is unchanged** (`recent_ok` last-K healthy + `MIN_SUCCESS`), as are
cold-start (instantaneous fallback for <K samples), the stale gate (never select
un-fresh), and the HARD SAFETY (0 eligible → leave the pool unchanged). Only the *ranking*
among eligible relays changes, so which relays qualify is identical to before.

## Consequences

- The pool prefers steady, recently-healthy relays over spiky ones — fewer mid-spike
  admissions that fail live. Covered by `scripts/test_uplink_pool_score.py` (run in CI),
  closing the previously-untested pool-scoring gap.
- **Human-gated deploy:** changes live relay selection; roll out with the suite green and
  observe pool membership stability.

## Conditions that invalidate this decision

- If latency/loss are ever added to the pool row (a DB query change), the QUALITY term
  could fold them in — but today latency is a downstream (leastPing) concern, so it is
  deliberately not in this score.
