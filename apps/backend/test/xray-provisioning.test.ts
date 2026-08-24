import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAcrossEndpoints,
  buildAddUserConfig,
  buildProvisioningEndpoints,
  parseInboundTargets,
  provisioningEmail,
  type ProvisioningEndpoint,
} from '../src/client/xray-provisioning.ts';

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

test('parseInboundTargets parses tag:port[:flow] and falls back', () => {
  assert.deepEqual(parseInboundTargets('', 'afrows-in', 8443), [{ tag: 'afrows-in', port: 8443 }]);
  assert.deepEqual(parseInboundTargets(undefined, 'afrows-in', 8443), [{ tag: 'afrows-in', port: 8443 }]);
  assert.deepEqual(
    parseInboundTargets('afrows-in:8447,afrows-reality:8443:xtls-rprx-vision', 'afrows-in', 8443),
    [
      { tag: 'afrows-in', port: 8447, flow: undefined },
      { tag: 'afrows-reality', port: 8443, flow: 'xtls-rprx-vision' },
    ],
  );
  // bad port clamps to fallback
  assert.deepEqual(parseInboundTargets('afrows-in:99999', 'afrows-in', 8443), [
    { tag: 'afrows-in', port: 8443, flow: undefined },
  ]);
});

test('buildProvisioningEndpoints: Ireland only when DE api server unset (default off)', () => {
  const eps = buildProvisioningEndpoints({ AFROWS_XRAY_API_SERVER: '127.0.0.1:10085' });
  assert.equal(eps.length, 1);
  assert.equal(eps[0].label, 'ie');
  assert.equal(eps[0].apiServer, '127.0.0.1:10085');
});

test('buildProvisioningEndpoints: Ireland first, Germany appended when DE api server set', () => {
  const eps = buildProvisioningEndpoints({
    AFROWS_XRAY_API_SERVER: '127.0.0.1:10085',
    AFROWS_XRAY_INBOUND_TAGS: 'afrows-in:8447,afrows-reality:8443',
    AFROWS_XRAY_DE_API_SERVER: '127.0.0.1:10086',
  });
  assert.equal(eps.length, 2);
  assert.equal(eps[0].label, 'ie');
  assert.equal(eps[1].label, 'de');
  assert.equal(eps[1].apiServer, '127.0.0.1:10086');
  assert.deepEqual(eps[1].targets, [{ tag: 'afrows-de-in', port: 8443, flow: undefined }]);
});

const IE_EP: ProvisioningEndpoint = {
  label: 'ie',
  apiServer: '127.0.0.1:10085',
  targets: [{ tag: 'afrows-in', port: 8447 }],
};
const DE_EP: ProvisioningEndpoint = {
  label: 'de',
  apiServer: '127.0.0.1:10086',
  targets: [{ tag: 'afrows-de-in', port: 8443 }],
};

test('applyAcrossEndpoints: Germany down does NOT block Ireland (best-effort isolation)', async () => {
  const errors: string[] = [];
  const ok = await applyAcrossEndpoints(
    [IE_EP, DE_EP],
    async (endpoint) => {
      if (endpoint.label === 'de') throw new Error('village route down');
    },
    (endpoint) => errors.push(endpoint.label),
  );
  assert.equal(ok.get('127.0.0.1:10085'), true); // Ireland provisioned
  assert.equal(ok.get('127.0.0.1:10086'), false); // Germany failed, isolated
  assert.deepEqual(errors, ['de']);
});

test('applyAcrossEndpoints: both succeed when both reachable', async () => {
  const seen: string[] = [];
  const ok = await applyAcrossEndpoints([IE_EP, DE_EP], async (endpoint, target) => {
    seen.push(`${endpoint.label}/${target.tag}`);
  });
  assert.equal(ok.get('127.0.0.1:10085'), true);
  assert.equal(ok.get('127.0.0.1:10086'), true);
  assert.deepEqual(seen, ['ie/afrows-in', 'de/afrows-de-in']);
});
