import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildXraySpeedTestConfig } from '../src/outbound/outbound-xray-config.ts';

test('builds a socks inbound on the given port and a vless outbound', () => {
  const cfg = buildXraySpeedTestConfig(
    {
      address: '185.252.28.28',
      port: 25760,
      uuid: '0dda64ff-6648-4e15-9124-d4ac4277c581',
      encryption: 'none',
      security: 'none',
      network: 'tcp',
      headerType: 'http',
      host: 'telewebion.ir',
    },
    10900,
  ) as any;

  assert.equal(cfg.inbounds[0].protocol, 'socks');
  assert.equal(cfg.inbounds[0].listen, '127.0.0.1');
  assert.equal(cfg.inbounds[0].port, 10900);

  const out = cfg.outbounds[0];
  assert.equal(out.protocol, 'vless');
  const vnext = out.settings.vnext[0];
  assert.equal(vnext.address, '185.252.28.28');
  assert.equal(vnext.port, 25760);
  assert.equal(vnext.users[0].id, '0dda64ff-6648-4e15-9124-d4ac4277c581');
  assert.equal(vnext.users[0].encryption, 'none');

  assert.equal(out.streamSettings.network, 'tcp');
  assert.equal(out.streamSettings.security, 'none');
  // http header obfuscation carried into tcpSettings
  assert.equal(out.streamSettings.tcpSettings.header.type, 'http');
  assert.deepEqual(out.streamSettings.tcpSettings.header.request.headers.Host, ['telewebion.ir']);
});

test('maps tls + ws stream settings', () => {
  const cfg = buildXraySpeedTestConfig(
    {
      address: 'example.com',
      port: 443,
      uuid: '11111111-1111-1111-1111-111111111111',
      security: 'tls',
      serverName: 'example.com',
      network: 'ws',
      host: 'example.com',
      path: '/ws',
      fingerprint: 'chrome',
    },
    10901,
  ) as any;

  const ss = cfg.outbounds[0].streamSettings;
  assert.equal(ss.network, 'ws');
  assert.equal(ss.security, 'tls');
  assert.equal(ss.tlsSettings.serverName, 'example.com');
  assert.equal(ss.tlsSettings.fingerprint, 'chrome');
  assert.equal(ss.wsSettings.path, '/ws');
  assert.equal(ss.wsSettings.headers.Host, 'example.com');
});

test('maps reality stream settings', () => {
  const cfg = buildXraySpeedTestConfig(
    {
      address: 'example.com',
      port: 443,
      uuid: '22222222-2222-2222-2222-222222222222',
      security: 'reality',
      serverName: 'www.microsoft.com',
      network: 'tcp',
      flow: 'xtls-rprx-vision',
      fingerprint: 'chrome',
      publicKey: 'PBK_VALUE',
      shortId: 'abc123',
    },
    10902,
  ) as any;

  const out = cfg.outbounds[0];
  assert.equal(out.settings.vnext[0].users[0].flow, 'xtls-rprx-vision');
  const ss = out.streamSettings;
  assert.equal(ss.security, 'reality');
  assert.equal(ss.realitySettings.serverName, 'www.microsoft.com');
  assert.equal(ss.realitySettings.publicKey, 'PBK_VALUE');
  assert.equal(ss.realitySettings.shortId, 'abc123');
  assert.equal(ss.realitySettings.fingerprint, 'chrome');
});

test('rejects config without address/uuid', () => {
  assert.throws(() => buildXraySpeedTestConfig({ port: 443 }, 10903), /address|uuid/i);
});
