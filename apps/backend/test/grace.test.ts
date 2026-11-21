import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GRACE_CAP_MAX_BYTES,
  GRACE_LOCKOUT_MS,
  GRACE_WINDOW_MS,
  decideGrace,
  decideRejectGraceLock,
  graceCapBytes,
  inGraceAllowanceSql,
  resolveGraceEnabled,
} from '../src/billing/grace.ts';

const GB = 1_000_000_000;
const NOW = new Date('2026-11-13T00:00:00.000Z');

describe('resolveGraceEnabled', () => {
  it('defaults on; 0/false/no/off disable', () => {
    assert.equal(resolveGraceEnabled(undefined), true);
    assert.equal(resolveGraceEnabled(''), true);
    for (const off of ['0', 'false', 'NO', ' off ']) assert.equal(resolveGraceEnabled(off), false);
  });
});

describe('graceCapBytes', () => {
  it('is 10% of the plan, clamped to 3 GB', () => {
    assert.equal(graceCapBytes(20 * GB), 2 * GB); // 10% of 20 GB
    assert.equal(graceCapBytes(50 * GB), GRACE_CAP_MAX_BYTES); // 5 GB → clamped to 3 GB
    assert.equal(graceCapBytes(30 * GB), 3 * GB); // exactly 3 GB
  });
  it('never-paid tiny plan → a tiny cap', () => {
    assert.equal(graceCapBytes(1 * GB), 100_000_000); // 10% of 1 GB = 100 MB
  });
  it('fail-closed for null/invalid/zero plan → 0 cap (no overage)', () => {
    assert.equal(graceCapBytes(null), 0);
    assert.equal(graceCapBytes(0), 0);
    assert.equal(graceCapBytes(Number.NaN), 0);
    assert.equal(graceCapBytes(-5), 0);
  });
});

describe('decideGrace', () => {
  it('skips an unlimited account (quota NULL) — never cut, no grace needed', () => {
    const d = decideGrace({ graceBlockedUntil: null, quotaLimitBytes: null, planBytes: null, now: NOW });
    assert.equal(d.action, 'account_unlimited');
    assert.equal(d.graceUntil, null);
    assert.equal(d.capBytes, null);
  });

  it('skips when locked out (grace_blocked_until in the future) — request still created, grace untouched', () => {
    const d = decideGrace({
      graceBlockedUntil: new Date(NOW.getTime() + 60_000),
      quotaLimitBytes: 20 * GB,
      planBytes: 20 * GB,
      now: NOW,
    });
    assert.equal(d.action, 'grace_locked');
    assert.equal(d.graceUntil, null);
  });

  it('grants a 24h window + capped overage otherwise', () => {
    const d = decideGrace({ graceBlockedUntil: null, quotaLimitBytes: 20 * GB, planBytes: 20 * GB, now: NOW });
    assert.equal(d.action, 'grant');
    assert.equal(d.graceUntil?.getTime(), NOW.getTime() + GRACE_WINDOW_MS);
    assert.equal(d.capBytes, 2 * GB);
  });

  it('an expired lockout no longer blocks grace', () => {
    const d = decideGrace({
      graceBlockedUntil: new Date(NOW.getTime() - 1000),
      quotaLimitBytes: 20 * GB,
      planBytes: 20 * GB,
      now: NOW,
    });
    assert.equal(d.action, 'grant');
  });
});

describe('decideRejectGraceLock', () => {
  it('penalize → the later of the existing lockout and now + 30d (extend-only)', () => {
    const d = decideRejectGraceLock({ penalize: true, existingBlockedUntil: null, now: NOW });
    assert.equal(d.graceBlockedUntil?.getTime(), NOW.getTime() + GRACE_LOCKOUT_MS);

    const far = new Date(NOW.getTime() + 2 * GRACE_LOCKOUT_MS);
    const d2 = decideRejectGraceLock({ penalize: true, existingBlockedUntil: far, now: NOW });
    assert.equal(d2.graceBlockedUntil?.getTime(), far.getTime(), 'keeps the longer existing lockout');
  });

  it('pardon (penalize = false) → clears any lockout', () => {
    const d = decideRejectGraceLock({
      penalize: false,
      existingBlockedUntil: new Date(NOW.getTime() + GRACE_LOCKOUT_MS),
      now: NOW,
    });
    assert.equal(d.graceBlockedUntil, null);
  });
});

describe('inGraceAllowanceSql (fail-closed enforcement fragment)', () => {
  it('reads grace_until + the COALESCE(cap, 0) ceiling for the given alias', () => {
    const sql = inGraceAllowanceSql('ca');
    assert.match(sql, /ca\.grace_until > now\(\)/);
    assert.match(sql, /ca\.used_bytes < ca\.quota_limit_bytes \+ COALESCE\(ca\.grace_cap_bytes, 0\)/);
    // A NULL cap COALESCEs to 0, so grace grants ZERO overage (fail-closed).
  });
});
