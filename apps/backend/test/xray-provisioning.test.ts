import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAddUserConfig, provisioningEmail } from '../src/client/xray-provisioning.ts';

test('buildAddUserConfig produces an adu-compatible inbound with the user', () => {
  const cfg = buildAddUserConfig({
    inboundTag: 'afrows-in',
    port: 8443,
    uuid: '00113fad-42da-4be7-ae1e-cce226baf47e',
    email: 'cc_abc@afrows',
    flow: 'xtls-rprx-vision',
  }) as any;

  const inbound = cfg.inbounds[0];
  assert.equal(inbound.tag, 'afrows-in');
  assert.equal(inbound.port, 8443); // required or xray errors "no Port"
  assert.equal(inbound.protocol, 'vless');
  assert.equal(inbound.settings.decryption, 'none');
  const client = inbound.settings.clients[0];
  assert.equal(client.id, '00113fad-42da-4be7-ae1e-cce226baf47e');
  assert.equal(client.email, 'cc_abc@afrows'); // email required to be listable/removable
  assert.equal(client.flow, 'xtls-rprx-vision');
  assert.equal(client.level, 0);
});

test('provisioningEmail derives a stable per-client-config email', () => {
  assert.equal(provisioningEmail('abc-123'), 'cc_abc-123@afrows');
});
