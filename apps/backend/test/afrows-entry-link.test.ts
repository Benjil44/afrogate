import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAfrowsEntryUri,
  readAfrowsDeEntryEnv,
  readAfrowsInboundEnv,
  readAfrowsRealityEnv,
} from '../src/client/afrows-entry-link.ts';

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

// Deployed default: Germany is a VLESS+WS+TLS entry fronted by Cloudflare (de.afrows.com:443).
const DE_ENV = {
  AFROWS_DE_ENTRY_ENABLED: 'true',
  AFROWS_DE_ENTRY_HOST: 'de.afrows.com',
  AFROWS_DE_ENTRY_PORT: '443',
  AFROWS_DE_ENTRY_SNI: 'de.afrows.com',
  AFROWS_DE_ENTRY_WS_PATH: '/afrowsws',
};

test('readAfrowsDeEntryEnv off by default (flag unset) and when disabled', () => {
  assert.equal(readAfrowsDeEntryEnv({}), null);
  assert.equal(readAfrowsDeEntryEnv({ ...DE_ENV, AFROWS_DE_ENTRY_ENABLED: 'false' }), null);
});

test('readAfrowsDeEntryEnv null when enabled but missing host/sni', () => {
  assert.equal(readAfrowsDeEntryEnv({ ...DE_ENV, AFROWS_DE_ENTRY_HOST: '' }), null);
  assert.equal(readAfrowsDeEntryEnv({ ...DE_ENV, AFROWS_DE_ENTRY_SNI: undefined }), null);
});

test('readAfrowsDeEntryEnv (reality mode) null when missing pbk/sid', () => {
  const rEnv = { ...DE_ENV, AFROWS_DE_ENTRY_MODE: 'reality' };
  assert.equal(readAfrowsDeEntryEnv({ ...rEnv, AFROWS_DE_ENTRY_PBK: '' }), null);
});

test('readAfrowsDeEntryEnv builds the Germany WS+TLS entry when enabled + configured', () => {
  const cfg = readAfrowsDeEntryEnv(DE_ENV);
  assert.equal(cfg?.mode, 'ws');
  assert.equal(cfg?.host, 'de.afrows.com');
  assert.equal(cfg?.port, 443);
  assert.equal(cfg?.wsPath, '/afrowsws');
  const uri = buildAfrowsEntryUri(cfg!, 'uuid-de', 'Afrows Germany');
  assert.match(uri, /^vless:\/\/uuid-de@de\.afrows\.com:443\?/);
  assert.match(uri, /security=tls/);
  assert.match(uri, /type=ws/);
  assert.match(uri, /path=%2Fafrowsws/);
  assert.match(uri, /#Afrows%20Germany$/);
});

test('subscription entry order: Germany first, Ireland reality as fallback when DE on', () => {
  const de = readAfrowsDeEntryEnv(DE_ENV);
  const ie = readAfrowsRealityEnv({
    AFROWS_REALITY_HOST: '1.2.3.4',
    AFROWS_REALITY_SNI: 'x.com',
    AFROWS_REALITY_PBK: 'IE_PBK',
    AFROWS_REALITY_SID: 'IE_SID',
  });
  // Mirrors billing.service assembly: [deEntryLink, ...ireland].filter(Boolean)
  const ordered = [de, ie].filter((x): x is NonNullable<typeof x> => x !== null);
  assert.equal(ordered.length, 2);
  assert.equal(ordered[0]?.host, 'de.afrows.com'); // Germany primary
  assert.equal(ordered[1]?.host, '1.2.3.4'); // Ireland fallback
});

test('subscription entry order: DE omitted when flag off, Ireland stays primary', () => {
  const de = readAfrowsDeEntryEnv({ ...DE_ENV, AFROWS_DE_ENTRY_ENABLED: 'off' });
  const ie = readAfrowsRealityEnv({
    AFROWS_REALITY_HOST: '1.2.3.4',
    AFROWS_REALITY_SNI: 'x.com',
    AFROWS_REALITY_PBK: 'IE_PBK',
    AFROWS_REALITY_SID: 'IE_SID',
  });
  const ordered = [de, ie].filter((x): x is NonNullable<typeof x> => x !== null);
  assert.equal(ordered.length, 1);
  assert.equal(ordered[0]?.host, '1.2.3.4'); // Ireland only
});
