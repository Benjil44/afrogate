import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LOW_QUOTA_ACTION,
  LOW_QUOTA_EXHAUSTED_FRESH_MS,
  buildLowQuotaMessage,
  classifyQuota,
  decideLowQuotaAlert,
  isPermanentTelegramFailure,
  resolveLowQuotaEnabled,
  resolveLowQuotaThresholdBytes,
  type LowQuotaDecisionInput,
} from '../src/notifications/low-quota-alert.ts';
import { TELEGRAM_COPY, renderTelegramCopy } from '../src/telegram/telegram-i18n.ts';
import { applyRtlGuard, formatDataSize } from '../src/telegram/telegram-format.ts';

const GB = 1_000_000_000;
const FIVE_GB = 5 * GB;
const NOW = new Date('2026-10-05T12:00:00Z');

function input(over: Partial<LowQuotaDecisionInput>): LowQuotaDecisionInput {
  return {
    now: NOW,
    quotaLimitBytes: 50 * GB,
    usedBytes: 0,
    thresholdBytes: FIVE_GB,
    lastActivityAt: NOW,
    deliveries: [],
    ...over,
  };
}

const deps = { render: renderTelegramCopy, rtl: applyRtlGuard, formatSize: formatDataSize };

describe('low-quota env resolution', () => {
  it('threshold defaults to 5 GB (decimal, 5e9 bytes)', () => {
    assert.equal(resolveLowQuotaThresholdBytes(undefined), 5_000_000_000);
    assert.equal(resolveLowQuotaThresholdBytes(''), 5_000_000_000);
    assert.equal(resolveLowQuotaThresholdBytes('abc'), 5_000_000_000);
  });

  it('threshold clamps to 1..1000 GB and accepts decimals', () => {
    assert.equal(resolveLowQuotaThresholdBytes('0'), 1 * GB);
    assert.equal(resolveLowQuotaThresholdBytes('-3'), 1 * GB);
    assert.equal(resolveLowQuotaThresholdBytes('5000'), 1000 * GB);
    assert.equal(resolveLowQuotaThresholdBytes('2.5'), 2_500_000_000);
    assert.equal(resolveLowQuotaThresholdBytes(' 10 '), 10 * GB);
  });

  it('enabled by default; false/0/no/off disable', () => {
    assert.equal(resolveLowQuotaEnabled(undefined), true);
    assert.equal(resolveLowQuotaEnabled(''), true);
    assert.equal(resolveLowQuotaEnabled('true'), true);
    for (const off of ['false', 'FALSE', '0', 'no', ' off ']) assert.equal(resolveLowQuotaEnabled(off), false);
  });
});

describe('classifyQuota — threshold boundaries (bytes)', () => {
  it('no quota / zero quota never alerts', () => {
    assert.equal(classifyQuota(null, 10 * GB, FIVE_GB), null);
    assert.equal(classifyQuota(0, 0, FIVE_GB), null);
  });

  it('remaining exactly at the threshold is low; one byte above is not', () => {
    assert.equal(classifyQuota(50 * GB, 45 * GB, FIVE_GB), 'low');
    assert.equal(classifyQuota(50 * GB, 45 * GB - 1, FIVE_GB), null);
  });

  it('one byte left is low; zero or negative remaining is exhausted', () => {
    assert.equal(classifyQuota(50 * GB, 50 * GB - 1, FIVE_GB), 'low');
    assert.equal(classifyQuota(50 * GB, 50 * GB, FIVE_GB), 'exhausted');
    assert.equal(classifyQuota(50 * GB, 51 * GB, FIVE_GB), 'exhausted');
  });
});

