import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import {
  DEF_INBOUND_PORT,
  DEF_INBOUND_TAG,
  DEF_MGMT_DEFAULT_SSH,
  buildDefAduJson,
  isDefMgmtEnabled,
  remoteReadUsageArgs,
  resolveDefMgmtConfig,
} from '../src/client/germany-mgmt.ts';
import {
  DE_USAGE_SITE,
  DEF_USAGE_SITE,
  US_USAGE_SITE,
  applyRemoteUserUsage,
  loadRemoteBaselines,
  type DeUsageDeps,
} from '../src/client/germany-usage-db.ts';
import { computeUsageDelta } from '../src/client/germany-usage.ts';
import { applyUsageDelta } from '../src/client/usage-accounting.ts';
import {
  PUBLIC_ENTRY_LINK_REMARKS,
  buildEntryLinkSet,
  customerEntryLinkRemarks,
  readAfrowsGermanyFastEnv,
} from '../src/client/afrows-entry-link.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

const UUID = '00113fad-42da-4be7-ae1e-cce226baf47e';
const OBS = '2026-11-21T10:00:00.000Z';
const deps: DeUsageDeps = { computeDelta: computeUsageDelta, applyDelta: applyUsageDelta };

// Fully-configured direct "Germany Fast x2" env (REALITY slot only; prefix AFROWS_DEF_DIRECT_).
const DEF_ENV = {
  AFROWS_DEF_DIRECT_ENABLED: 'true',
  AFROWS_DEF_DIRECT_HOST: '46.249.98.221',
  AFROWS_DEF_DIRECT_REALITY_PORT: '8443',
  AFROWS_DEF_DIRECT_REALITY_SNI: 'www.speedtest.net',
  AFROWS_DEF_DIRECT_PBK: 'CcIXp3SwniLcFlxxSzY-5qUqB1TSSJIGee_xDohILGQ',
  AFROWS_DEF_DIRECT_SID: '6d9f7568c8a0d4c0',
};

describe('readAfrowsGermanyFastEnv (direct REALITY entry)', () => {
  it('builds exactly one REALITY entry when fully configured; fp defaults to chrome', () => {
    const params = readAfrowsGermanyFastEnv(DEF_ENV);
    assert.deepEqual(params, {
      mode: 'reality',
      host: '46.249.98.221',
      port: 8443,
      serverName: 'www.speedtest.net',
      fingerprint: 'chrome', // NOT ios: xray 26.11.9 fails the REALITY handshake with the ios uTLS fp
      publicKey: 'CcIXp3SwniLcFlxxSzY-5qUqB1TSSJIGee_xDohILGQ',
      shortId: '6d9f7568c8a0d4c0',
    });
  });

  it('honours an explicit FP override', () => {
    assert.equal(readAfrowsGermanyFastEnv({ ...DEF_ENV, AFROWS_DEF_DIRECT_FP: 'firefox' })?.fingerprint, 'firefox');
  });

  it('is off by default (flag unset / false) and null without any required reality param', () => {
    assert.equal(readAfrowsGermanyFastEnv({}), null);
    assert.equal(readAfrowsGermanyFastEnv({ ...DEF_ENV, AFROWS_DEF_DIRECT_ENABLED: 'false' }), null);
    assert.equal(readAfrowsGermanyFastEnv({ ...DEF_ENV, AFROWS_DEF_DIRECT_HOST: '' }), null);
    assert.equal(readAfrowsGermanyFastEnv({ ...DEF_ENV, AFROWS_DEF_DIRECT_PBK: '' }), null);
    assert.equal(readAfrowsGermanyFastEnv({ ...DEF_ENV, AFROWS_DEF_DIRECT_SID: undefined }), null);
    assert.equal(readAfrowsGermanyFastEnv({ ...DEF_ENV, AFROWS_DEF_DIRECT_REALITY_PORT: '0' }), null);
    assert.equal(readAfrowsGermanyFastEnv({ ...DEF_ENV, AFROWS_DEF_DIRECT_REALITY_SNI: ' ' }), null);
  });

  it('emits in the link set right after the Cloudflare Germany entry, kind germany, label "Germany Fast x2"', () => {
    const env = {
      ...DEF_ENV,
      AFROWS_DEF_MGMT_ENABLED: 'true', // BILLING-CRITICAL: the fast link ships only with its 2x meter
      AFROWS_DE_ENTRY_ENABLED: 'true',
      AFROWS_DE_ENTRY_HOST: 'de.afrows.com',
      AFROWS_DE_ENTRY_SNI: 'de.afrows.com',
      AFROWS_INBOUND_MODE: 'ws',
      AFROWS_INBOUND_HOST: '94.74.145.199',
      AFROWS_INBOUND_SNI: 'app.afrows.com',
      AFROWS_INBOUND_WS_PATH: '/afrowsws',
    };
    const links = buildEntryLinkSet(env, UUID, PUBLIC_ENTRY_LINK_REMARKS);
    // Cloudflare Germany, then direct Germany Fast, then Iran. Both Germany links are kind `germany`.
    assert.deepEqual(links.map((l) => l.kind), ['germany', 'germany', 'iran']);
    const deFast = new URL(links[1].uri);
    assert.equal(deFast.host, '46.249.98.221:8443');
    assert.equal(deFast.searchParams.get('security'), 'reality');
    assert.equal(deFast.searchParams.get('type'), 'tcp');
    assert.equal(deFast.searchParams.get('fp'), 'chrome');
    assert.equal(deFast.searchParams.get('sni'), 'www.speedtest.net');
    assert.equal(deFast.searchParams.get('flow'), null); // no vision flow (matches USA direct REALITY slot)
    assert.equal(decodeURIComponent(deFast.hash.slice(1)), 'Germany Fast x2'); // no "· Direct N" suffix
    // customer-facing label carries the display name.
    const custom = buildEntryLinkSet(env, UUID, customerEntryLinkRemarks('ben'));
    assert.equal(decodeURIComponent(new URL(custom[1].uri).hash.slice(1)), 'ben · Germany Fast x2');
  });

  it('is omitted from the link set when disabled (no free unmetered Germany-Fast link)', () => {
    const env = { ...DEF_ENV, AFROWS_DEF_DIRECT_ENABLED: 'false', AFROWS_INBOUND_MODE: 'ws', AFROWS_INBOUND_HOST: 'h', AFROWS_INBOUND_SNI: 's' };
    assert.deepEqual(buildEntryLinkSet(env, UUID, PUBLIC_ENTRY_LINK_REMARKS).map((l) => l.kind), ['iran']);
  });
});

