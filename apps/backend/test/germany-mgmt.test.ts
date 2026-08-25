import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DE_MGMT_DEFAULT_KEY,
  DE_MGMT_DEFAULT_SSH,
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
