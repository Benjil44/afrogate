import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyRtlGuard,
  buildConfigLabel,
  escapeHtml,
  formatAmount,
  formatCardNumber,
  formatCount,
  formatDataSize,
  formatGemsGb,
  formatSignedGems,
  parseCardToCard,
  phoneNationalDigits,
  toPersianDigits,
  usagePercent,
  usageProgressBar,
} from '../src/telegram/telegram-format.ts';

describe('formatDataSize', () => {
  it('formats decimal GB/MB in English', () => {
    assert.equal(formatDataSize(1_000_000_000, 'en'), '1 GB');
    assert.equal(formatDataSize(20_000_000_000, 'en'), '20 GB');
    assert.equal(formatDataSize(500_000_000, 'en'), '500 MB');
    assert.equal(formatDataSize(1_500_000_000, 'en'), '1.5 GB');
  });

  it('uses Persian digits + spelled units in Persian', () => {
    assert.equal(formatDataSize(20_000_000_000, 'fa'), '۲۰ گیگابایت');
    assert.equal(formatDataSize(500_000_000, 'fa'), '۵۰۰ مگابایت');
    assert.equal(formatDataSize(1_500_000_000, 'fa'), '۱٫۵ گیگابایت');
  });
});

describe('formatAmount', () => {
  it('groups thousands and appends the localized currency word', () => {
    assert.equal(formatAmount(90_000, 'toman', 'en'), '90,000 Toman');
    assert.equal(formatAmount(90_000, 'toman', 'fa'), '۹۰٬۰۰۰ تومان');
  });
});

describe('toPersianDigits', () => {
  it('converts digits and separators', () => {
    assert.equal(toPersianDigits('1,234.5'), '۱٬۲۳۴٫۵');
  });
});

describe('escapeHtml', () => {
  it('escapes &, <, >', () => {
    assert.equal(escapeHtml('a<b>&"c'), 'a&lt;b&gt;&amp;"c');
  });
});

describe('formatCount', () => {
  it('localizes integers', () => {
    assert.equal(formatCount(3, 'en'), '3');
    assert.equal(formatCount(12, 'fa'), '۱۲');
  });
});

describe('formatCardNumber', () => {
  it('groups a 16-digit card number in 4s', () => {
    assert.equal(formatCardNumber('6037991122334455'), '6037 9911 2233 4455');
  });
});

describe('parseCardToCard', () => {
  it('splits a newline-separated number + holder and groups the number', () => {
    const parsed = parseCardToCard('6037991122334455\nAli Rezaei');
    assert.equal(parsed.cardNumber, '6037 9911 2233 4455');
    assert.equal(parsed.cardHolder, 'Ali Rezaei');
  });

  it('splits a pipe-separated value', () => {
    const parsed = parseCardToCard('6037 9911 2233 4455 | Sara');
    assert.equal(parsed.cardNumber, '6037 9911 2233 4455');
    assert.equal(parsed.cardHolder, 'Sara');
  });

  it('handles a number-only value (empty holder)', () => {
    const parsed = parseCardToCard('6037991122334455');
    assert.equal(parsed.cardNumber, '6037 9911 2233 4455');
    assert.equal(parsed.cardHolder, '');
  });
});

describe('buildConfigLabel (v2 named config)', () => {
  it('joins the Latin name runs with the national phone digits', () => {
    assert.equal(buildConfigLabel('Hani', '989121234567'), 'Hani-09121234567');
    assert.equal(buildConfigLabel('Ali Rezaei', '09121234567'), 'AliRezaei-09121234567');
  });

  it('falls back to the phone digits alone for a non-Latin name', () => {
    assert.equal(buildConfigLabel('علی', '989121234567'), '09121234567');
  });
});

describe('phoneNationalDigits', () => {
  it('maps an Iran E.164 number to its national 0-prefixed form', () => {
    assert.equal(phoneNationalDigits('989121234567'), '09121234567');
    assert.equal(phoneNationalDigits('09121234567'), '09121234567');
  });
});

describe('usagePercent + usageProgressBar', () => {
  it('computes a capped whole-number percentage', () => {
    assert.equal(usagePercent(5_000_000_000, 20_000_000_000), 25);
    assert.equal(usagePercent(30_000_000_000, 20_000_000_000), 100);
    assert.equal(usagePercent(0, 0), 0);
  });

  it('renders a 10-cell bar, with at least one filled cell once data is used', () => {
    assert.equal(usageProgressBar(25, 5_000_000_000), '▓▓▓░░░░░░░');
    assert.equal(usageProgressBar(0, 100), '▓░░░░░░░░░');
    assert.equal(usageProgressBar(0, 0), '░░░░░░░░░░');
  });
});

describe('formatGemsGb + formatSignedGems', () => {
  it('shows the GB equivalent of a gems balance at the rate', () => {
    assert.equal(formatGemsGb(250, 100, 'en'), '2.5');
    assert.equal(formatGemsGb(250, 100, 'fa'), '۲٫۵');
  });

  it('renders a signed gems delta (+/− with localized digits)', () => {
    assert.equal(formatSignedGems(50, 'en'), '+50');
    assert.equal(formatSignedGems(-100, 'en'), '−100');
    assert.equal(formatSignedGems(50, 'fa'), '+۵۰');
  });
});

describe('applyRtlGuard', () => {
  it('prefixes Persian lines that begin with an emoji/tag with U+200F', () => {
    const guarded = applyRtlGuard('🎉 خوش آمدید', 'fa');
    assert.equal(guarded, '‏🎉 خوش آمدید');
  });

  it('leaves lines that begin with a Persian letter untouched', () => {
    assert.equal(applyRtlGuard('خوش آمدید', 'fa'), 'خوش آمدید');
  });

  it('keeps copyable <code> payload lines LTR (no prefix)', () => {
    const text = 'سلام\n<code>vless://abc</code>';
    assert.equal(applyRtlGuard(text, 'fa'), 'سلام\n<code>vless://abc</code>');
  });

  it('is a no-op for English', () => {
    assert.equal(applyRtlGuard('🎉 Welcome', 'en'), '🎉 Welcome');
  });
});
