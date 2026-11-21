/**
 * Pure decision + constants for the RENEWAL LADDER notice (lever B). One 5-min tick
 * nudges a customer up a ladder of renewal rungs — usage 80% / 95% / 100%, and
 * expiry T-3d / T-1d — each rung fired at most once per cycle. The notice mask
 * (customer_accounts.renewal_notice_mask) is the restart-safe dedupe: a purchase
 * resets it to 0 (see cycle-anchor.ts) so the ladder re-arms every cycle.
 *
 * Cycle usage % = (used − cycleStart) / (quota − cycleStart), so the ladder measures
 * THIS paid cycle, not lifetime usage. Usage rungs outrank expiry on the same tick,
 * and only the highest newly-crossed usage rung fires (its lower bits are set too, so
 * a jump straight to 97% does not later re-fire 80%).
 *
 * Mask bits: 1=80% 2=95% 4=exhausted 8=T-3d 16=T-1d 32=grace-cap
 *            64/128/256=win-back d14/d30/d60 (reserved; pre-armed by the 0070 backfill).
 *
 * No I/O, no decorators, no runtime relative-value imports (node --test loadable).
 * Behind AFROWS_RENEWAL_LADDER_ENABLED (default on).
 */

import type { TelegramCopyId, TelegramLanguage } from '../telegram/telegram-i18n';

export const MASK_USAGE_80 = 1;
export const MASK_USAGE_95 = 2;
export const MASK_EXHAUSTED = 4;
export const MASK_EXPIRY_3D = 8;
export const MASK_EXPIRY_1D = 16;
export const MASK_GRACE_CAP = 32;
export const MASK_WINBACK_D14 = 64;
export const MASK_WINBACK_D30 = 128;
export const MASK_WINBACK_D60 = 256;

export const RENEWAL_LADDER_ACTION = 'customer.renewal_ladder.notified';
export const RENEWAL_LADDER_AUDIT_TARGET_TYPE = 'customer_account';
/** Usage is metered every ~60 s; a 5 min tick bounds notice latency to ~6 min. */
export const RENEWAL_LADDER_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export const USAGE_95_PCT = 95;
export const USAGE_80_PCT = 80;
export const EXPIRY_3D_MS = 3 * 24 * 60 * 60 * 1000;
export const EXPIRY_1D_MS = 24 * 60 * 60 * 1000;

/** `AFROWS_RENEWAL_LADDER_ENABLED`: default on; 0/false/no/off disables. */
export function resolveRenewalLadderEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return !value || !['0', 'false', 'no', 'off'].includes(value);
}

export type RenewalRung = 'usage80' | 'usage95' | 'exhausted' | 'expiry3d' | 'expiry1d';

const RUNG_COPY: Readonly<Record<RenewalRung, TelegramCopyId>> = {
  usage80: 'notify.renew.usage80',
  usage95: 'notify.renew.usage95',
  exhausted: 'notify.renew.exhausted',
  expiry3d: 'notify.renew.expiry3d',
  expiry1d: 'notify.renew.expiry1d',
};

export interface RenewalNoticeDecision {
  rung: RenewalRung;
  copyId: TelegramCopyId;
  /** The mask AFTER this rung (this bit + its lower rungs), to persist on delivery. */
  newMask: number;
  /** Cycle usage percentage, whole number, for the message/audit. */
  cyclePercent: number;
  /** quota − used, clamped at 0. */
  remainingBytes: number;
}

export interface RenewalNoticeInput {
  quota: number | null;
  used: number;
  cycleStart: number;
  expiresAt: Date | null;
  mask: number;
  hasPendingReceipt: boolean;
  hasChat: boolean;
  status: string | null;
  deletedAt: Date | null;
  now: Date;
}

/**
 * Decide the single renewal rung due for one account (or null). Deterministic.
 * Skips: unlimited account, inactive/deleted, no linked chat, a pending receipt
 * (grace covers them), an empty cycle, or every due rung already sent.
 */
