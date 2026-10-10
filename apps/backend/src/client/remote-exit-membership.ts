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
 * No I/O, no decorators — loadable by the `node --test` type-stripping runner.
 */

export interface RemoteMembershipState {
  confirmed: Set<string>;
  lastSweepAt: number;
}

export function createRemoteMembershipState(): RemoteMembershipState {
  return { confirmed: new Set<string>(), lastSweepAt: 0 };
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
  if (fullResync) state.lastSweepAt = nowMs;

  const toAdd = fullResync ? [...eligibleIds] : eligibleIds.filter((id) => !state.confirmed.has(id));
  return { toAdd, fullResync };
}

/** Record one adu outcome: success confirms, failure un-confirms (retried next tick). */
export function recordRemoteMembership(state: RemoteMembershipState, id: string, ok: boolean): void {
  if (ok) state.confirmed.add(id);
  else state.confirmed.delete(id);
}
