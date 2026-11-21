import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  USAGE_RECEIPT_ACTION,
  buildUsageReceiptMessage,
  classifyUsageReceipt,
  decideUsageReceipt,
  formatGbFa,
  formatPercentFa,
  isPermanentTelegramFailure,
  parseCardToCard,
  resolveUsageReceiptEnabled,
  resolveUsageReceiptMinPlanBytes,
  resolveUsageReceiptPct,
  toFaDigits,
  type UsageReceiptDecisionInput,
} from '../src/notifications/usage-receipt.ts';
import { renderTelegramCopy } from '../src/telegram/telegram-i18n.ts';
import { applyRtlGuard } from '../src/telegram/telegram-format.ts';

const GB = 1_000_000_000;

function input(over: Partial<UsageReceiptDecisionInput>): UsageReceiptDecisionInput {
  return {
    quotaLimitBytes: 50 * GB,
    usedBytes: 25 * GB,
    cycleStartUsedBytes: 0,
    thresholdPct: 50,
    minPlanBytes: 50 * GB,
    deliveries: [],
    ...over,
  };
}

const deps = { render: renderTelegramCopy, rtl: applyRtlGuard };

describe('usage-receipt env resolution', () => {
  it('enabled by default; false/0/no/off disable', () => {
    assert.equal(resolveUsageReceiptEnabled(undefined), true);
    assert.equal(resolveUsageReceiptEnabled(''), true);
    for (const off of ['false', 'FALSE', '0', 'no', ' off ']) assert.equal(resolveUsageReceiptEnabled(off), false);
  });

  it('pct defaults to 50 and clamps to 1..99', () => {
    assert.equal(resolveUsageReceiptPct(undefined), 50);
    assert.equal(resolveUsageReceiptPct(''), 50);
    assert.equal(resolveUsageReceiptPct('abc'), 50);
    assert.equal(resolveUsageReceiptPct('0'), 1);
    assert.equal(resolveUsageReceiptPct('150'), 99);
    assert.equal(resolveUsageReceiptPct('70'), 70);
  });

  it('min plan defaults to 50 GB (decimal bytes)', () => {
    assert.equal(resolveUsageReceiptMinPlanBytes(undefined), 50 * GB);
    assert.equal(resolveUsageReceiptMinPlanBytes(''), 50 * GB);
    assert.equal(resolveUsageReceiptMinPlanBytes('100'), 100 * GB);
    assert.equal(resolveUsageReceiptMinPlanBytes('0'), 0);
  });
});

describe('classifyUsageReceipt', () => {
  it('null/zero quota never classifies', () => {
    assert.equal(classifyUsageReceipt(null, 10 * GB, 0, 50), false);
    assert.equal(classifyUsageReceipt(0, 10 * GB, 0, 50), false);
  });
  it('true at/above threshold, false below (cycleStart 0 = absolute)', () => {
    assert.equal(classifyUsageReceipt(50 * GB, 25 * GB, 0, 50), true); // exactly 50%
    assert.equal(classifyUsageReceipt(50 * GB, 24 * GB, 0, 50), false);
    assert.equal(classifyUsageReceipt(50 * GB, 41.3 * GB, 0, 50), true);
  });
  it('uses CYCLE percentage when a cycle anchor is set', () => {
    // 50 GB plan, cycle starts at 20 GB used → cycle size 30 GB. 50% of cycle = 35 GB used.
    assert.equal(classifyUsageReceipt(50 * GB, 35 * GB, 20 * GB, 50), true);
    assert.equal(classifyUsageReceipt(50 * GB, 34 * GB, 20 * GB, 50), false);
    // A non-positive cycle (quota <= cycleStart) is never due.
    assert.equal(classifyUsageReceipt(50 * GB, 50 * GB, 50 * GB, 50), false);
  });
});