describe('Germany Fast x2 metering (distinct source + baseline; 2x by default)', () => {
  it('writes source de-fast-xray, created_by de-fast-usage-meter, advances client_usage_def_baseline', async () => {
    const ex = createFakeExecutor([
      { rows: [{ customerAccountId: 'acct-1' }] },
      { rows: [{ id: 'ev-1' }], rowCount: 1 },
      { rows: [{}] },
      { rows: [{}] },
      { rows: [{}] },
      { rows: [{}] },
    ]);
    const applied = await applyRemoteUserUsage(
      ex,
      { clientConfigId: 'cc-1', cumulativeBytes: 5_000_000_000 },
      { clientConfigId: 'cc-1', cumulativeBytes: 3_000_000_000, observedAt: '2026-11-21T09:59:00.000Z' },
      OBS,
      deps,
      { ...DEF_USAGE_SITE, multiplier: 2 },
    );
    assert.equal(applied, 4_000_000_000, '2 GB (10^9) on Germany Fast is billed 2x = 4 GB to the same customer quota');
    assert.match(ex.calls[1].text, /'de-fast-xray'/);
    assert.match(ex.calls[1].text, /'de-fast-usage-meter'/);
    assert.doesNotMatch(ex.calls[1].text, /germany-xray/);
    assert.doesNotMatch(ex.calls[1].text, /usa-xray/);
    // values: billed, raw, multiplier — raw bytes stay on the event, multiplier recorded.
    assert.deepEqual(ex.calls[1].values, ['acct-1', 'cc-1', 4_000_000_000, OBS, '2026-11-21T09:59:00.000Z', 'cc-1:5000000000', 2_000_000_000, 2]);
    assert.match(ex.calls[5].text, /INSERT INTO client_usage_def_baseline/);
    assert.doesNotMatch(ex.calls[5].text, /client_usage_de_baseline/);
    assert.doesNotMatch(ex.calls[5].text, /client_usage_us_baseline/);
  });

  it('default DEF_USAGE_SITE multiplier is unset (the service injects 2; 1x without it)', async () => {
    const ex = createFakeExecutor([
      { rows: [{ customerAccountId: 'a' }] },
      { rows: [{ id: 'e' }], rowCount: 1 },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);
    const applied = await applyRemoteUserUsage(
      ex,
      { clientConfigId: 'cc-1', cumulativeBytes: 1_000 },
      { clientConfigId: 'cc-1', cumulativeBytes: 0, observedAt: OBS },
      OBS,
      deps,
      DEF_USAGE_SITE,
    );
    assert.equal(applied, 1_000, 'no multiplier on the bare site -> 1x');
    assert.equal(ex.calls[1].values?.[7], 1);
  });

  it('the three remote exits never collide: identical idempotency key, distinct source', async () => {
    const run = async (site: typeof DEF_USAGE_SITE) => {
      const ex = createFakeExecutor([{ rows: [{ customerAccountId: 'a' }] }, { rows: [{ id: 'e' }] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }]);
      await applyRemoteUserUsage(ex, { clientConfigId: 'cc-1', cumulativeBytes: 7 }, undefined, OBS, deps, site);
      return ex.calls[1];
    };
    const de = await run(DE_USAGE_SITE);
    const us = await run(US_USAGE_SITE);
    const def = await run(DEF_USAGE_SITE);
    assert.equal(de.values?.[5], def.values?.[5], 'identical idempotency key text');
    assert.equal(us.values?.[5], def.values?.[5], 'identical idempotency key text');
    assert.match(de.text, /'germany-xray'/);
    assert.match(us.text, /'usa-xray'/);
    assert.match(def.text, /'de-fast-xray'/);
    assert.match(def.text, /ON CONFLICT \(source, idempotency_key\)/);
  });

  it('loadRemoteBaselines reads client_usage_def_baseline and coerces bigint strings', async () => {
    const ex = createFakeExecutor([{ rows: [{ clientConfigId: 'cc-1', cumulativeBytes: '456', observedAt: OBS }] }]);
    const map = await loadRemoteBaselines(ex, DEF_USAGE_SITE);
    assert.match(ex.calls[0].text, /FROM client_usage_def_baseline/);
    assert.equal(map.get('cc-1')?.cumulativeBytes, 456);
  });
});

describe('Germany Fast x2 mgmt channel (afrows-def-reality:8443 over an ssh alias)', () => {
  it('defaults to the afrows-def-mgmt alias with NO -i; honours AFROWS_DEF_MGMT_SSH/KEY', () => {
    const cfg = resolveDefMgmtConfig({});
    assert.equal(cfg.sshTarget, DEF_MGMT_DEFAULT_SSH);
    assert.equal(cfg.sshTarget, 'afrows-def-mgmt');
    assert.equal(cfg.keyPath, '');
    assert.deepEqual(remoteReadUsageArgs(cfg), ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'afrows-def-mgmt', 'read-usage']);
    const withKey = resolveDefMgmtConfig({ AFROWS_DEF_MGMT_SSH: ' def-alt ', AFROWS_DEF_MGMT_KEY: '/etc/afrows/def_key' });
    assert.deepEqual(remoteReadUsageArgs(withKey), ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-i', '/etc/afrows/def_key', 'def-alt', 'read-usage']);
  });

  it('is OFF unless AFROWS_DEF_MGMT_ENABLED is truthy (provision/meter ride one flag)', () => {
    assert.equal(isDefMgmtEnabled({}), false);
    assert.equal(isDefMgmtEnabled({ AFROWS_DEF_MGMT_ENABLED: 'false' }), false);
    assert.equal(isDefMgmtEnabled({ AFROWS_DEF_MGMT_ENABLED: ' TRUE ' }), true);
    assert.equal(isDefMgmtEnabled({ AFROWS_DEF_MGMT_ENABLED: '1' }), true);
  });

  it('adu JSON targets the REALITY inbound afrows-def-reality:8443, VLESS, no flow', () => {
    assert.equal(DEF_INBOUND_TAG, 'afrows-def-reality');
    assert.equal(DEF_INBOUND_PORT, 8443);
    assert.deepEqual(JSON.parse(buildDefAduJson(UUID, 'cc_x@afrows')), {
      inbounds: [
        {
          tag: 'afrows-def-reality',
          port: 8443,
          protocol: 'vless',
          settings: { decryption: 'none', clients: [{ id: UUID, email: 'cc_x@afrows', level: 0 }] },
        },
      ],
    });
  });
});

describe('Germany Fast x2 migration', () => {
  it('0071 creates the baseline and adds de-fast-xray to the source CHECK', () => {
    const migrations = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'infra', 'postgres', 'migrations');
    const m71 = readFileSync(join(migrations, '0071_client_usage_def_baseline.sql'), 'utf8');
    assert.match(m71, /CREATE TABLE IF NOT EXISTS client_usage_def_baseline/);
    assert.match(m71, /'de-fast-xray'/);
    assert.match(m71, /'germany-xray', 'usa-xray', 'de-fast-xray'/); // keeps the older sources
  });
});
