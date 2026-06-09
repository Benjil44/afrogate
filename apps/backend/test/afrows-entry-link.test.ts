import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAfrowsEntryUri, readAfrowsInboundEnv } from '../src/client/afrows-entry-link.ts';

test('builds a vless reality entry uri', () => {
  const uri = buildAfrowsEntryUri(
    {
      host: '94.74.145.199',
      port: 8443,
      publicKey: 'PBK123',
      shortId: 'SID123',
      serverName: 'www.digikala.com',
      flow: 'xtls-rprx-vision',
      fingerprint: 'chrome',
    },
    '00113fad-42da-4be7-ae1e-cce226baf47e',
    'Afrows',
  );
  assert.match(uri, /^vless:\/\/00113fad-42da-4be7-ae1e-cce226baf47e@94\.74\.145\.199:8443\?/);
  assert.match(uri, /security=reality/);
  assert.match(uri, /sni=www\.digikala\.com/);
  assert.match(uri, /pbk=PBK123/);
  assert.match(uri, /sid=SID123/);
  assert.match(uri, /flow=xtls-rprx-vision/);
  assert.match(uri, /#Afrows$/);
});

test('readAfrowsInboundEnv returns null when host or keys are missing', () => {
  assert.equal(readAfrowsInboundEnv({}), null);
  assert.equal(readAfrowsInboundEnv({ AFROWS_INBOUND_HOST: 'x' }), null);
});

test('readAfrowsInboundEnv parses a full env set', () => {
  const cfg = readAfrowsInboundEnv({
    AFROWS_INBOUND_HOST: '1.2.3.4',
    AFROWS_INBOUND_PORT: '8443',
    AFROWS_INBOUND_REALITY_PBK: 'PBK',
    AFROWS_INBOUND_REALITY_SID: 'SID',
    AFROWS_INBOUND_REALITY_SNI: 'www.digikala.com',
  });
  assert.equal(cfg?.host, '1.2.3.4');
  assert.equal(cfg?.port, 8443);
  assert.equal(cfg?.publicKey, 'PBK');
  assert.equal(cfg?.flow, 'xtls-rprx-vision'); // default
});
