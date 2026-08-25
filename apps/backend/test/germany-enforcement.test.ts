import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

// The over-quota / inactive-account enforcement paths live in the @Injectable
// XrayUsageMeteringService, which the type-stripping test runner cannot load.
// These source-level assertions guard the "disconnect on BOTH Ireland and
// Germany" wiring so a refactor can't silently drop the Germany rmu.
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src', 'client');

const metering = readFileSync(join(src, 'xray-usage-metering.service.ts'), 'utf8');
const germany = readFileSync(join(src, 'germany-usage-metering.service.ts'), 'utf8');

describe('quota enforcement disconnects on BOTH Ireland and Germany', () => {
  it('local metering injects the Germany management channel', () => {
    assert.match(metering, /germanyMgmt:\s*GermanyMgmtService/);
  });

  it('over-quota enforcement rmu-s on Germany after the local xray rmu', () => {
    const enforceQuota = metering.slice(metering.indexOf('private async enforceQuota('));
    const body = enforceQuota.slice(0, enforceQuota.indexOf('private async enforceAccountStatus('));
    assert.match(body, /api', 'rmu'/, 'local xray rmu present');
    assert.match(body, /this\.germanyMgmt\.removeUser\(/, 'Germany rmu present');
  });

  it('inactive-account enforcement also rmu-s on Germany', () => {
    const enforce = metering.slice(metering.indexOf('private async enforceAccountStatus('));
    assert.match(enforce, /this\.germanyMgmt\.removeUser\(/);
  });

  it('Germany metering triggers a quota + account enforcement sweep after applying usage', () => {
    assert.match(germany, /this\.xrayMetering\.enforceQuotaNow\(\)/);
    assert.match(germany, /this\.xrayMetering\.enforceAccountStatusNow\(\)/);
  });

  it('Germany metering is flag-gated OFF by default and returns early when the link is down', () => {
    assert.match(germany, /AFROWS_DE_USAGE_ENABLED', false/);
    assert.match(germany, /if \(raw == null\) return 0/);
  });
});
