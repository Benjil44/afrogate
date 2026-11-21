import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EARLY_RENEWAL_PCT,
  FIRST_PURCHASE_PCT,
  INVITEE_REFERRAL_BONUS_BYTES,
  WINBACK_PCT_D14,
  WINBACK_PCT_D30,
  WINBACK_PCT_D60,
  decideApprovalBonuses,
  decideEarlyRenewal,
  resolveBonusEnabled,
  winbackPct,
  type ApprovalBonusesInput,
  type ApprovalSnapshot,
} from '../src/billing/approval-bonuses.ts';

const GB = 1_000_000_000;
const NOW = new Date('2026-11-13T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const ALL_ON = { firstPurchase: true, earlyRenewal: true, winback: true, inviteeReferral: true };

function snap(over: Partial<ApprovalSnapshot> = {}): ApprovalSnapshot {
  return { usedBytes: 0, quotaLimitBytes: 20 * GB, cycleStartUsedBytes: 0, expiresAt: null, lapsedAt: null, ...over };
}

function bonusInput(over: Partial<ApprovalBonusesInput> = {}): ApprovalBonusesInput {
  return {
    volumeBytes: 20 * GB,
    amountMinor: 50_000,
    snapshotQuotaLimitBytes: 20 * GB,
    resellerSettled: false,
    hasPriorPaidTopup: false,
    earlyRenewalEligible: false,
    accountAgeMs: null,
    lapseDays: null,
    winbackGrantInLast90d: false,
    referredBy: null,
    accountId: 'buyer-1',
    enabled: ALL_ON,
    ...over,
  };
}

describe('resolveBonusEnabled / winbackPct', () => {
  it('kill-switch defaults on', () => {
    assert.equal(resolveBonusEnabled(undefined), true);
    assert.equal(resolveBonusEnabled('off'), false);
  });
  it('win-back tiers: <14 none, [14,30) 15, [30,60) 20, >=60 25', () => {
    assert.equal(winbackPct(13), null);
    assert.equal(winbackPct(14), WINBACK_PCT_D14);
    assert.equal(winbackPct(29), WINBACK_PCT_D14);
    assert.equal(winbackPct(30), WINBACK_PCT_D30);
    assert.equal(winbackPct(59), WINBACK_PCT_D30);
    assert.equal(winbackPct(60), WINBACK_PCT_D60);
    assert.equal(winbackPct(null), null);
  });
});

describe('decideEarlyRenewal', () => {
  it('eligible: paid + prior paid + headroom + deep cycle (>=80%)', () => {
    const d = decideEarlyRenewal({
      snapshot: snap({ usedBytes: 17 * GB, quotaLimitBytes: 20 * GB }), // 85% cycle
      hasPriorPaidTopup: true,
      amountMinor: 50_000,
      now: NOW,
    });
    assert.equal(d.eligible, true);
  });

  it('eligible via near expiry (<=72h) even at low usage', () => {
    const d = decideEarlyRenewal({
      snapshot: snap({ usedBytes: 2 * GB, expiresAt: new Date(NOW.getTime() + 2 * DAY) }),
      hasPriorPaidTopup: true,
      amountMinor: 50_000,
      now: NOW,
    });
    assert.equal(d.eligible, true);
  });

  it('NOT eligible: no prior paid, no headroom, low usage + far expiry, or already ended', () => {
    const base = { hasPriorPaidTopup: true, amountMinor: 50_000, now: NOW };
    assert.equal(decideEarlyRenewal({ ...base, hasPriorPaidTopup: false, snapshot: snap({ usedBytes: 18 * GB }) }).eligible, false);
    assert.equal(decideEarlyRenewal({ ...base, snapshot: snap({ usedBytes: 20 * GB }) }).eligible, false); // no headroom
    assert.equal(
      decideEarlyRenewal({ ...base, snapshot: snap({ usedBytes: 2 * GB, expiresAt: new Date(NOW.getTime() + 20 * DAY) }) }).eligible,
      false,
    );
    assert.equal(
      decideEarlyRenewal({ ...base, snapshot: snap({ usedBytes: 2 * GB, expiresAt: new Date(NOW.getTime() - DAY) }) }).eligible,
      false,
    ); // ended
    assert.equal(decideEarlyRenewal({ ...base, amountMinor: 0, snapshot: snap({ usedBytes: 18 * GB }) }).eligible, false); // unpaid
  });
});

describe('decideApprovalBonuses — percentage (mutually exclusive)', () => {
  it('first_purchase 20% for a new account with no prior paid', () => {
    const { grants } = decideApprovalBonuses(bonusInput({ accountAgeMs: 10 * 60 * 60 * 1000 }));
    assert.equal(grants.length, 1);
    assert.equal(grants[0].kind, 'first_purchase');
    assert.equal(grants[0].pct, FIRST_PURCHASE_PCT);
    assert.equal(grants[0].bonusBytes, 4 * GB); // 20% of 20 GB
  });

  it('first_purchase is INELIGIBLE once a prior paid purchase exists (payment order / reseller sale)', () => {
    // hasPriorPaidTopup true simulates a non-Telegram paid purchase; new account age otherwise.
    const { grants } = decideApprovalBonuses(bonusInput({ accountAgeMs: 10 * 60 * 60 * 1000, hasPriorPaidTopup: true }));
    assert.equal(grants.some((g) => g.kind === 'first_purchase'), false);
  });

  it('early_renewal 10% wins over first_purchase (prior paid + eligible)', () => {
    const { grants } = decideApprovalBonuses(
      bonusInput({ hasPriorPaidTopup: true, earlyRenewalEligible: true, accountAgeMs: 10 * 60 * 60 * 1000 }),
    );
    assert.equal(grants.length, 1);
    assert.equal(grants[0].kind, 'early_renewal');
    assert.equal(grants[0].pct, EARLY_RENEWAL_PCT);
    assert.equal(grants[0].bonusBytes, 2 * GB);
  });

  it('winback tiers require a prior paid purchase (never-paid lapser excluded)', () => {
    // never-paid lapser: lapseDays 40 but hasPriorPaidTopup false → NO winback.
    const { grants } = decideApprovalBonuses(bonusInput({ hasPriorPaidTopup: false, lapseDays: 40 }));
    assert.equal(grants.some((g) => g.kind === 'winback'), false);

    // prior paid + 40 days lapsed → winback 20%.
    const wb = decideApprovalBonuses(bonusInput({ hasPriorPaidTopup: true, lapseDays: 40 }));
    assert.equal(wb.grants[0].kind, 'winback');
    assert.equal(wb.grants[0].pct, WINBACK_PCT_D30);
  });

  it('winback suppressed within 90 days of a prior winback grant', () => {
    const { grants } = decideApprovalBonuses(
      bonusInput({ hasPriorPaidTopup: true, lapseDays: 40, winbackGrantInLast90d: true }),
    );
    assert.equal(grants.some((g) => g.kind === 'winback'), false);
  });
});

describe('decideApprovalBonuses — invitee stacking + 100% cap', () => {
  it('invitee 2 GB stacks on the first_purchase percentage', () => {
    const { grants } = decideApprovalBonuses(
      bonusInput({ accountAgeMs: 10 * 60 * 60 * 1000, referredBy: 'inviter-9' }),
    );
    const first = grants.find((g) => g.kind === 'first_purchase');
    const invitee = grants.find((g) => g.kind === 'invitee_referral');
    assert.equal(first?.bonusBytes, 4 * GB);
    assert.equal(invitee?.bonusBytes, INVITEE_REFERRAL_BONUS_BYTES);
  });

  it('100% cap clamps the invitee bonus (percentage first) on a sub-2.5 GB package', () => {
    // 2 GB package, first_purchase 20% = 0.4 GB → invitee clamped to 1.6 GB (total = 2 GB).
    const { grants } = decideApprovalBonuses(
      bonusInput({ volumeBytes: 2 * GB, snapshotQuotaLimitBytes: 2 * GB, accountAgeMs: HOUR(), referredBy: 'inviter-9' }),
    );
    const first = grants.find((g) => g.kind === 'first_purchase');
    const invitee = grants.find((g) => g.kind === 'invitee_referral');
    assert.equal(first?.bonusBytes, 400_000_000);
    assert.equal(invitee?.bonusBytes, 1_600_000_000);
    const total = grants.reduce((s, g) => s + g.bonusBytes, 0);
    assert.equal(total, 2 * GB);
  });

  it('a self-referral earns no invitee bonus', () => {
    const { grants } = decideApprovalBonuses(bonusInput({ accountAgeMs: HOUR(), referredBy: 'buyer-1' }));
    assert.equal(grants.some((g) => g.kind === 'invitee_referral'), false);
  });
});

describe('decideApprovalBonuses — global skips', () => {
  it('no grants when unpaid, unlimited, or reseller-settled', () => {
    assert.deepEqual(decideApprovalBonuses(bonusInput({ amountMinor: 0, accountAgeMs: HOUR() })).grants, []);
    assert.deepEqual(decideApprovalBonuses(bonusInput({ snapshotQuotaLimitBytes: null, accountAgeMs: HOUR() })).grants, []);
    assert.deepEqual(decideApprovalBonuses(bonusInput({ resellerSettled: true, accountAgeMs: HOUR() })).grants, []);
  });

  it('a disabled lever is skipped', () => {
    const { grants } = decideApprovalBonuses(
      bonusInput({ accountAgeMs: HOUR(), enabled: { ...ALL_ON, firstPurchase: false } }),
    );
    assert.equal(grants.some((g) => g.kind === 'first_purchase'), false);
  });
});

function HOUR() {
  return 60 * 60 * 1000;
}