describe('decideLowQuotaAlert — dedupe per quota value', () => {
  it('alerts once when remaining dips under the threshold', () => {
    const decision = decideLowQuotaAlert(input({ usedBytes: 46 * GB }));
    assert.deepEqual(decision, { kind: 'low', quotaLimitBytes: 50 * GB, remainingBytes: 4 * GB });
  });

  it('stays silent with plenty left', () => {
    assert.equal(decideLowQuotaAlert(input({ usedBytes: 10 * GB })), null);
  });

  it('does not repeat the low notice for the same quota value', () => {
    const deliveries = [{ kind: 'low' as const, quotaLimitBytes: 50 * GB }];
    assert.equal(decideLowQuotaAlert(input({ usedBytes: 47 * GB, deliveries })), null);
    assert.equal(decideLowQuotaAlert(input({ usedBytes: 49.9 * GB, deliveries })), null);
  });

  it('re-arms after a top-up raises quota_limit_bytes', () => {
    // Was 50 GB, low notice sent; customer bought 20 GB -> quota = used + 20 GB.
    const deliveries = [{ kind: 'low' as const, quotaLimitBytes: 50 * GB }];
    const toppedUp = 47 * GB + 20 * GB;
    assert.equal(decideLowQuotaAlert(input({ quotaLimitBytes: toppedUp, usedBytes: 47 * GB, deliveries })), null);
    const decision = decideLowQuotaAlert(input({ quotaLimitBytes: toppedUp, usedBytes: 63 * GB, deliveries }));
    assert.deepEqual(decision, { kind: 'low', quotaLimitBytes: toppedUp, remainingBytes: 4 * GB });
  });

  it('exhausted is a separate kind: sent after a low notice, once per quota value', () => {
    const low = [{ kind: 'low' as const, quotaLimitBytes: 50 * GB }];
    const decision = decideLowQuotaAlert(input({ usedBytes: 50.2 * GB, deliveries: low }));
    assert.deepEqual(decision, { kind: 'exhausted', quotaLimitBytes: 50 * GB, remainingBytes: 0 });
    const both = [...low, { kind: 'exhausted' as const, quotaLimitBytes: 50 * GB }];
    assert.equal(decideLowQuotaAlert(input({ usedBytes: 50.2 * GB, deliveries: both })), null);
  });

  it('skips straight to exhausted when the low window was missed', () => {
    assert.equal(decideLowQuotaAlert(input({ usedBytes: 50 * GB }))?.kind, 'exhausted');
  });

  it('a delivered exhausted notice does not trigger a low notice for the same quota', () => {
    const deliveries = [{ kind: 'exhausted' as const, quotaLimitBytes: 50 * GB }];
    assert.equal(decideLowQuotaAlert(input({ usedBytes: 50 * GB, deliveries })), null);
  });

  it('exhausted only for recently active accounts (no rollout spam to dormant ones)', () => {
    const stale = new Date(NOW.getTime() - LOW_QUOTA_EXHAUSTED_FRESH_MS - 1);
    assert.equal(decideLowQuotaAlert(input({ usedBytes: 50 * GB, lastActivityAt: stale })), null);
    assert.equal(decideLowQuotaAlert(input({ usedBytes: 50 * GB, lastActivityAt: null })), null);
    // Low notices are not gated by activity.
    assert.equal(decideLowQuotaAlert(input({ usedBytes: 46 * GB, lastActivityAt: stale }))?.kind, 'low');
  });

  it('deliveries for other kinds / quota values never suppress', () => {
    const deliveries = [
      { kind: 'low' as const, quotaLimitBytes: 30 * GB },
      { kind: 'exhausted' as const, quotaLimitBytes: 50 * GB },
    ];
    assert.equal(decideLowQuotaAlert(input({ usedBytes: 46 * GB, deliveries }))?.kind, 'low');
  });
});

describe('isPermanentTelegramFailure', () => {
  it('only 400/403 are permanent', () => {
    assert.equal(isPermanentTelegramFailure(403), true);
    assert.equal(isPermanentTelegramFailure(400), true);
    for (const code of [undefined, 429, 500, 502]) assert.equal(isPermanentTelegramFailure(code), false);
  });
});

describe('buildLowQuotaMessage — copy', () => {
  const low = { kind: 'low' as const, quotaLimitBytes: 50 * GB, remainingBytes: 4_500_000_000 };

  it('stored language -> that language only, with the exact remaining amount', () => {
    const en = buildLowQuotaMessage(low, 'en', deps);
    assert.match(en, /<b>4\.5 GB<\/b>/);
    assert.match(en, /Buy Data/);
    assert.doesNotMatch(en, /گیگابایت/);
    const fa = buildLowQuotaMessage(low, 'fa', deps);
    assert.match(fa, /۴٫۵ گیگابایت/);
    assert.doesNotMatch(fa, /Buy Data/);
  });

  it('no stored language -> bilingual, Persian first then English', () => {
    const text = buildLowQuotaMessage(low, null, deps);
    const faAt = text.indexOf('۴٫۵ گیگابایت');
    const enAt = text.indexOf('4.5 GB');
    assert.ok(faAt >= 0 && enAt > faAt, 'Persian block must precede English');
    assert.ok(text.includes('— — —'));
  });

  it('exhausted message mentions recharge and never shows a negative amount', () => {
    const text = buildLowQuotaMessage({ kind: 'exhausted', quotaLimitBytes: 50 * GB, remainingBytes: 0 }, null, deps);
    assert.match(text, /Your data is finished/);
    assert.match(text, /حجم شما تمام شد/);
    assert.doesNotMatch(text, /-\d/);
  });

  it('copy exists in both languages and uses the {remaining} token only where needed', () => {
    for (const id of ['notify.lowQuota', 'notify.quotaExhausted'] as const) {
      assert.ok(TELEGRAM_COPY[id].en.trim() && TELEGRAM_COPY[id].fa.trim());
    }
    assert.ok(TELEGRAM_COPY['notify.lowQuota'].en.includes('{remaining}'));
    assert.ok(TELEGRAM_COPY['notify.lowQuota'].fa.includes('{remaining}'));
  });

  it('audit actions are distinct per kind', () => {
    assert.notEqual(LOW_QUOTA_ACTION.low, LOW_QUOTA_ACTION.exhausted);
    assert.equal(LOW_QUOTA_ACTION.low, 'customer.low_quota.notified');
  });
});
