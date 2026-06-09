import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAfrowsEntryUri, readAfrowsInboundEnv } from '../src/client/afrows-entry-link.ts';

test('builds a ws+tls entry uri', () => {
  const uri = buildAfrowsEntryUri(
    { mode: 'ws', host: '94.74.145.199', port: 443, serverName: 'app.afrows.com', fingerprint: 'chrome', wsPath: '/afrowsws', wsHost: 'app.afrows.com' },
    '00113fad-42da-4be7-ae1e-cce226baf47e',
    'Afrows',
  );
  assert.match(uri, /^vless:\/\/00113fad-42da-4be7-ae1e-cce226baf47e@94\.74\.145\.199:443\?/);
  assert.match(uri, /security=tls/);
  assert.match(uri, /type=ws/);
  assert.match(uri, /path=%2Fafrowsws/);
  assert.match(uri, /host=app\.afrows\.com/);
  assert.match(uri, /#Afrows$/);
});

test('builds a reality entry uri', () => {
  const uri = buildAfrowsEntryUri(
    { mode: 'reality', host: '1.2.3.4', port: 443, serverName: 'x.com', fingerprint: 'chrome', publicKey: 'PBK', shortId: 'SID', flow: 'xtls-rprx-vision' },
    'uuid-1',
    'Afrows',
  );
  assert.match(uri, /security=reality/);
  assert.match(uri, /pbk=PBK/);
  assert.match(uri, /sid=SID/);
  assert.match(uri, /flow=xtls-rprx-vision/);
});

test('readAfrowsInboundEnv ws mode', () => {
  const cfg = readAfrowsInboundEnv({
    AFROWS_INBOUND_MODE: 'ws',
    AFROWS_INBOUND_HOST: 'app.afrows.com',
    AFROWS_INBOUND_PORT: '443',
    AFROWS_INBOUND_SNI: 'app.afrows.com',
    AFROWS_INBOUND_WS_PATH: '/afrowsws',
  });
  assert.equal(cfg?.mode, 'ws');
  assert.equal(cfg?.wsPath, '/afrowsws');
  assert.equal(cfg?.port, 443);
});

test('readAfrowsInboundEnv reality default + null when missing', () => {
  assert.equal(readAfrowsInboundEnv({}), null);
  const cfg = readAfrowsInboundEnv({
    AFROWS_INBOUND_HOST: '1.2.3.4',
    AFROWS_INBOUND_REALITY_PBK: 'PBK',
    AFROWS_INBOUND_REALITY_SID: 'SID',
    AFROWS_INBOUND_REALITY_SNI: 'x.com',
  });
  assert.equal(cfg?.mode, 'reality');
  assert.equal(cfg?.publicKey, 'PBK');
});
