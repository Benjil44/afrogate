/**
 * Per-customer server access enforcement (0.118.0), driven through the REAL
 * XrayProvisioningService.reconcile() (bundled with esbuild; see
 * helpers/load-bundled.ts) against fake Postgres rows, fake Germany/USA mgmt
 * channels and a stubbed local `xray api` exec.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { bundledSkipReason, loadBundled } from './helpers/load-bundled.ts';

interface Row {
  id: string;
  entryUuid: string;
  accessGermany: boolean;
  accessIran: boolean;
  accessUsa: boolean;
}
type MembershipState = { lastSweepAt: number; removed: Set<string> };
type Service = {
  reconcile(): Promise<void>;
  requestReconcile(): void;
  xray(args: string[]): Promise<void>;
  // private state, poked only to simulate an elapsed sweep interval
  remoteExits: Array<{ membership: MembershipState }>;
  localAccessGate: MembershipState;
};
type Ctor = new (...deps: unknown[]) => Service;

let XrayProvisioningService: Ctor | null = null;

const ID = {
  all: '11111111-1111-4111-8111-111111111111',
  noGermany: '22222222-2222-4222-8222-222222222222',
  noIran: '33333333-3333-4333-8333-333333333333',
  noUsa: '44444444-4444-4444-8444-444444444444',
};
const email = (id: string) => `cc_${id}@afrows`;

function row(id: string, access: Partial<Pick<Row, 'accessGermany' | 'accessIran' | 'accessUsa'>> = {}): Row {
  return { id, entryUuid: id, accessGermany: true, accessIran: true, accessUsa: true, ...access };
}

function fakeMgmt(label: string) {
  const calls: Array<[op: 'adu' | 'rmu', email: string]> = [];
  let failRmu = false;
  return {
    calls,
    setFailRmu(value: boolean) {
      failRmu = value;
    },
    label,
    isEnabled: () => true,
    async addUserByIdentity(_uuid: string, mail: string) {
      calls.push(['adu', mail]);
      return true;
    },
    async removeUser(mail: string) {
      calls.push(['rmu', mail]);
      return !failRmu;
    },
  };
}

function harness(initialRows: Row[], envOverrides: Record<string, string> = {}) {
  let rows = initialRows;
  const env: Record<string, string> = {
    AFROWS_DE_MGMT_SSH: 'afrows@de.example',
    AFROWS_XRAY_INBOUND_TAGS: 'afrows-in:8447,afrows-reality:8443',
    ...envOverrides,
  };
  const config = { get: (key: string) => env[key] };
  const database = {
    async query(text: string) {
      if (text.includes("SET status = 'active'")) return { rows: [] }; // recoverBackUnderQuota
      if (text.includes('FROM client_configs cc')) return { rows };
      throw new Error(`unexpected SQL: ${text.slice(0, 80)}`);
    },
  };
  const germany = fakeMgmt('Germany');
  const usa = fakeMgmt('USA');
  const service = new XrayProvisioningService!(config, database, germany, usa);
  const xrayCalls: string[][] = [];
  let failXray: (args: string[]) => boolean = () => false;
  service.xray = async (args: string[]) => {
    xrayCalls.push(args);
    if (failXray(args)) throw new Error('xray api failed');
  };
  return {
    service,
    germany,
    usa,
    xrayCalls,
    setRows(next: Row[]) {
      rows = next;
    },
    setFailXray(predicate: (args: string[]) => boolean) {
      failXray = predicate;
    },
    /** Pretend every sweep interval has elapsed (next tick is a full re-sync). */
    expireSweeps() {
      for (const site of service.remoteExits) site.membership.lastSweepAt = 0;
      service.localAccessGate.lastSweepAt = 0;
    },
    reset() {
      germany.calls.length = 0;
      usa.calls.length = 0;
      xrayCalls.length = 0;
    },
  };
}