export function decideRenewalNotice(input: RenewalNoticeInput): RenewalNoticeDecision | null {
  if (input.quota === null) return null; // account_unlimited
  if (input.deletedAt !== null || input.status !== 'active') return null; // inactive_or_deleted
  if (!input.hasChat) return null; // no_chat
  if (input.hasPendingReceipt) return null; // pending_receipt

  const denom = input.quota - input.cycleStart;
  if (denom <= 0) return null; // cycle_empty
  const used = Number.isFinite(input.used) ? input.used : 0;
  const cyclePct = ((used - input.cycleStart) * 100) / denom;
  const cyclePercent = Math.max(0, Math.min(100, Math.round(cyclePct)));
  const remainingBytes = Math.max(0, input.quota - used);
  const exhausted = used >= input.quota;

  // --- Usage rungs (highest newly-crossed only; set all lower bits). Usage outranks expiry.
  if (exhausted && !(input.mask & MASK_EXHAUSTED)) {
    return {
      rung: 'exhausted',
      copyId: RUNG_COPY.exhausted,
      newMask: input.mask | MASK_USAGE_80 | MASK_USAGE_95 | MASK_EXHAUSTED,
      cyclePercent,
      remainingBytes,
    };
  }
  if (!exhausted && cyclePct >= USAGE_95_PCT && !(input.mask & MASK_USAGE_95)) {
    return {
      rung: 'usage95',
      copyId: RUNG_COPY.usage95,
      newMask: input.mask | MASK_USAGE_80 | MASK_USAGE_95,
      cyclePercent,
      remainingBytes,
    };
  }
  if (!exhausted && cyclePct >= USAGE_80_PCT && !(input.mask & MASK_USAGE_80)) {
    return {
      rung: 'usage80',
      copyId: RUNG_COPY.usage80,
      newMask: input.mask | MASK_USAGE_80,
      cyclePercent,
      remainingBytes,
    };
  }

  // --- Expiry rungs (only when a future end date exists and the account is not exhausted).
  if (input.expiresAt !== null && !exhausted) {
    const msLeft = input.expiresAt.getTime() - input.now.getTime();
    if (msLeft > 0 && msLeft <= EXPIRY_1D_MS && !(input.mask & MASK_EXPIRY_1D)) {
      return {
        rung: 'expiry1d',
        copyId: RUNG_COPY.expiry1d,
        newMask: input.mask | MASK_EXPIRY_3D | MASK_EXPIRY_1D,
        cyclePercent,
        remainingBytes,
      };
    }
    if (msLeft > 0 && msLeft <= EXPIRY_3D_MS && !(input.mask & MASK_EXPIRY_3D)) {
      return {
        rung: 'expiry3d',
        copyId: RUNG_COPY.expiry3d,
        newMask: input.mask | MASK_EXPIRY_3D,
        cyclePercent,
        remainingBytes,
      };
    }
  }
  return null;
}

/**
 * The customer's renewal message. Persian primary, English appended for users who
 * never picked a bot language (same rule as low-quota). {remaining} is a preformatted
 * size; {percent} is the whole-number cycle usage. Contains only the recipient's own
 * balance — no other identifiers.
 */
export interface RenewalCopyDeps {
  render: (
    id: TelegramCopyId,
    language: TelegramLanguage,
    vars?: Record<string, string | number>,
    raw?: Record<string, string>,
  ) => string;
  rtl: (text: string, language: TelegramLanguage) => string;
  formatSize: (bytes: number, language: TelegramLanguage) => string;
}

export function buildRenewalNoticeMessage(
  decision: RenewalNoticeDecision,
  language: TelegramLanguage | null,
  deps: RenewalCopyDeps,
): string {
  const render = (lang: TelegramLanguage): string =>
    deps.rtl(
      deps.render(
        decision.copyId,
        lang,
        { percent: decision.cyclePercent },
        { remaining: deps.formatSize(decision.remainingBytes, lang) },
      ),
      lang,
    );
  if (language) return render(language);
  return `${render('fa')}\n\n— — —\n\n${render('en')}`;
}

/**
 * lapsed_at maintenance (C3) — lives ONLY in the renewal-ladder tick, never duplicated
 * into the monthly-expiry sweep. Sets lapsed_at when an account falls out of good
 * standing (NOT while in grace), and clears it when the account is usable again.
 */
export const LAPSED_AT_SET_SQL = `
  UPDATE customer_accounts
  SET lapsed_at = now(), updated_at = now()
  WHERE deleted_at IS NULL
    AND lapsed_at IS NULL
    AND quota_limit_bytes IS NOT NULL
    AND (used_bytes >= quota_limit_bytes OR (expires_at IS NOT NULL AND expires_at <= now()))
    AND NOT (grace_until IS NOT NULL AND grace_until > now())
`;

export const LAPSED_AT_CLEAR_SQL = `
  UPDATE customer_accounts
  SET lapsed_at = NULL, updated_at = now()
  WHERE lapsed_at IS NOT NULL
    AND quota_limit_bytes IS NOT NULL
    AND used_bytes < quota_limit_bytes
    AND (expires_at IS NULL OR expires_at > now())
`;
