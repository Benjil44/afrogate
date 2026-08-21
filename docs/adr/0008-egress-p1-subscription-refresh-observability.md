# ADR-0008 — Egress P1: subscription-refresh observability & causal state

- **Status:** accepted
- **Date:** 2026-08-21
- **Relates to:** Egress redesign Phase P1 (follows P0, ADR-less fix at `5668277`);
  `docs/orchestration-contract.md`; machine layer `docs/decisions.json` (`INV-16`).
- **Scope lock:** observability only — no egress topology, VLESS/MikroTik priority,
  systemd, `routeMarkHex`, or P0 accept/reject-semantics change.

## Context

P0 made subscription refresh fail-safe: a partial/unsafe refresh is rejected and the
last-known-good child set is preserved. But a rejection was only *passively* visible
(`outbound_subscriptions.last_status='error'` + a free-text `last_error`). An operator
could not answer "why is refresh failing", "how long has it been frozen", or "has this
provider been rejected repeatedly" — the exact questions that matter during a village /
MikroTik blackout when the reserve must be trustworthy.

## Decision

Add **causal, durable, alertable** refresh state, reusing existing mechanisms:

1. **Three additive columns** on `outbound_subscriptions` (migration 0055):
   `consecutive_failures` (reset to 0 on any success), `last_success_at`,
   `last_failure_reason` (typed code). `last_error` keeps the human message
   (backward compatible).
2. **Typed reason codes** (`subscription-refresh-reason.ts`), each anchored to a real
   throw site: `SUBSCRIPTION_FETCH_FAILED`, `_HTTP_ERROR`, `_EMPTY`, `_SHRINK_REJECTED`,
   `_ACTIVE_NODE_LOST`, `_DEDUPE_ANOMALY`, `_COMMIT_FAILED`, and the derived
   `_REFRESH_STALE`. There is deliberately **no `SUBSCRIPTION_PARSE_FAILED`**:
   `parseSubscription` does not throw (a malformed body yields an empty set caught by the
   zero-guard), so that reason would not be source-supported.
3. **Consecutive-failure alert** via the existing `AlertEngineService` — a new
   `subscription` condition, active at `AFROWS_SUBSCRIPTION_ALERT_FAILURES` consecutive
   failures. Reuses the `alerts` table's idempotent open/resolve, so it is inherently
   **non-flapping** and **deterministic**; a successful refresh resets the counter →
   condition inactive → the alert auto-resolves.
4. **Transition record = the alert lifecycle.** The `alerts` open→`resolved_at` pair is
   the persisted transition (entered-failing / recovered, with reason + source +
   timestamps). We deliberately do **not** wire `route_failover_events` (it models
   `from/to_outbound_id` for the route-decision engine — a semantic mismatch) and do
   **not** add a new transition table; a cross-path egress transition log is deferred to
   the P2 EgressController. No duplicate source of truth.
5. **Status = the existing subscription summary**, extended with the new fields plus a
   derived `secondsSinceSuccess`. No new endpoint.

## Configuration

| Env var | Default | Purpose | Risk if set too aggressively |
|---|---|---|---|
| `AFROWS_SUBSCRIPTION_MIN_NODES` | `3` | P0 absolute floor (mirrors `POOL_MIN_HEALTHY`). A shrink below this is rejected. | Too high → rejects legitimately small subscriptions / stales the reserve. |
| `AFROWS_SUBSCRIPTION_MIN_RETENTION_RATIO` | `0.5` | P0 suspicious-shrink ratio (candidate/current). | Too high → rejects legitimate large provider rotations → reserve staleness. |
| `AFROWS_SUBSCRIPTION_ALERT_FAILURES` | `3` | Consecutive failures before a warning alert opens. | Too high → a frozen reserve stays invisible longer. |
| `AFROWS_SUBSCRIPTION_ALERT_CRITICAL_FAILURES` | `6` | Consecutive failures before the alert escalates to critical. | Too high → escalation is delayed. |

**Safety semantics:** these tune *visibility and the reject boundary*; none of them
change what P0 preserves. The floor/ratio only ever cause *more* preservation (reject →
keep last-known-good), never a prune the base logic would not already do.

## Consequences

- A repeatedly-failing subscription is now visible (alert + counter + typed reason + time
  since success) instead of silently frozen.
- Operators tune the reject boundary via the two P0 knobs above (documented escape hatch).

## Conditions that invalidate this decision

- If a dedicated cross-path egress transition log is introduced (P2), Phase-5's "alert
  lifecycle as the transition record" is superseded for egress-mode transitions (this
  subscription-refresh record may remain).
- If `parseSubscription` is ever changed to throw distinctly, add
  `SUBSCRIPTION_PARSE_FAILED` (it would then be source-supported).