/** Local adu targets per email, read from the temp file name `afrows-adu-<label>-<tag>-<email>.json`. */
function localAduTags(xrayCalls: string[][], id: string): string[] {
  const needle = email(id).replace(/[^a-z0-9_-]/gi, '');
  return xrayCalls
    .filter((args) => args[1] === 'adu' && args[3].includes(needle))
    .map((args) => (/afrows-adu-ie-(.+?)-cc_/.exec(args[3]) ?? [])[1])
    .sort();
}
function localRmuTags(xrayCalls: string[][], id: string): string[] {
  return xrayCalls
    .filter((args) => args[1] === 'rmu' && args[4] === email(id))
    .map((args) => args[3].replace('-tag=', ''))
    .sort();
}
/** `<server>/<tag>` of every local rmu for one config. */
function localRmuTargets(xrayCalls: string[][], id: string): string[] {
  return xrayCalls
    .filter((args) => args[1] === 'rmu' && args[4] === email(id))
    .map((args) => `${args[2].replace('--server=', '')}/${args[3].replace('-tag=', '')}`)
    .sort();
}

describe('server access enforcement (XrayProvisioningService)', { skip: bundledSkipReason }, () => {
  before(() => {
    XrayProvisioningService = loadBundled<{ XrayProvisioningService: Ctor }>(
      'client/xray-provisioning.service.ts',
      { quiet: true },
    ).XrayProvisioningService;
  });

  it('per-site eligibility: Germany/USA adu only allowed configs and rmu the denied ones', async () => {
    const h = harness([
      row(ID.all),
      row(ID.noGermany, { accessGermany: false }),
      row(ID.noIran, { accessIran: false }),
      row(ID.noUsa, { accessUsa: false }),
    ]);
    await h.service.reconcile();

    assert.deepEqual(h.germany.calls.filter(([op]) => op === 'rmu'), [['rmu', email(ID.noGermany)]]);
    assert.deepEqual(
      h.germany.calls.filter(([op]) => op === 'adu').map(([, mail]) => mail).sort(),
      [email(ID.all), email(ID.noIran), email(ID.noUsa)].sort(),
    );
    assert.deepEqual(h.usa.calls.filter(([op]) => op === 'rmu'), [['rmu', email(ID.noUsa)]]);
    assert.deepEqual(
      h.usa.calls.filter(([op]) => op === 'adu').map(([, mail]) => mail).sort(),
      [email(ID.all), email(ID.noGermany), email(ID.noIran)].sort(),
    );
  });

  it('afrows-in reconcile excludes access_iran=false (and rmu-s it there); afrows-reality is untouched', async () => {
    const h = harness([row(ID.all), row(ID.noIran, { accessIran: false }), row(ID.noGermany, { accessGermany: false })]);
    await h.service.reconcile();

    assert.deepEqual(localAduTags(h.xrayCalls, ID.all), ['afrows-in', 'afrows-reality']);
    assert.deepEqual(localAduTags(h.xrayCalls, ID.noIran), ['afrows-reality']);
    assert.deepEqual(localRmuTags(h.xrayCalls, ID.noIran), ['afrows-in']);
    // Germany off does not touch the local inbounds (no pushed Germany endpoint configured here).
    assert.deepEqual(localAduTags(h.xrayCalls, ID.noGermany), ['afrows-in', 'afrows-reality']);
    assert.deepEqual(localRmuTags(h.xrayCalls, ID.noGermany), []);
    assert.deepEqual(localRmuTags(h.xrayCalls, ID.all), []);
  });

  it('toggle off rmu-s once (steady state spends nothing); toggle on re-adds within one tick', async () => {
    const h = harness([row(ID.all)]);
    await h.service.reconcile();
    h.reset();

    // Germany + Shatel switched off for the customer.
    h.setRows([row(ID.all, { accessGermany: false, accessIran: false })]);
    await h.service.reconcile();
    assert.deepEqual(h.germany.calls, [['rmu', email(ID.all)]]);
    assert.deepEqual(localRmuTags(h.xrayCalls, ID.all), ['afrows-in']);
    assert.deepEqual(localAduTags(h.xrayCalls, ID.all), ['afrows-reality']);

    h.reset();
    await h.service.reconcile();
    assert.deepEqual(h.germany.calls, [], 'no repeat rmu (or adu) once removed');
    assert.deepEqual(localRmuTags(h.xrayCalls, ID.all), []);

    // Switched back on: re-provisioned on the very next tick.
    h.setRows([row(ID.all)]);
    h.reset();
    await h.service.reconcile();
    assert.deepEqual(h.germany.calls, [['adu', email(ID.all)]]);
    assert.deepEqual(localAduTags(h.xrayCalls, ID.all), ['afrows-in', 'afrows-reality']);
  });

  it('a failed toggle-time rmu is retried on the next tick (self-healing)', async () => {
    const h = harness([row(ID.noUsa, { accessUsa: false })]);
    h.usa.setFailRmu(true);
    await h.service.reconcile();
    assert.deepEqual(h.usa.calls, [['rmu', email(ID.noUsa)]]);
    h.reset();
    h.usa.setFailRmu(false);
    await h.service.reconcile();
    assert.deepEqual(h.usa.calls, [['rmu', email(ID.noUsa)]]);
    h.reset();
    await h.service.reconcile();
    assert.deepEqual(h.usa.calls, []);
  });

  it('quota/disable enforcement is unchanged: a config outside the eligibility query is never re-added by an access flip', async () => {
    // The eligibility queries still filter status/quota/blocked; an over-quota or disabled
    // config is simply absent from them, so a re-enabled server never adus it.
    const h = harness([]);
    await h.service.reconcile();
    assert.deepEqual(h.germany.calls, []);
    assert.deepEqual(h.usa.calls, []);
    assert.deepEqual(h.xrayCalls, []);
  });
  it('Iran off then Germany off: the pushed Germany endpoint still gets its rmu (cache keyed per target)', async () => {
    const env = {
      AFROWS_XRAY_INBOUND_TAGS: 'afrows-in:8447,afrows-in-tcp:8080,afrows-reality:8443',
      AFROWS_XRAY_DE_API_SERVER: '127.0.0.1:10086',
    };
    const h = harness([row(ID.all, { accessIran: false })], env);
    await h.service.reconcile();
    assert.deepEqual(localRmuTargets(h.xrayCalls, ID.all), ['127.0.0.1:10085/afrows-in', '127.0.0.1:10085/afrows-in-tcp']);

    h.reset();
    h.setRows([row(ID.all, { accessIran: false, accessGermany: false })]);
    await h.service.reconcile();
    assert.deepEqual(localRmuTargets(h.xrayCalls, ID.all), ['127.0.0.1:10086/afrows-de-in']);
  });

  it('a partial target failure is retried for that target only', async () => {
    const h = harness([row(ID.noIran, { accessIran: false })], {
      AFROWS_XRAY_INBOUND_TAGS: 'afrows-in:8447,afrows-in-tcp:8080,afrows-reality:8443',
    });
    h.setFailXray((args) => args[1] === 'rmu' && args[3] === '-tag=afrows-in-tcp');
    await h.service.reconcile();
    assert.deepEqual(localRmuTags(h.xrayCalls, ID.noIran), ['afrows-in', 'afrows-in-tcp']);

    h.reset();
    h.setFailXray(() => false);
    await h.service.reconcile();
    assert.deepEqual(localRmuTags(h.xrayCalls, ID.noIran), ['afrows-in-tcp']);

    h.reset();
    await h.service.reconcile();
    assert.deepEqual(localRmuTags(h.xrayCalls, ID.noIran), []);
  });

  it('removed is cleared on the full re-sync and the rmu is re-issued (remote and local)', async () => {
    const h = harness([row(ID.all, { accessGermany: false, accessIran: false })]);
    await h.service.reconcile();
    h.reset();
    await h.service.reconcile();
    assert.deepEqual(h.germany.calls, []);
    assert.deepEqual(localRmuTags(h.xrayCalls, ID.all), []);

    h.reset();
    h.expireSweeps();
    await h.service.reconcile();
    assert.deepEqual(h.germany.calls, [['rmu', email(ID.all)]], 'exactly one rmu per denied (id, site) per sweep');
    assert.deepEqual(localRmuTags(h.xrayCalls, ID.all), ['afrows-in']);
  });
});
