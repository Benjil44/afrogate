/**
 * Pure planning for keeping every active, under-quota client present on a remote
 * exit's WS inbound (Germany, USA). Each site owns one `RemoteMembershipState`:
 * a best-effort cache of ids confirmed present + when its last FULL re-sync ran.
 *
 *  - fast-path tick: adu only ids NOT yet confirmed (new / recovered users are
 *    restored within one provisioning tick, steady-state SSH churn ~zero);
 *  - full re-sync every `sweepIntervalMs`: adu everyone (drift correction);
 *  - ids no longer eligible are dropped from the cache so a user returning to
 *    good standing is re-adu'd, never skipped.
 *
 * Per-customer server access (0.118.0): ids whose account may NOT use the site
 * are "denied". They are excluded from `eligibleIds` (so they are never adu'd and
 * fall out of `confirmed`) and rmu'd once each via `planRemoteRevocations`; the
 * `removed` cache remembers a clean rmu so steady state spends no SSH on them.
 * A failed rmu stays out of `removed` and is retried next tick (self-healing even
 * if the toggle-time rmu failed). An id that stops being denied (access turned
 * back on, or it left good standing) is dropped from `removed`, so a later
 * re-deny rmu's it again. `removed` is also cleared on every FULL re-sync (and
 * the local gate on its own sweep cadence), so a denied user that an xray
 * restart restored, or whose rmu silently no-op'd, is rmu'd again: at most one
 * rmu per denied (id, site/target) per sweep. Both caches reset on restart.
 *
 * No I/O, no decorators — loadable by the `node --test` type-stripping runner.
 */

export interface RemoteMembershipState {
  confirmed: Set<string>;
  lastSweepAt: number;
  /** Denied ids (server access off) confirmed REMOVED from the site. */
  removed: Set<string>;
}

export function createRemoteMembershipState(): RemoteMembershipState {
  return { confirmed: new Set<string>(), lastSweepAt: 0, removed: new Set<string>() };
}

/** Mutates `state` (prunes the cache, stamps a full re-sync) and returns the ids to adu. */
export function planRemoteMembership(
  state: RemoteMembershipState,
  eligibleIds: readonly string[],
  nowMs: number,
  sweepIntervalMs: number,
): { toAdd: string[]; fullResync: boolean } {
  const eligible = new Set(eligibleIds);
  for (const id of [...state.confirmed]) if (!eligible.has(id)) state.confirmed.delete(id);

  const fullResync = nowMs - state.lastSweepAt >= sweepIntervalMs;
  if (fullResync) {
    state.lastSweepAt = nowMs;
    state.removed.clear(); // re-verify every denied id once per sweep
  }

  const toAdd = fullResync ? [...eligibleIds] : eligibleIds.filter((id) => !state.confirmed.has(id));
  return { toAdd, fullResync };
}

/** Record one adu outcome: success confirms, failure un-confirms (retried next tick). */
export function recordRemoteMembership(state: RemoteMembershipState, id: string, ok: boolean): void {
  if (ok) state.confirmed.add(id);
  else state.confirmed.delete(id);
}

/**
 * Mutates `state.removed` (forgets ids no longer denied) and returns the denied
 * ids still to rmu: at most one rmu per (id, site) per tick, none once confirmed.
 */
export function planRemoteRevocations(state: RemoteMembershipState, deniedIds: readonly string[]): string[] {
  const denied = new Set(deniedIds);
  for (const id of [...state.removed]) if (!denied.has(id)) state.removed.delete(id);
  return [...denied].filter((id) => !state.removed.has(id));
}

/** Record one rmu outcome for a denied id: success is remembered, failure retried next tick. */
export function recordRemoteRevocation(state: RemoteMembershipState, id: string, ok: boolean): void {
  if (ok) {
    state.removed.add(id);
    state.confirmed.delete(id);
  } else {
    state.removed.delete(id);
  }
}

/**
 * Sweep cadence for a revocation-only cache (the local access gate): once
 * `sweepIntervalMs` has passed, forget every confirmed removal so each denied key
 * is rmu'd once more. Returns true when it reset.
 */
export function expireRemoteRevocations(state: RemoteMembershipState, nowMs: number, sweepIntervalMs: number): boolean {
  if (nowMs - state.lastSweepAt < sweepIntervalMs) return false;
  state.lastSweepAt = nowMs;
  state.removed.clear();
  return true;
}
