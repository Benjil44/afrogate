import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyRtlGuard,
  escapeHtml,
  formatAmount,
  formatCardNumber,
  formatCount,
  formatDataSize,
  parseCardToCard,
  toPersianDigits,
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
