# ADR-0009 — Egress P2 (Option A): explicit state machine, asymmetric hysteresis, circuit breaker

- **Status:** accepted
- **Date:** 2026-08-21
- **Relates to:** Egress redesign Phase P2; follows P0 (`5668277`) + P1 (ADR-0008);
  machine layer `docs/decisions.json` (`INV-17`).
- **Scope lock:** the failover **priority ORDER is unchanged** (that is P4). P2 changes
  only the *timing/stability* of transitions and adds observability. No topology,
  `routeMarkHex`, systemd cadence, MikroTik, `.rsc`, or P0/P1-semantics change.

## Context

The real egress failover state machine lives in `afrows-egress-mode-sync.py`
(`choose_catchall` / `choose_gaming`). Before P2 the "state" was an implicit outbound
tag held in per-lane `.state` files, and hysteresis was a single **symmetric** 2-strike
counter. Best-practice gaps (from the P7 investigation): no explicit state / single
source (G4), and symmetric hysteresis with no circuit breaker — a flapping upstream can
yank live traffic back and forth (best-practice #10).

## Decision (Option A — formalize in place, box-local, behavior-preserving on order)

Introduce `scripts/egress_state.py`, a **pure, deterministic** transition core, and route
both `choose_*` through it. The priority ladders are made **explicit and single-sourced**
(`CATCHALL_ORDER`, `GAMING_ORDER`) but their order is identical to the prior inline logic.

- **Asymmetric hysteresis** — fail **out** of a failing higher-priority path fast
  (`k_out=2`, unchanged from today) but fail **back** to a recovered one slowly
  (`k_back=3`), so a flapping upstream can't oscillate live traffic. `k_back` applies to
  *every* upward move, so climbing off the censored last-resort (`direct → proxy`) or the
  all-down default (`proxy → via-village`) is also one cycle slower — inherent to
  asymmetric hysteresis and acceptable (a stable reserve is worth one extra minute).
- **Circuit breaker** — when transitions within a decision-window exceed `breaker_max`,
  the lane is flapping: it becomes **stickier** (requires `breaker_extra` more strikes)
  and sets `breaker.tripped`. It **damps** oscillation and can never *permanently* pin
  traffic (`breaker_extra` is a small fixed constant and the transition log prunes to the
  window, so `flapping` self-clears after a quiet spell and a healthy `want` held for
  `need` cycles always wins). **Honest caveat:** raising the bar also delays *escaping* a
  newly-dead path during a flap storm — while flapping, fail-OUT takes `k_out+breaker_extra`
  (=4) instead of 2 cycles (~2 extra minutes on a dead path). Keep `breaker_extra` small
  (2); do not crank it.
- **Transition log** — every switch is appended (bounded to the window) so
  "why am I on X / how often has it flipped" is answerable; surfaced in
  `egress-health.json` (`catchAllBreaker`, `gamingBreaker`) which the backend already reads.
- **Stale alert** — `SUBSCRIPTION_REFRESH_STALE` (P1's reserved reason) is now produced
  by a new `AlertEngineService` condition (no successful refresh in
  `AFROWS_SUBSCRIPTION_STALE_MINUTES`), catching a stalled refresher that the
  consecutive-failure alert would miss.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `AFROWS_EGRESS_K_OUT` | `2` | Strikes to fail OUT of a failing higher-priority path (preserves prior behavior). |
| `AFROWS_EGRESS_K_BACK` | `3` | Strikes to fail BACK to a recovered path (slower — anti-flap). |
| `AFROWS_EGRESS_BREAKER_WINDOW` | `10` | Recent decisions defining "recent" (~10 min @ 1/min). |
| `AFROWS_EGRESS_BREAKER_MAX` | `4` | Transitions in the window that mark a lane flapping. |
| `AFROWS_EGRESS_BREAKER_EXTRA` | `2` | Extra strikes required while flapping (damping). |
| `AFROWS_SUBSCRIPTION_STALE_MINUTES` | `120` | No-successful-refresh age that raises a stale alert. |

## Consequences

- Transitions are explicit, single-sourced, and tested (`test_egress_state.py`);
  `test_egress_mode_sync.py` proves the ladder order is unchanged and fail-out is still 2.
- **Deploy note:** `egress_state.py` MUST be deployed alongside `afrows-egress-mode-sync.py`
  (sibling import); the systemd unit runs the script from a directory that must contain both.
- **Human-gated deploy:** this changes the live applier's transition timing; roll out with
  the Python suites green and observe `egress-health.json` breaker state.

## Conditions that invalidate this decision

- If P4 re-orders the ladder (VLESS primary / MikroTik-direct fallback), `CATCHALL_ORDER`
  / `GAMING_ORDER` change here (one tested place) — the machine itself stays.
- If the decision is ever moved into the backend (TS), this box-local formalization is
  superseded (Option B/C).
