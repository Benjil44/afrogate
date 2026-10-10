import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildConfigLinksMessage,
  configLinksQrCaptionId,
  configLinksQrPayload,
  fitConfigBlocks,
  renderConfigLinksBlock,
  renderTelegramCopy,
  type ConfigLinkBundle,
} from '../src/telegram/telegram-i18n.ts';

const GERMANY = 'vless://u@de.afrows.com:443?security=tls&type=ws#ben%20%C2%B7%20Germany';
const IRAN = 'vless://u@94.74.145.199:443?security=tls&type=ws#ben%20%C2%B7%20Shatel';
const SUB = 'https://app.afrows.com/sub/AbCdEfGhIjKlMnOpQrStUvWxYz012345';

const full: ConfigLinkBundle = {
  links: [
    { kind: 'germany', uri: GERMANY },
    { kind: 'iran', uri: IRAN },
  ],
  subscriptionUrl: SUB,
};

describe('telegram config links message', () => {
  for (const language of ['en', 'fa'] as const) {
    it(`labels both links and the subscription URL (${language})`, () => {
      const text = buildConfigLinksMessage(full, language);
      const germanyLabel = renderTelegramCopy('cfg.link.germany', language);
      const shatelLabel = renderTelegramCopy('cfg.link.shatel', language);
      const subLabel = renderTelegramCopy('cfg.subscription', language);
      assert.ok(text.includes(`${germanyLabel}\n<code>${GERMANY.replace(/&/g, '&amp;')}</code>`));
      assert.ok(text.includes(`${shatelLabel}\n<code>${IRAN.replace(/&/g, '&amp;')}</code>`));
      assert.ok(text.includes(`${subLabel}\n<code>${SUB}</code>`));
      assert.ok(text.indexOf(germanyLabel) < text.indexOf(shatelLabel), 'Germany first');
      assert.ok(text.indexOf(shatelLabel) < text.indexOf(subLabel), 'subscription last');
      assert.ok(text.startsWith(renderTelegramCopy('cfg.pushTitle', language)));
      assert.ok(text.endsWith(renderTelegramCopy('cfg.privateNote', language)));
      assert.ok(text.length < 4096);
    });
  }

  it('HTML-escapes URLs so a crafted value cannot break the markup', () => {
    const block = renderConfigLinksBlock({ links: [{ kind: 'germany', uri: 'vless://a<b>&c' }], subscriptionUrl: null }, 'en');
    assert.ok(block.includes('<code>vless://a&lt;b&gt;&amp;c</code>'));
    assert.ok(!block.includes(renderTelegramCopy('cfg.subscription', 'en')), 'no subscription line without a URL');
  });

  it('copy for the new ids is bilingual', () => {
    for (const id of ['cfg.link.germany', 'cfg.link.shatel', 'cfg.subscription', 'cfg.pushTitle', 'cfg.privateNote', 'cfg.qrCaptionSubscription'] as const) {
      assert.notEqual(renderTelegramCopy(id, 'en'), renderTelegramCopy(id, 'fa'), id);
    }
  });
});

describe('telegram config QR', () => {
  it('encodes the subscription URL when available, else the first link', () => {
    assert.equal(configLinksQrPayload(full), SUB);
    assert.equal(configLinksQrCaptionId(full), 'cfg.qrCaptionSubscription');
    const noSub = { ...full, subscriptionUrl: null };
    assert.equal(configLinksQrPayload(noSub), GERMANY);
    assert.equal(configLinksQrCaptionId(noSub), 'cfg.qrCaption');
    assert.equal(configLinksQrPayload({ links: [], subscriptionUrl: null }), null);
  });
});

describe('fitConfigBlocks', () => {
  it('keeps blocks under the budget and flags truncation, always keeping the first', () => {
    assert.deepEqual(fitConfigBlocks(['a'.repeat(10), 'b'.repeat(10)], 100), { kept: ['a'.repeat(10), 'b'.repeat(10)], truncated: false });
    assert.deepEqual(fitConfigBlocks(['a'.repeat(60), 'b'.repeat(60)], 100), { kept: ['a'.repeat(60)], truncated: true });
    assert.deepEqual(fitConfigBlocks(['a'.repeat(500)], 100), { kept: ['a'.repeat(500)], truncated: false });
  });
});