describe('decideUsageReceipt', () => {
  it('fires at 50% on a >= 50 GB plan', () => {
    const d = decideUsageReceipt(input({ usedBytes: 41.3 * GB }));
    assert.ok(d);
    assert.equal(d.quotaLimitBytes, 50 * GB);
    assert.equal(d.remainingBytes, Math.round(8.7 * GB));
    assert.equal(d.percentUsed, 82.6);
  });

  it('skips plans below the min plan (25 GB plan excluded)', () => {
    assert.equal(decideUsageReceipt(input({ quotaLimitBytes: 25 * GB, usedBytes: 20 * GB })), null);
  });

  it('skips when below threshold', () => {
    assert.equal(decideUsageReceipt(input({ usedBytes: 10 * GB })), null);
  });

  it('dedupes once a notice was sent for this quota value', () => {
    assert.equal(
      decideUsageReceipt(input({ usedBytes: 41 * GB, deliveries: [{ quotaLimitBytes: 50 * GB }] })),
      null,
    );
  });

  it('re-arms after a top-up raised the quota (new quota value)', () => {
    const d = decideUsageReceipt(input({ quotaLimitBytes: 100 * GB, usedBytes: 60 * GB, deliveries: [{ quotaLimitBytes: 50 * GB }] }));
    assert.ok(d);
    assert.equal(d.quotaLimitBytes, 100 * GB);
  });

  it('remaining never negative when over quota', () => {
    const d = decideUsageReceipt(input({ usedBytes: 60 * GB }));
    assert.ok(d);
    assert.equal(d.remainingBytes, 0);
  });
});

describe('Persian formatting', () => {
  it('toFaDigits maps 0-9', () => {
    assert.equal(toFaDigits('82.6'), '۸۲.۶');
    assert.equal(toFaDigits('6219861914776827'), '۶۲۱۹۸۶۱۹۱۴۷۷۶۸۲۷');
  });
  it('formatGbFa trims .0 and uses گیگ', () => {
    assert.equal(formatGbFa(50 * GB), '۵۰ گیگ');
    assert.equal(formatGbFa(Math.round(8.7 * GB)), '۸.۷ گیگ');
  });
  it('formatPercentFa one decimal with ٪', () => {
    assert.equal(formatPercentFa(82.6), '۸۲.۶٪');
    assert.equal(formatPercentFa(50), '۵۰٪');
  });
});

describe('parseCardToCard', () => {
  it('splits number|holder', () => {
    assert.deepEqual(parseCardToCard('6219861914776827|Beniamin Mahpeikar'), {
      card: '6219861914776827',
      holder: 'Beniamin Mahpeikar',
    });
  });
  it('null when unset/empty', () => {
    assert.equal(parseCardToCard(null), null);
    assert.equal(parseCardToCard('   '), null);
  });
  it('no pipe -> card only, empty holder', () => {
    assert.deepEqual(parseCardToCard('6037991122334455'), { card: '6037991122334455', holder: '' });
  });
});

describe('buildUsageReceiptMessage', () => {
  const decision = { quotaLimitBytes: 50 * GB, usedBytes: Math.round(41.3 * GB), remainingBytes: Math.round(8.7 * GB), percentUsed: 82.6 };
  const card = { card: '6219861914776827', holder: 'Beniamin Mahpeikar' };

  it('is Persian, names the customer, tap-to-copy card, mentions 24h', () => {
    const msg = buildUsageReceiptMessage(decision, 'Mahshid', card, deps);
    assert.match(msg, /سلام Mahshid جان/);
    assert.match(msg, /<code>6219861914776827<\/code>/);
    assert.match(msg, /Beniamin Mahpeikar/);
    assert.match(msg, /۸۲\.۶٪/);
    assert.match(msg, /۲۴ ساعت/);
    // Owner intent: "used X% + not renewed yet + pay to continue + send the receipt photo".
    assert.match(msg, /هنوز تمدیدش نکردی/);
    assert.match(msg, /کارت‌به‌کارت/);
    assert.match(msg, /عکس رسید رو بفرست/);
    // Persian-only: no English sentences in the body.
    assert.doesNotMatch(msg, /You have used/);
    assert.doesNotMatch(msg, /you've used/i);
  });

  it('falls back to a neutral greeting when no name', () => {
    const msg = buildUsageReceiptMessage(decision, null, card, deps);
    assert.match(msg, /سلام دوست عزیز/);
  });

  it('HTML-escapes a hostile display name', () => {
    const msg = buildUsageReceiptMessage(decision, '<b>x</b>', card, deps);
    assert.doesNotMatch(msg, /<b>x<\/b>/);
    assert.match(msg, /&lt;b&gt;x&lt;\/b&gt;/);
  });
});

describe('isPermanentTelegramFailure', () => {
  it('400/403 permanent; others transient', () => {
    assert.equal(isPermanentTelegramFailure(400), true);
    assert.equal(isPermanentTelegramFailure(403), true);
    assert.equal(isPermanentTelegramFailure(429), false);
    assert.equal(isPermanentTelegramFailure(500), false);
    assert.equal(isPermanentTelegramFailure(undefined), false);
  });
});

describe('USAGE_RECEIPT_ACTION', () => {
  it('is the stable audit action string', () => {
    assert.equal(USAGE_RECEIPT_ACTION, 'customer.usage_receipt.notified');
  });
});
