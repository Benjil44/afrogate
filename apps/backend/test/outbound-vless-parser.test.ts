import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVlessUrl } from '../src/operations/outbound-vless-parser.ts';

test('parses a vless:// link into name + self-contained config', () => {
  const url =
    'vless://11111111-1111-1111-1111-111111111111@example.com:443?encryption=none&security=tls&sni=example.com&type=ws&host=example.com&path=%2Fws#My%20VLESS';
  const r = parseVlessUrl(url);
  assert.equal(r.name, 'My VLESS');
  assert.equal(r.type, 'vless');
  assert.equal(r.config.address, 'example.com');
  assert.equal(r.config.port, 443);
  assert.equal(r.config.uuid, '11111111-1111-1111-1111-111111111111');
  assert.equal(r.config.security, 'tls');
  assert.equal(r.config.serverName, 'example.com');
  assert.equal(r.config.network, 'ws');
  assert.equal(r.config.path, '/ws');
});

test('defaults port to 443 and name to address:port', () => {
  const r = parseVlessUrl('vless://22222222-2222-2222-2222-222222222222@host.tld');
  assert.equal(r.config.port, 443);
  assert.equal(r.name, 'host.tld:443');
});

test('rejects non-vless input', () => {
  assert.throws(() => parseVlessUrl('https://example.com'), /vless/i);
});
