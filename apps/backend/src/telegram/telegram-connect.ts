/**
 * "Connect / sync my account" for the afroWS bot (docs telegram-bot-flow-design.md
 * §15). This is the "I registered on the bot first, but I already have a real
 * account (the admin filled it on the website)" case: an ALREADY-registered bot
 * user shares their verified phone and, if it matches a real account, we MERGE the
 * current bot account INTO that real account — moving its remaining GB, gems and
 * configs over and archiving the bot account (see billing/customer-account-merge.ts).
 *
 * Safety comes from the shared, self-verified contact (request_contact, with
 * contact.user_id === from.id) which the bot service checks before calling in here.
 *
 * Like telegram-self-service.ts this module stays "pure-ish": it owns the decision
 * + ordering and delegates every side effect (phone lookup, merge, phone sync) to
 * injected collaborators, so the connect branch is unit-testable with fakes and the
 * merge rules are reused rather than re-implemented.
 */

import type { PhoneMatchAccount } from './telegram-self-service';

/**
 * The connect-branch decision (pure). Derived purely from the current account id,
 * this user's telegram id, and the live phone matches — no side effects.
 *  - `merge`         → exactly one OTHER live account matched and it is unclaimed
 *                      (its telegram_id is null/empty or already this user's):
 *                      merge the current bot account INTO it.
 *  - `alreadySynced` → the only match is the current account (already the same one).
 *  - `ownedByOther`  → the lone OTHER match is bound to a different telegram id:
 *                      never hijack — refuse.
 *  - `ambiguous`     → more than one OTHER account matched — never guess — refuse.
 *  - `noMatch`       → no live account matched (not even the current one).
 */
export type ConnectDecision =
  | { kind: 'merge'; sourceId: string; targetId: string }
  | { kind: 'alreadySynced'; accountId: string }
  | { kind: 'ownedByOther'; accountId: string }
  | { kind: 'ambiguous'; matchedAccountIds: string[] }
  | { kind: 'noMatch' };

/**
 * Decide what to do with a verified-phone connect request. The current bot account
 * is EXCLUDED from the match set first, because that account was itself created with
 * this same phone at registration and would otherwise show up as a match — the
 * decision is about the OTHER (real) accounts sharing the phone.
 */
export function resolveConnectDecision(
  currentAccountId: string,
  telegramId: string,
  matches: PhoneMatchAccount[],
): ConnectDecision {
  const others = matches.filter((match) => match.id !== currentAccountId);
  const currentMatched = matches.some((match) => match.id === currentAccountId);

  if (others.length === 0) {
    // No other account carries this phone: either the phone only matches the current
    // account (already synced) or nothing at all (just save it on the current one).
    return currentMatched ? { kind: 'alreadySynced', accountId: currentAccountId } : { kind: 'noMatch' };
  }

  if (others.length > 1) {
    return { kind: 'ambiguous', matchedAccountIds: others.map((match) => match.id) };
  }

  const target = others[0];
  const claimedByAnother = Boolean(target.telegramId) && target.telegramId !== telegramId;
  if (claimedByAnother) {
    // Someone else's Telegram already owns the real account — do NOT hijack/merge it.
    return { kind: 'ownedByOther', accountId: target.id };
  }

  // Unclaimed (or already this user's) real account → merge the current bot account
  // INTO it so its GB/gems/configs and the Telegram link land on the real account.
  return { kind: 'merge', sourceId: currentAccountId, targetId: target.id };
}

/** The connect outcome surfaced to the bot service (drives the reply copy + screen). */
export type ConnectOutcome =
  | { kind: 'merged'; targetId: string }
  | { kind: 'alreadySynced'; accountId: string }
  | { kind: 'ownedByOther' }
  | { kind: 'ambiguous' }
  | { kind: 'noMatch' };

export interface ConnectInput {
  /** The bot account currently bound to this telegram id (the merge SOURCE). */
  currentAccountId: string;
  /** This user's own, verified telegram id. */
  telegramId: string;
  /** E.164 digits from the self-verified shared contact. */
  phone: string;
  /** The current account's display name (fills a matched account only where blank). */
  displayName: string;
}

export interface ConnectDeps {
  /** Live (deleted_at IS NULL) accounts whose phone / paid_number_hash matches. */
  findLiveAccountsByPhone(phone: string): Promise<PhoneMatchAccount[]>;
  /**
   * Merge the current bot account (`sourceId`) INTO the matched real account
   * (`targetId`): moves remaining GB, gems, configs, the telegram link + phone and
   * referrals onto the target and archives the source. Reuses the merge rules.
   */
  mergeIntoAccount(sourceId: string, targetId: string): Promise<void>;
  /**
   * Save the verified phone (and fill a blank display name) onto an account already
   * owned by this telegram id — the no-merge branches (same account / no match).
   */
  syncAccountContact(accountId: string, phone: string, displayName: string): Promise<void>;
}

export class TelegramConnectResolver {
  private readonly deps: ConnectDeps;

  constructor(deps: ConnectDeps) {
    this.deps = deps;
  }

  async connect(input: ConnectInput): Promise<ConnectOutcome> {
    const matches = await this.deps.findLiveAccountsByPhone(input.phone);
    const decision = resolveConnectDecision(input.currentAccountId, input.telegramId, matches);

    switch (decision.kind) {
      case 'merge':
        await this.deps.mergeIntoAccount(decision.sourceId, decision.targetId);
        return { kind: 'merged', targetId: decision.targetId };
      case 'alreadySynced':
        await this.deps.syncAccountContact(decision.accountId, input.phone, input.displayName);
        return { kind: 'alreadySynced', accountId: decision.accountId };
      case 'ownedByOther':
        // Never hijack — leave both accounts untouched.
        return { kind: 'ownedByOther' };
      case 'ambiguous':
        // Never guess — leave everything untouched.
        return { kind: 'ambiguous' };
      case 'noMatch':
        await this.deps.syncAccountContact(input.currentAccountId, input.phone, input.displayName);
        return { kind: 'noMatch' };
    }
  }
}
