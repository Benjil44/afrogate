import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DE_INBOUND_PORT,
  DE_INBOUND_TAG,
  DE_MGMT_DEFAULT_KEY,
  DE_MGMT_DEFAULT_SSH,
  buildDeAduJson,
  deAddUserArgs,
  deReadUsageArgs,
  deRemoveUserArgs,
  resolveDeMgmtConfig,
} from '../src/client/germany-mgmt.ts';

describe('resolveDeMgmtConfig (env-configurable SSH channel)', () => {
  it('defaults to root@162.19.253.235 + /etc/afrows/de_mgmt_key', () => {
    const cfg = resolveDeMgmtConfig({});
    assert.equal(cfg.sshTarget, DE_MGMT_DEFAULT_SSH);
    assert.equal(cfg.sshTarget, 'root@162.19.253.235');
    assert.equal(cfg.keyPath, DE_MGMT_DEFAULT_KEY);
    assert.equal(cfg.keyPath, '/etc/afrows/de_mgmt_key');
  });

  it('honors AFROWS_DE_MGMT_SSH / AFROWS_DE_MGMT_KEY overrides', () => {
    const cfg = resolveDeMgmtConfig({
      AFROWS_DE_MGMT_SSH: 'ops@10.0.0.9',
      AFROWS_DE_MGMT_KEY: '/keys/de',
    });
    assert.equal(cfg.sshTarget, 'ops@10.0.0.9');
    assert.equal(cfg.keyPath, '/keys/de');
  });
});

describe('buildDeAduJson (Germany WS re-provisioning payload)', () => {
  it('builds a VLESS adu payload with NO flow (WS/TLS rejects xtls flow)', () => {
    const json = buildDeAduJson('8917dc5c-7770-4e32-93c7-be28a952b1b8', 'cc_d719c7d2@afrows');
    const parsed = JSON.parse(json);
    assert.equal(parsed.inbounds.length, 1);
    const inbound = parsed.inbounds[0];
    assert.equal(inbound.tag, DE_INBOUND_TAG);
    assert.equal(inbound.tag, 'afrows-de-ws');
    assert.equal(inbound.port, DE_INBOUND_PORT);
    assert.equal(inbound.port, 8090);
    assert.equal(inbound.protocol, 'vless');
    assert.equal(inbound.settings.decryption, 'none');
    assert.deepEqual(inbound.settings.clients, [
      { id: '8917dc5c-7770-4e32-93c7-be28a952b1b8', email: 'cc_d719c7d2@afrows', level: 0 },
    ]);
    // no flow key at all — a WS inbound rejects xtls-rprx-vision
    assert.equal('flow' in inbound.settings.clients[0], false);
  });

  it('honors tag/port overrides', () => {
    const parsed = JSON.parse(buildDeAduJson('u', 'e', 'afrows-de-alt', 9000));
    assert.equal(parsed.inbounds[0].tag, 'afrows-de-alt');
    assert.equal(parsed.inbounds[0].port, 9000);
  });
});

describe('SSH command builders (exact args match the working commands)', () => {
  const cfg = resolveDeMgmtConfig({});

  it('read-usage: ssh -o BatchMode=yes -i <key> <target> read-usage', () => {
    assert.deepEqual(deReadUsageArgs(cfg), [
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=10',
      '-i',
      '/etc/afrows/de_mgmt_key',
      'root@162.19.253.235',
      'read-usage',
    ]);
  });

  it('rmu: passes the provisioning email as the last arg', () => {
    const args = deRemoveUserArgs(cfg, 'cc_abc@afrows');
    assert.deepEqual(args.slice(-3), ['root@162.19.253.235', 'rmu', 'cc_abc@afrows']);
  });

  it('adu: ends with the bare adu sub-command (JSON goes on stdin)', () => {
    const args = deAddUserArgs(cfg);
    assert.deepEqual(args.slice(-2), ['root@162.19.253.235', 'adu']);
  });
});
