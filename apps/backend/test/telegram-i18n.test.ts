import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TELEGRAM_COPY, renderTelegramCopy } from '../src/telegram/telegram-i18n.ts';

// v1 ids retired when v2 shipped (docs §9 "Retired v1 pieces" / §14.3).
const RETIRED_IDS = ['welcome.new', 'welcome.newNoConfig', 'acct.card', 'acct.quotaLine', 'acct.quotaUnlimited'];

// A representative slice of the v2 additions (docs §14.3) that must be present.
const REQUIRED_V2_IDS = [
  'reg.askName', 'reg.askPhone', 'reg.btn.sharePhone', 'reg.phoneOk', 'reg.finishFirst',
  'welcome.registered', 'welcome.registeredNoConfig',
  'menu.btn.invite', 'menu.btn.gems',
  'acct.cardV2', 'acct.gemsLine', 'usage.line', 'usage.zeroData', 'usage.unlimited',
  'invite.card', 'invite.btn.share', 'invite.shareText',
  'gems.card', 'gems.historyItem', 'gems.reason.signup', 'gems.reason.commission',
  'gems.reason.milestone', 'gems.reason.redeem', 'gems.reason.adjust',
  'gems.btn.redeem', 'gems.redeemPick', 'gems.redeemBtn', 'gems.redeemBtnMax',
  'gems.redeemConfirm', 'gems.btn.confirm', 'gems.redeemed', 'gems.redeemTooFew',
  'gems.toast.insufficient',
  'notify.refJoined', 'notify.refPurchase', 'notify.refMilestone',
  'common.btn.back',
];

describe('telegram i18n copy table (v2)', () => {
  it('has non-empty English and Persian wording for every id', () => {
    for (const [id, entry] of Object.entries(TELEGRAM_COPY)) {
      assert.ok(entry.en.length > 0, `empty en for ${id}`);
      assert.ok(entry.fa.length > 0, `empty fa for ${id}`);
    }
  });

  it('drops the retired v1 ids', () => {
    for (const id of RETIRED_IDS) {
      assert.equal(id in TELEGRAM_COPY, false, `retired id still present: ${id}`);
    }
  });

  it('contains the v2 additions', () => {
    for (const id of REQUIRED_V2_IDS) {
      assert.ok(id in TELEGRAM_COPY, `missing v2 id: ${id}`);
    }
  });
});

describe('renderTelegramCopy', () => {
  it('substitutes and HTML-escapes {vars}', () => {
    const out = renderTelegramCopy('cfg.itemHeader', 'en', { protocol: 'vless', label: 'a<b>&c' });
    assert.equal(out, '• vless — a&lt;b&gt;&amp;c');
  });

  it('inserts raw (already-rendered) sub-copy verbatim into the account card', () => {
    const out = renderTelegramCopy('acct.cardV2', 'en', { name: 'Hani' }, {
      status: 'Active ✅',
      usageBlock: '📊 <code>▓▓░░░░░░░░</code> <b>21%</b> used',
      gemsLine: '💎 Gems: <b>250</b> (≈ 2.5 GB)',
      activeClients: '1',
      clientCount: '2',
    });
    assert.match(out, /Status: Active ✅/);
    assert.match(out, /<code>▓▓░░░░░░░░<\/code>/); // <code> preserved (not escaped)
    assert.match(out, /💎 Gems: <b>250<\/b>/);
    assert.match(out, /Active configs: 1\/2/);
  });

  it('renders the approved notification with request id + package size', () => {
    const out = renderTelegramCopy('notify.approved', 'fa', { requestId: 'A1B2C3' }, { packageSize: '۲۰ گیگابایت' });
    assert.match(out, /A1B2C3/);
    assert.match(out, /۲۰ گیگابایت/);
  });
});
