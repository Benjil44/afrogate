import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TELEGRAM_COPY, renderTelegramCopy } from '../src/telegram/telegram-i18n.ts';

// The complete id set from docs/telegram-bot-flow-design.md §6.2 (56 ids).
const EXPECTED_IDS = [
  'lang.prompt', 'lang.btn.fa', 'lang.btn.en', 'lang.settings', 'lang.updated', 'lang.toast',
  'welcome.new', 'welcome.newNoConfig', 'welcome.back',
  'menu.title', 'menu.btn.account', 'menu.btn.buy', 'menu.btn.configs', 'menu.btn.lang', 'menu.btn.help',
  'acct.card', 'acct.quotaLine', 'acct.quotaUnlimited', 'acct.expiryLine',
  'status.active', 'status.suspended', 'status.expired', 'status.disabled',
  'cfg.title', 'cfg.itemHeader', 'cfg.importHint', 'cfg.truncated', 'cfg.empty', 'cfg.btn.open',
  'buy.btn.open', 'buy.pickPackage', 'buy.pkgBtn', 'buy.pendingApprovalNote', 'buy.resumeNote',
  'buy.payment', 'buy.needPhoto', 'buy.submitted', 'buy.cancelled', 'buy.btn.cancel',
  'buy.btn.retry', 'buy.toast.cancelled',
  'notify.approved', 'notify.rejected', 'notify.noReason',
  'help.body',
  'common.btn.menu', 'common.btn.refresh', 'common.btn.retry', 'common.toast.refreshed',
  'error.noPackages', 'error.cardUnset', 'error.photoNoCharge', 'error.accountProblem',
  'error.generic', 'error.unknownCommand', 'error.staleButton',
];

describe('telegram i18n copy table', () => {
  it('contains exactly the 56 design-doc ids', () => {
    const actual = Object.keys(TELEGRAM_COPY).sort();
    assert.equal(actual.length, 56);
    assert.deepEqual(actual, [...EXPECTED_IDS].sort());
  });

  it('has non-empty English and Persian wording for every id', () => {
    for (const id of EXPECTED_IDS) {
      const entry = TELEGRAM_COPY[id as keyof typeof TELEGRAM_COPY];
      assert.ok(entry, `missing id: ${id}`);
      assert.ok(entry.en.length > 0, `empty en for ${id}`);
      assert.ok(entry.fa.length > 0, `empty fa for ${id}`);
    }
  });
});

describe('renderTelegramCopy', () => {
  it('substitutes and HTML-escapes {vars}', () => {
    const out = renderTelegramCopy('cfg.itemHeader', 'en', { protocol: 'vless', label: 'a<b>&c' });
    assert.equal(out, '• vless — a&lt;b&gt;&amp;c');
  });

  it('inserts raw (already-rendered) sub-copy verbatim', () => {
    const out = renderTelegramCopy('acct.card', 'en', {}, {
      status: 'Active ✅',
      quotaLine: 'Data left: <b>5 GB</b> of 20 GB',
      used: '15 GB',
      activeClients: '1',
      clientCount: '2',
    });
    assert.match(out, /Status: Active ✅/);
    assert.match(out, /Data left: <b>5 GB<\/b> of 20 GB/); // <b> preserved (not escaped)
    assert.match(out, /Active configs: 1\/2/);
  });

  it('renders the approved notification with request id + package size', () => {
    const out = renderTelegramCopy('notify.approved', 'fa', { requestId: 'A1B2C3' }, { packageSize: '۲۰ گیگابایت' });
    assert.match(out, /A1B2C3/);
    assert.match(out, /۲۰ گیگابایت/);
  });
});
