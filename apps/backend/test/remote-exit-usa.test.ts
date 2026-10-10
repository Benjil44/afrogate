import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import {
  US_INBOUND_PORT,
  US_INBOUND_TAG,
  US_MGMT_DEFAULT_SSH,
  buildUsAduJson,
  isUsMgmtEnabled,
  remoteAddUserArgs,
  remoteReadUsageArgs,
  remoteRemoveUserArgs,
  resolveDeMgmtConfig,
  resolveUsMgmtConfig,
  buildRemoteAduJson,
  type RemoteExitMgmtConfig,
} from '../src/client/germany-mgmt.ts';
import { DeMgmtBackoff, isDeLinkFailure, resolveMgmtBackoffConfig } from '../src/client/germany-mgmt-backoff.ts';
import { RemoteExitMgmt, type RemoteExitMgmtDeps } from '../src/client/remote-exit-mgmt.ts';
import {
  createRemoteMembershipState,
  planRemoteMembership,
  recordRemoteMembership,
} from '../src/client/remote-exit-membership.ts';
import {
  DE_USAGE_SITE,
  US_USAGE_SITE,
  applyDeUserUsage,
  applyRemoteUserUsage,
  loadRemoteBaselines,
  type DeUsageDeps,
} from '../src/client/germany-usage-db.ts';
import { computeUsageDelta, parseDeUsageBuffer } from '../src/client/germany-usage.ts';
import { applyUsageDelta } from '../src/client/usage-accounting.ts';
import {
  PUBLIC_ENTRY_LINK_REMARKS,
  buildEntryLinkSet,
  customerEntryLinkRemarks,
  readAfrowsUsEntryEnv,
} from '../src/client/afrows-entry-link.ts';
import {
  TELEGRAM_CONFIG_TEXT_BUDGET,
  buildConfigLinksMessage,
  renderTelegramCopy,
} from '../src/telegram/telegram-i18n.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

const UUID = '00113fad-42da-4be7-ae1e-cce226baf47e';

