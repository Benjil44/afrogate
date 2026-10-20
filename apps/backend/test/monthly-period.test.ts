import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAY_MS, bytesToForfeit, computePeriodCredit, isMonthEndingSoon } from '../src/billing/monthly-period.ts';

const GB = 1_000_000_000;
const now = new Date('2026-10-21T10:00:00Z');

test('non-monthly package keeps the legacy open-ended credit', () => {
  const r = computePeriodCredit({ quotaLimitBeforeBytes: 10 * GB, usedBytes: 4 * GB, volumeBytes: 5 * GB, expiresAt: null, durationDays: null, now });
  assert.equal(r.quotaLimitAfterBytes, 15 * GB);
  assert.equal(r.expiresAt, null);
  assert.equal(r.periodStarted, false);
});

test('first monthly purchase keeps the current headroom and starts a 30-day month', () => {
  const r = computePeriodCredit({ quotaLimitBeforeBytes: 10 * GB, usedBytes: 4 * GB, volumeBytes: 25 * GB, expiresAt: null, durationDays: 30, now });
  assert.equal(r.quotaLimitAfterBytes, 35 * GB);
  assert.equal(r.expiresAt?.getTime(), now.getTime() + 30 * DAY_MS);
  assert.equal(r.periodStarted, true);
});

test('buying again mid-month adds GB and keeps the end date', () => {
  const end = new Date(now.getTime() + 10 * DAY_MS);
  const r = computePeriodCredit({ quotaLimitBeforeBytes: 50 * GB, usedBytes: 45 * GB, volumeBytes: 25 * GB, expiresAt: end, durationDays: 30, now });
  assert.equal(r.quotaLimitAfterBytes, 75 * GB);
  assert.equal(r.expiresAt?.getTime(), end.getTime());
  assert.equal(r.periodStarted, false);
});

test('after the month ended the leftover is lost and a fresh month starts', () => {
  const ended = new Date(now.getTime() - DAY_MS);
  const r = computePeriodCredit({ quotaLimitBeforeBytes: 50 * GB, usedBytes: 20 * GB, volumeBytes: 50 * GB, expiresAt: ended, durationDays: 30, now });
  assert.equal(r.quotaLimitAfterBytes, 70 * GB, 'only the new 50 GB of headroom');
  assert.equal(r.expiresAt?.getTime(), now.getTime() + 30 * DAY_MS);
  assert.equal(r.periodStarted, true);
});

test('unlimited account buying a monthly package gets used + package (same as the legacy credit)', () => {
  const r = computePeriodCredit({ quotaLimitBeforeBytes: null, usedBytes: 3 * GB, volumeBytes: 25 * GB, expiresAt: null, durationDays: 30, now });
  assert.equal(r.quotaLimitAfterBytes, 28 * GB);
});

test('overflow is rejected', () => {
  assert.throws(() => computePeriodCredit({ quotaLimitBeforeBytes: Number.MAX_SAFE_INTEGER, usedBytes: 0, volumeBytes: GB, expiresAt: null, durationDays: 30, now }), RangeError);
});

test('reminder window: only within 24 h before the end, never after it or for unlimited/no-end accounts', () => {
  const base = { quotaLimitBytes: 50 * GB, usedBytes: 10 * GB };
  assert.equal(isMonthEndingSoon({ ...base, expiresAt: new Date(now.getTime() + 23 * 3600_000) }, now), true);
  assert.equal(isMonthEndingSoon({ ...base, expiresAt: new Date(now.getTime() + 25 * 3600_000) }, now), false);
  assert.equal(isMonthEndingSoon({ ...base, expiresAt: new Date(now.getTime() - 1000) }, now), false);
  assert.equal(isMonthEndingSoon({ ...base, expiresAt: null }, now), false);
  assert.equal(isMonthEndingSoon({ quotaLimitBytes: null, usedBytes: 0, expiresAt: new Date(now.getTime() + 3600_000) }, now), false);
});

test('forfeit: unused headroom once the month is over, else 0', () => {
  const ended = new Date(now.getTime() - 1000);
  assert.equal(bytesToForfeit({ quotaLimitBytes: 50 * GB, usedBytes: 20 * GB, expiresAt: ended }, now), 30 * GB);
  assert.equal(bytesToForfeit({ quotaLimitBytes: 50 * GB, usedBytes: 60 * GB, expiresAt: ended }, now), 0);
  assert.equal(bytesToForfeit({ quotaLimitBytes: 50 * GB, usedBytes: 20 * GB, expiresAt: new Date(now.getTime() + 1000) }, now), 0);
  assert.equal(bytesToForfeit({ quotaLimitBytes: null, usedBytes: 20 * GB, expiresAt: ended }, now), 0);
  assert.equal(bytesToForfeit({ quotaLimitBytes: 50 * GB, usedBytes: 20 * GB, expiresAt: null }, now), 0);
});
