import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

// The over-quota / inactive-account enforcement paths live in the @Injectable
// XrayUsageMeteringService, which the type-stripping test runner cannot load.
// These source-level assertions guard the "disconnect on Ireland AND every
// remote exit (Germany, USA)" wiring so a refactor can't silently drop a remote rmu.
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src', 'client');

const metering = readFileSync(join(src, 'xray-usage-metering.service.ts'), 'utf8');
const remoteMeter = readFileSync(join(src, 'remote-exit-usage-metering.service.ts'), 'utf8');
const provisioning = readFileSync(join(src, 'xray-provisioning.service.ts'), 'utf8');

function methodBody(source: string, signature: string, nextSignature: string): string {
  const from = source.slice(source.indexOf(signature));
  return from.slice(0, from.indexOf(nextSignature));
}

describe('quota enforcement disconnects on Ireland AND both remote exits', () => {
  it('local metering injects the Germany and USA management channels', () => {
    assert.match(metering, /germanyMgmt:\s*GermanyMgmtService/);
    assert.match(metering, /usaMgmt:\s*UsaMgmtService/);
  });

  it('the shared remote-exit removal rmu-s on Germany AND the USA', () => {
    const helper = methodBody(metering, 'private async removeFromRemoteExits(', 'private bin(');
    assert.match(helper, /this\.germanyMgmt\.removeUser\(/, 'Germany rmu present');
    assert.match(helper, /this\.usaMgmt\.removeUser\(/, 'USA rmu present');
    assert.match(helper, /Promise\.all\(/, 'sites run in parallel (one down site never delays the other)');
  });

  it('over-quota enforcement removes from the remote exits after the local xray rmu', () => {
    const body = methodBody(metering, 'private async enforceQuota(', 'private async enforceAccountStatus(');
    assert.match(body, /api', 'rmu'/, 'local xray rmu present');
    assert.match(body, /this\.removeFromRemoteExits\(/, 'remote-exit rmu present');
  });

  it('inactive-account enforcement also removes from the remote exits', () => {
    const enforce = metering.slice(metering.indexOf('private async enforceAccountStatus('));
    assert.match(enforce, /this\.removeFromRemoteExits\(/);
  });

  it('remote metering triggers a quota + account enforcement sweep after applying usage', () => {
    assert.match(remoteMeter, /this\.xrayMetering\.enforceQuotaNow\(\)/);
    assert.match(remoteMeter, /this\.xrayMetering\.enforceAccountStatusNow\(\)/);
  });

  it('Germany metering stays flag-gated OFF by default; USA rides AFROWS_US_MGMT_ENABLED; link down returns early', () => {
    assert.match(remoteMeter, /AFROWS_DE_USAGE_ENABLED', false/);
    assert.match(remoteMeter, /enabled: \(\) => usaMgmt\.isEnabled\(\)/);
    assert.match(remoteMeter, /if \(raw == null\) return 0/);
  });

  it('deleting a config revokes it on Germany AND the USA', () => {
    const revoke = methodBody(provisioning, 'async revokeClientConfig(', 'async reconcile(');
    assert.match(revoke, /this\.germanyMgmt\.removeUser\(/);
    assert.match(revoke, /this\.usaMgmt\.removeUser\(/);
  });
});