describe('USA mgmt config + ssh argv (ssh_config alias, no key)', () => {
  it('defaults to the afrows-us-mgmt alias with NO -i (the alias carries key + ProxyCommand)', () => {
    const cfg = resolveUsMgmtConfig({});
    assert.equal(cfg.sshTarget, US_MGMT_DEFAULT_SSH);
    assert.equal(cfg.sshTarget, 'afrows-us-mgmt');
    assert.equal(cfg.keyPath, '');
    assert.deepEqual(remoteReadUsageArgs(cfg), [
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=10',
      'afrows-us-mgmt',
      'read-usage',
    ]);
    assert.deepEqual(remoteRemoveUserArgs(cfg, 'cc_abc@afrows'), [
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=10',
      'afrows-us-mgmt',
      'rmu',
      'cc_abc@afrows',
    ]);
    assert.deepEqual(remoteAddUserArgs(cfg).slice(-2), ['afrows-us-mgmt', 'adu']);
    assert.ok(!remoteAddUserArgs(cfg).includes('-i'));
  });

  it('adds -i only when AFROWS_US_MGMT_KEY is set; honors AFROWS_US_MGMT_SSH', () => {
    const cfg = resolveUsMgmtConfig({ AFROWS_US_MGMT_SSH: ' us-alt ', AFROWS_US_MGMT_KEY: '/etc/afrows/us_key' });
    assert.deepEqual(remoteReadUsageArgs(cfg), [
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=10',
      '-i',
      '/etc/afrows/us_key',
      'us-alt',
      'read-usage',
    ]);
  });

  it('Germany argv is unchanged (explicit key)', () => {
    assert.deepEqual(remoteReadUsageArgs(resolveDeMgmtConfig({})), [
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

  it('USA mgmt is OFF unless AFROWS_US_MGMT_ENABLED is truthy', () => {
    assert.equal(isUsMgmtEnabled({}), false);
    assert.equal(isUsMgmtEnabled({ AFROWS_US_MGMT_ENABLED: 'false' }), false);
    assert.equal(isUsMgmtEnabled({ AFROWS_US_MGMT_ENABLED: ' TRUE ' }), true);
    assert.equal(isUsMgmtEnabled({ AFROWS_US_MGMT_ENABLED: '1' }), true);
  });

  it('adu JSON targets afrows-us-ws:10085, VLESS, no flow', () => {
    const parsed = JSON.parse(buildUsAduJson(UUID, 'cc_x@afrows'));
    assert.equal(US_INBOUND_TAG, 'afrows-us-ws');
    assert.equal(US_INBOUND_PORT, 10085);
    assert.deepEqual(parsed, {
      inbounds: [
        {
          tag: 'afrows-us-ws',
          port: 10085,
          protocol: 'vless',
          settings: { decryption: 'none', clients: [{ id: UUID, email: 'cc_x@afrows', level: 0 }] },
        },
      ],
    });
  });
});

// ---------------------------------------------------------------------------

interface FakeSite {
  mgmt: RemoteExitMgmt;
  calls: string[][];
  logs: string[];
}

function fakeSite(
  label: string,
  cfg: RemoteExitMgmtConfig,
  exec: (args: string[]) => Promise<{ stdout: string }>,
  opts: { enabled?: boolean; now?: () => number } = {},
): FakeSite {
  const calls: string[][] = [];
  const logs: string[] = [];
  const deps: RemoteExitMgmtDeps = {
    label,
    enabled: () => opts.enabled ?? true,
    config: () => cfg,
    inbound: () => ({ tag: label === 'USA' ? US_INBOUND_TAG : 'afrows-de-ws', port: label === 'USA' ? US_INBOUND_PORT : 8090 }),
    backoff: new DeMgmtBackoff(resolveMgmtBackoffConfig(undefined), opts.now ?? (() => 0)),
    isLinkFailure: isDeLinkFailure,
    readUsageArgs: remoteReadUsageArgs,
    removeUserArgs: remoteRemoveUserArgs,
    addUserArgs: remoteAddUserArgs,
    buildAduJson: buildRemoteAduJson,
    exec: (args) => {
      calls.push(args);
      return exec(args);
    },
    logger: { log: (m) => logs.push(m), warn: (m) => logs.push(m), debug: (m) => logs.push(m) },
  };
  return { mgmt: new RemoteExitMgmt(deps), calls, logs };
}

const linkDown = () => Promise.reject(Object.assign(new Error('Command failed: ssh ... rmu cc_secret@afrows'), { code: 255 }));
const ok = () => Promise.resolve({ stdout: '{}' });

describe('RemoteExitMgmt: per-site breaker isolation', () => {
  it('USA down opens ONLY the USA breaker; Germany keeps running every call', async () => {
    const usa = fakeSite('USA', resolveUsMgmtConfig({}), linkDown);
    const germany = fakeSite('Germany', resolveDeMgmtConfig({}), ok);

    for (let i = 0; i < 10; i += 1) {
      const [g, u] = await Promise.all([germany.mgmt.removeUser('cc_1@afrows'), usa.mgmt.removeUser('cc_1@afrows')]);
      assert.equal(g, true, 'Germany unaffected');
      assert.equal(u, false, 'USA failure is a false, never a throw');
    }
    assert.equal(germany.calls.length, 10, 'Germany spawned ssh for every call');
    assert.equal(usa.calls.length, 3, 'USA breaker opened after 3 link failures and skipped the rest');
    assert.ok(usa.logs.some((m) => m.startsWith('USA mgmt link unreachable')));
    assert.ok(usa.logs.every((m) => !m.includes('cc_secret')), 'argv/email never logged');
    assert.ok(germany.logs.every((m) => !m.startsWith('Germany mgmt link unreachable')));
  });

  it('a disabled site spawns no ssh at all (USA off = identical to before)', async () => {
    const usa = fakeSite('USA', resolveUsMgmtConfig({}), ok, { enabled: false });
    assert.equal(await usa.mgmt.readUsage(), null);
    assert.equal(await usa.mgmt.removeUser('cc_1@afrows'), false);
    assert.equal(await usa.mgmt.addUserByIdentity(UUID, 'cc_1@afrows'), false);
    assert.equal(usa.calls.length, 0);
  });

  it('addUserByIdentity sends the USA adu JSON on stdin to `<alias> adu`', async () => {
    const stdins: Array<string | undefined> = [];
    const calls: string[][] = [];
    const mgmt = new RemoteExitMgmt({
      label: 'USA',
      enabled: () => true,
      config: () => resolveUsMgmtConfig({}),
      inbound: () => ({ tag: US_INBOUND_TAG, port: US_INBOUND_PORT }),
      backoff: new DeMgmtBackoff(),
      isLinkFailure: isDeLinkFailure,
      readUsageArgs: remoteReadUsageArgs,
      removeUserArgs: remoteRemoveUserArgs,
      addUserArgs: remoteAddUserArgs,
      buildAduJson: buildRemoteAduJson,
      exec: async (args, stdin) => {
        calls.push(args);
        stdins.push(stdin);
        return { stdout: '' };
      },
      logger: { log() {}, warn() {}, debug() {} },
    });
    assert.equal(await mgmt.addUserByIdentity(UUID, 'cc_1@afrows'), true);
    assert.deepEqual(calls[0].slice(-2), ['afrows-us-mgmt', 'adu']);
    assert.equal(stdins[0], buildUsAduJson(UUID, 'cc_1@afrows'));
  });
});

describe('remote membership planner (per-site fast-path + full re-sync)', () => {
  it('first tick is a full re-sync; later ticks only add unconfirmed; ineligible ids are dropped', () => {
    const state = createRemoteMembershipState();
    const first = planRemoteMembership(state, ['a', 'b'], 1_000_000, 300_000);
    assert.deepEqual(first, { toAdd: ['a', 'b'], fullResync: true });
    recordRemoteMembership(state, 'a', true);
    recordRemoteMembership(state, 'b', false);

    const fast = planRemoteMembership(state, ['a', 'b', 'c'], 1_060_000, 300_000);
    assert.deepEqual(fast, { toAdd: ['b', 'c'], fullResync: false });

    // 'a' goes over quota -> dropped, so it is re-added when it returns
    planRemoteMembership(state, ['b'], 1_120_000, 300_000);
    assert.equal(state.confirmed.has('a'), false);
    const back = planRemoteMembership(state, ['a', 'b'], 1_180_000, 300_000);
    assert.deepEqual(back.toAdd, ['a', 'b']);

    const sweep = planRemoteMembership(state, ['a', 'b'], 1_300_000, 300_000);
    assert.equal(sweep.fullResync, true);
  });

  it('Germany and USA states are independent', () => {
    const de = createRemoteMembershipState();
    const us = createRemoteMembershipState();
    planRemoteMembership(de, ['a'], 1_000_000, 300_000);
    recordRemoteMembership(de, 'a', true);
    assert.deepEqual(planRemoteMembership(us, ['a'], 1_000_000, 300_000).toAdd, ['a']);
    recordRemoteMembership(us, 'a', false); // USA down
    assert.deepEqual(planRemoteMembership(de, ['a'], 1_060_000, 300_000).toAdd, [], 'Germany stays confirmed');
    assert.deepEqual(planRemoteMembership(us, ['a'], 1_060_000, 300_000).toAdd, ['a'], 'USA retries');
  });
});

// ---------------------------------------------------------------------------

const OBS = '2026-10-08T10:00:00.000Z';
const deps: DeUsageDeps = { computeDelta: computeUsageDelta, applyDelta: applyUsageDelta };

describe('USA metering (per-site source + baseline; same quota)', () => {
  it('writes source usa-xray, created_by usa-usage-meter, and advances client_usage_us_baseline', async () => {
    const ex = createFakeExecutor([
      { rows: [{ customerAccountId: 'acct-1' }] },
      { rows: [{ id: 'ev-1' }] },
      { rows: [{}] },
      { rows: [{}] },
      { rows: [{}] },
      { rows: [{}] },
    ]);
    const applied = await applyRemoteUserUsage(
      ex,
      { clientConfigId: 'cc-1', cumulativeBytes: 5_000_000_000 },
      { clientConfigId: 'cc-1', cumulativeBytes: 3_000_000_000, observedAt: '2026-10-08T09:59:00.000Z' },
      OBS,
      deps,
      US_USAGE_SITE,
    );
    assert.equal(applied, 2_000_000_000, '2 GB (10^9) charged to the same customer quota');
    assert.match(ex.calls[1].text, /'usa-xray'/);
    assert.match(ex.calls[1].text, /'usa-usage-meter'/);
    assert.doesNotMatch(ex.calls[1].text, /germany/);
    assert.deepEqual(ex.calls[1].values, ['acct-1', 'cc-1', 2_000_000_000, OBS, '2026-10-08T09:59:00.000Z', 'cc-1:5000000000']);
    assert.match(ex.calls[2].text, /UPDATE customer_accounts/, 'shared quota write');
    assert.match(ex.calls[3].text, /'usa-xray'/);
    assert.match(ex.calls[4].text, /'usa-xray'/);
    assert.match(ex.calls[5].text, /INSERT INTO client_usage_us_baseline/);
    assert.doesNotMatch(ex.calls[5].text, /client_usage_de_baseline/);
  });

  it('same idempotency key on both sites cannot collide: the ledger source differs', async () => {
    const run = async (site: typeof DE_USAGE_SITE) => {
      const ex = createFakeExecutor([{ rows: [{ customerAccountId: 'a' }] }, { rows: [{ id: 'e' }] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }]);
      await applyRemoteUserUsage(ex, { clientConfigId: 'cc-1', cumulativeBytes: 7 }, undefined, OBS, deps, site);
      return ex.calls[1];
    };
    const de = await run(DE_USAGE_SITE);
    const us = await run(US_USAGE_SITE);
    assert.equal(de.values?.[5], us.values?.[5], 'identical key text');
    assert.match(de.text, /'germany-xray'/);
    assert.match(us.text, /'usa-xray'/);
    assert.match(us.text, /ON CONFLICT \(source, idempotency_key\)/);
  });

  it('applyDeUserUsage is unchanged (Germany source + table)', async () => {
    const ex = createFakeExecutor([{ rows: [{ customerAccountId: 'a' }] }, { rows: [{}] }]);
    await applyDeUserUsage(ex, { clientConfigId: 'cc-1', cumulativeBytes: 5 }, { clientConfigId: 'cc-1', cumulativeBytes: 5, observedAt: OBS }, OBS, deps);
    assert.match(ex.calls[1].text, /INSERT INTO client_usage_de_baseline/);
  });

  it('a USA counter reset charges only the post-reset bytes', async () => {
    const ex = createFakeExecutor([{ rows: [{ customerAccountId: 'a' }] }, { rows: [{ id: 'e' }] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }]);
    const applied = await applyRemoteUserUsage(
      ex,
      { clientConfigId: 'cc-1', cumulativeBytes: 400 },
      { clientConfigId: 'cc-1', cumulativeBytes: 9_000, observedAt: OBS },
      OBS,
      deps,
      US_USAGE_SITE,
    );
    assert.equal(applied, 400);
  });

  it('loadRemoteBaselines reads the site table and coerces bigint strings', async () => {
    const ex = createFakeExecutor([{ rows: [{ clientConfigId: 'cc-1', cumulativeBytes: '123', observedAt: OBS }] }]);
    const map = await loadRemoteBaselines(ex, US_USAGE_SITE);
    assert.match(ex.calls[0].text, /FROM client_usage_us_baseline/);
    assert.equal(map.get('cc-1')?.cumulativeBytes, 123);
  });

  it('the Afrows chain user is ignored in a us-usage.json buffer (no double counting)', () => {
    const buffer = parseDeUsageBuffer(
      JSON.stringify({
        updated_at: OBS,
        users: { 'afrows-chain@afrows': { bytes: 9e12 }, 'cc_cc-1@afrows': { bytes: 42 } },
      }),
    );
    assert.deepEqual(buffer.users, [{ clientConfigId: 'cc-1', cumulativeBytes: 42 }]);
  });

  it('migrations: 0065 adds the USA baseline + source, and the re-applied 0057 already allows usa-xray', () => {
    const migrations = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'infra', 'postgres', 'migrations');
    const m65 = readFileSync(join(migrations, '0065_client_usage_us_baseline.sql'), 'utf8');
    const m57 = readFileSync(join(migrations, '0057_client_usage_rollups.sql'), 'utf8');
    assert.match(m65, /CREATE TABLE IF NOT EXISTS client_usage_us_baseline/);
    assert.match(m65, /'germany-xray', 'usa-xray'/);
    assert.match(m57, /'germany-xray', 'usa-xray'/);
  });
});

// ---------------------------------------------------------------------------

const US_ENV = {
  AFROWS_US_ENTRY_ENABLED: 'true',
  AFROWS_US_ENTRY_HOST: '104.16.1.1',
  AFROWS_US_ENTRY_SNI: 'us.afrows.com',
};
const ALL_ENV = {
  ...US_ENV,
  AFROWS_DE_ENTRY_ENABLED: 'true',
  AFROWS_DE_ENTRY_HOST: 'de.afrows.com',
  AFROWS_DE_ENTRY_SNI: 'de.afrows.com',
  AFROWS_INBOUND_MODE: 'ws',
  AFROWS_INBOUND_HOST: '94.74.145.199',
  AFROWS_INBOUND_SNI: 'app.afrows.com',
  AFROWS_INBOUND_WS_PATH: '/afrowsws',
};

describe('USA entry link', () => {
  it('is off by default, and null without HOST or SNI', () => {
    assert.equal(readAfrowsUsEntryEnv({}), null);
    assert.equal(readAfrowsUsEntryEnv({ ...US_ENV, AFROWS_US_ENTRY_ENABLED: 'false' }), null);
    assert.equal(readAfrowsUsEntryEnv({ ...US_ENV, AFROWS_US_ENTRY_HOST: '' }), null);
    assert.equal(readAfrowsUsEntryEnv({ ...US_ENV, AFROWS_US_ENTRY_SNI: ' ' }), null);
  });

  it('builds the contract URI: ws+tls, path /afrowsus, host defaults to SNI, port 443, fp chrome', () => {
    const [link] = buildEntryLinkSet(US_ENV, UUID, customerEntryLinkRemarks('ben'));
    assert.equal(link.kind, 'usa');
    const url = new URL(link.uri);
    assert.equal(url.protocol, 'vless:');
    assert.equal(url.username, UUID);
    assert.equal(url.hostname, '104.16.1.1');
    assert.equal(url.port, '443');
    const q = url.searchParams;
    assert.equal(q.get('encryption'), 'none');
    assert.equal(q.get('security'), 'tls');
    assert.equal(q.get('sni'), 'us.afrows.com');
    assert.equal(q.get('fp'), 'chrome');
    assert.equal(q.get('type'), 'ws');
    assert.equal(q.get('host'), 'us.afrows.com');
    assert.equal(q.get('path'), '/afrowsus');
    assert.ok(link.uri.includes('path=%2Fafrowsus'));
    assert.equal(q.has('ech'), false);
    assert.equal(decodeURIComponent(url.hash.slice(1)), 'ben · USA');
  });

  it('honors PORT / WS_HOST / WS_PATH / FP / ECH overrides', () => {
    const params = readAfrowsUsEntryEnv({
      ...US_ENV,
      AFROWS_US_ENTRY_PORT: '8443',
      AFROWS_US_ENTRY_WS_HOST: 'cdn.us.afrows.com',
      AFROWS_US_ENTRY_WS_PATH: '/x',
      AFROWS_US_ENTRY_FP: 'firefox',
      AFROWS_US_ENTRY_ECH: 'crypto.cloudflare.com+udp://1.1.1.1',
    });
    assert.deepEqual(params, {
      mode: 'ws',
      host: '104.16.1.1',
      port: 8443,
      serverName: 'us.afrows.com',
      fingerprint: 'firefox',
      wsPath: '/x',
      wsHost: 'cdn.us.afrows.com',
      ech: 'crypto.cloudflare.com+udp://1.1.1.1',
    });
  });

  it('link order is Germany, Shatel, USA; public remarks are fixed ASCII', () => {
    const links = buildEntryLinkSet(ALL_ENV, UUID, PUBLIC_ENTRY_LINK_REMARKS);
    assert.deepEqual(links.map((l) => l.kind), ['germany', 'iran', 'usa']);
    assert.ok(links[2].uri.endsWith('#Afrows%20USA'));
    assert.equal(PUBLIC_ENTRY_LINK_REMARKS.usa, 'Afrows USA');
    assert.ok(links.every((link) => /^[!-~]+$/.test(link.uri)));
  });

  it('with the USA env unset, the link set is exactly the 0.116.0 pair', () => {
    const { AFROWS_US_ENTRY_ENABLED: _off, ...noUsa } = ALL_ENV;
    assert.deepEqual(buildEntryLinkSet(noUsa, UUID, PUBLIC_ENTRY_LINK_REMARKS).map((l) => l.kind), ['germany', 'iran']);
  });
});

describe('Telegram 3-link message', () => {
  const links = buildEntryLinkSet(
    { ...ALL_ENV, AFROWS_DE_ENTRY_ECH: 'crypto.cloudflare.com+udp://1.1.1.1', AFROWS_US_ENTRY_ECH: 'crypto.cloudflare.com+udp://1.1.1.1' },
    UUID,
    customerEntryLinkRemarks('A fairly long customer display name for the cap test'),
  );
  const bundle = { links, subscriptionUrl: 'https://app.afrows.com/sub/AbCdEfGhIjKlMnOpQrStUvWxYz012345' };

  for (const language of ['en', 'fa'] as const) {
    it(`labels all three links in order and stays under the cap (${language})`, () => {
      const text = buildConfigLinksMessage(bundle, language);
      const de = text.indexOf(renderTelegramCopy('cfg.link.germany', language));
      const ir = text.indexOf(renderTelegramCopy('cfg.link.shatel', language));
      const us = text.indexOf(renderTelegramCopy('cfg.link.usa', language));
      assert.ok(de >= 0 && ir > de && us > ir, 'Germany, Shatel, USA');
      assert.ok(text.includes(links[2].uri.replace(/&/g, '&amp;')));
      assert.ok(text.length < TELEGRAM_CONFIG_TEXT_BUDGET, `length ${text.length}`);
    });
  }

  it('USA label is bilingual and says "alternative exit (USA)"', () => {
    assert.match(renderTelegramCopy('cfg.link.usa', 'en'), /alternative exit \(USA\)/);
    assert.match(renderTelegramCopy('cfg.link.usa', 'fa'), /آمریکا/);
  });
});
