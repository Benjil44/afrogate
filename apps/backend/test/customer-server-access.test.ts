import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { CustomerServerAccess } from '@afrows/shared';
import { buildEntryLinkSet, PUBLIC_ENTRY_LINK_REMARKS } from '../src/client/afrows-entry-link.ts';
import {
  changedServerKinds,
  filterLinksByServerAccess,
  hasAnyServerAllowed,
  mergeServerAccess,
  serverAccessFromRow,
  serverAccessProblem,
} from '../src/client/customer-server-access.ts';
import {
  createRemoteMembershipState,
  expireRemoteRevocations,
  planRemoteMembership,
  planRemoteRevocations,
  recordRemoteMembership,
  recordRemoteRevocation,
} from '../src/client/remote-exit-membership.ts';
import {
  buildProvisioningEndpoints,
  localGateKey,
  parseIranInboundTags,
  partitionEndpointsByAccess,
} from '../src/client/xray-provisioning.ts';

const UUID = '00113fad-42da-4be7-ae1e-cce226baf47e';
const ALL_ENV: Record<string, string> = {
  AFROWS_DE_ENTRY_ENABLED: 'true',
  AFROWS_DE_ENTRY_HOST: 'de.afrows.com',
  AFROWS_DE_ENTRY_SNI: 'de.afrows.com',
  AFROWS_INBOUND_MODE: 'ws',
  AFROWS_INBOUND_HOST: '94.74.145.199',
  AFROWS_INBOUND_SNI: 'app.afrows.com',
  AFROWS_INBOUND_WS_PATH: '/afrowsws',
  AFROWS_US_ENTRY_ENABLED: 'true',
  AFROWS_US_ENTRY_HOST: 'us.afrows.com',
  AFROWS_US_ENTRY_SNI: 'us.afrows.com',
};
const ALL_ON: CustomerServerAccess = { germany: true, iran: true, usa: true };

/** Every one of the 8 flag combinations. */
function combinations(): CustomerServerAccess[] {
  const out: CustomerServerAccess[] = [];
  for (const germany of [true, false])
    for (const iran of [true, false]) for (const usa of [true, false]) out.push({ germany, iran, usa });
  return out;
}

describe('customer server access: row mapping and validation', () => {
  it('defaults every server ON (columns NOT NULL DEFAULT true; only explicit false revokes)', () => {
    assert.deepEqual(serverAccessFromRow(undefined), ALL_ON);
    assert.deepEqual(serverAccessFromRow({}), ALL_ON);
    assert.deepEqual(serverAccessFromRow({ accessGermany: null, accessIran: true, accessUsa: undefined }), ALL_ON);
    assert.deepEqual(serverAccessFromRow({ accessGermany: false, accessIran: true, accessUsa: false }), {
      germany: false,
      iran: true,
      usa: false,
    });
  });

  it('merges partial updates and detects the all-off state', () => {
    assert.deepEqual(mergeServerAccess(ALL_ON, { usa: false }), { germany: true, iran: true, usa: false });
    assert.deepEqual(mergeServerAccess(ALL_ON, {}), ALL_ON);
    assert.deepEqual(mergeServerAccess(ALL_ON, null), ALL_ON);
    const allOff = mergeServerAccess({ germany: false, iran: true, usa: false }, { iran: false });
    assert.equal(hasAnyServerAllowed(allOff), false);
    for (const access of combinations()) {
      assert.equal(hasAnyServerAllowed(access), access.germany || access.iran || access.usa);
    }
    assert.deepEqual(changedServerKinds(ALL_ON, { germany: true, iran: false, usa: false }), ['iran', 'usa']);
    assert.deepEqual(changedServerKinds(ALL_ON, ALL_ON), []);
  });
});

describe('customer server access: link filtering', () => {
  it('all-on default keeps Germany, Shatel, USA in order', () => {
    const links = filterLinksByServerAccess(buildEntryLinkSet(ALL_ENV, UUID, PUBLIC_ENTRY_LINK_REMARKS), ALL_ON);
    assert.deepEqual(links.map((link) => link.kind), ['germany', 'iran', 'usa']);
  });

  it('every flag combination yields exactly the allowed kinds, in order', () => {
    const all = buildEntryLinkSet(ALL_ENV, UUID, PUBLIC_ENTRY_LINK_REMARKS);
    for (const access of combinations()) {
      const kinds = filterLinksByServerAccess(all, access).map((link) => link.kind);
      const expected = (['germany', 'iran', 'usa'] as const).filter((kind) => access[kind]);
      assert.deepEqual(kinds, expected, JSON.stringify(access));
    }
  });

  it('never falls back to a disallowed server: only-USA with the USA entry env off is empty', () => {
    const env = { ...ALL_ENV, AFROWS_US_ENTRY_ENABLED: 'false' };
    const links = filterLinksByServerAccess(buildEntryLinkSet(env, UUID, PUBLIC_ENTRY_LINK_REMARKS), {
      germany: false,
      iran: false,
      usa: true,
    });
    assert.deepEqual(links, []);
  });
});

describe('customer server access: remote-exit membership per site', () => {
  it('toggle off: dropped from confirmed, rmu exactly once; toggle on: re-adu within one tick', () => {
    const state = createRemoteMembershipState();
    const SWEEP = 300_000;
    // tick 1: both eligible -> both adu'd.
    let plan = planRemoteMembership(state, ['a', 'b'], 1_000, SWEEP);
    for (const id of plan.toAdd) recordRemoteMembership(state, id, true);
    assert.deepEqual(planRemoteRevocations(state, []), []);

    // Access off for b: b leaves eligibility (pruned from confirmed) and gets one rmu.
    plan = planRemoteMembership(state, ['a'], 61_000, SWEEP);
    assert.deepEqual(plan.toAdd, []);
    assert.equal(state.confirmed.has('b'), false);
    assert.deepEqual(planRemoteRevocations(state, ['b']), ['b']);
    recordRemoteRevocation(state, 'b', true);
    // Steady state: no further rmu for b, and a full re-sync never re-adds it.
    assert.deepEqual(planRemoteRevocations(state, ['b']), []);
    plan = planRemoteMembership(state, ['a'], 400_000, SWEEP);
    assert.equal(plan.fullResync, true);
    assert.deepEqual(plan.toAdd, ['a']);

    // Access back on: b is eligible and unconfirmed -> the very next fast-path tick re-adus it.
    assert.deepEqual(planRemoteRevocations(state, []), []);
    assert.equal(state.removed.has('b'), false, 'forgotten so a later re-deny rmus again');
    plan = planRemoteMembership(state, ['a', 'b'], 461_000, SWEEP);
    assert.equal(plan.fullResync, false);
    assert.deepEqual(plan.toAdd, ['b']);
  });

  it('a failed rmu is retried next tick (self-healing), at most one rmu per id per tick', () => {
    const state = createRemoteMembershipState();
    assert.deepEqual(planRemoteRevocations(state, ['x', 'x', 'y']), ['x', 'y']);
    recordRemoteRevocation(state, 'x', false);
    recordRemoteRevocation(state, 'y', true);
    assert.deepEqual(planRemoteRevocations(state, ['x', 'y']), ['x']);
  });
});

describe('customer server access: local inbound gating (Iran-entry inbounds only)', () => {
  const endpoints = buildProvisioningEndpoints({
    AFROWS_XRAY_INBOUND_TAGS: 'afrows-in:8447,afrows-in-tcp:8080,afrows-reality:8443:xtls-rprx-vision',
    AFROWS_XRAY_DE_API_SERVER: '127.0.0.1:10086',
  });
  const iranTags = parseIranInboundTags(undefined);

  it('defaults the Iran tag set to both Iran-entry inbounds and honours an override list', () => {
    assert.deepEqual([...iranTags], ['afrows-in', 'afrows-in-tcp']);
    assert.deepEqual([...parseIranInboundTags(' afrows-in , afrows-in-2 ')], ['afrows-in', 'afrows-in-2']);
  });

  it('all on: everything allowed, nothing denied', () => {
    const { allowed, denied } = partitionEndpointsByAccess(endpoints, { germany: true, iran: true }, iranTags);
    assert.deepEqual(allowed, endpoints);
    assert.deepEqual(denied, []);
  });

  it('iran off: both Iran-entry inbounds are denied; afrows-reality and Germany stay', () => {
    const { allowed, denied } = partitionEndpointsByAccess(endpoints, { germany: true, iran: false }, iranTags);
    assert.deepEqual(
      allowed.map((e) => [e.label, e.targets.map((t) => t.tag)]),
      [['ie', ['afrows-reality']], ['de', ['afrows-de-in']]],
    );
    assert.deepEqual(denied.map((e) => [e.label, e.targets.map((t) => t.tag)]), [['ie', ['afrows-in', 'afrows-in-tcp']]]);
  });

  it('germany off: the pushed Germany endpoint is denied, local inbounds untouched', () => {
    const { allowed, denied } = partitionEndpointsByAccess(endpoints, { germany: false, iran: true }, iranTags);
    assert.deepEqual(allowed.map((e) => e.label), ['ie']);
    assert.equal(allowed[0].targets.length, 3);
    assert.deepEqual(denied.map((e) => [e.label, e.targets.map((t) => t.tag)]), [['de', ['afrows-de-in']]]);
  });
});

describe('migration 0066', () => {
  it('adds the three NOT NULL DEFAULT true columns idempotently', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sql = readFileSync(
      join(here, '..', '..', '..', 'infra', 'postgres', 'migrations', '0066_customer_server_access.sql'),
      'utf8',
    );
    for (const column of ['access_germany', 'access_iran', 'access_usa']) {
      assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${column} boolean NOT NULL DEFAULT true`));
    }
  });
});

describe('customer server access: CTO review fixes', () => {
  it('a full re-sync clears `removed`, so every denied id is rmu-d once more per sweep', () => {
    const state = createRemoteMembershipState();
    const SWEEP = 300_000;
    planRemoteMembership(state, ['a'], 1_000, SWEEP);
    assert.deepEqual(planRemoteRevocations(state, ['b']), ['b']);
    recordRemoteRevocation(state, 'b', true);
    planRemoteMembership(state, ['a'], 61_000, SWEEP); // fast path: cache kept
    assert.deepEqual(planRemoteRevocations(state, ['b']), []);
    const plan = planRemoteMembership(state, ['a'], 301_000, SWEEP); // full re-sync
    assert.equal(plan.fullResync, true);
    assert.deepEqual(planRemoteRevocations(state, ['b']), ['b'], 're-issued after the sweep');
  });

  it('the local gate expires on its own cadence', () => {
    const state = createRemoteMembershipState();
    assert.equal(expireRemoteRevocations(state, 300_000, 300_000), true);
    recordRemoteRevocation(state, localGateKey('c', '127.0.0.1:10085', 'afrows-in'), true);
    assert.equal(expireRemoteRevocations(state, 599_000, 300_000), false);
    assert.equal(state.removed.size, 1);
    assert.equal(expireRemoteRevocations(state, 600_000, 300_000), true);
    assert.equal(state.removed.size, 0);
  });

  it('local gate keys are per (config, endpoint, tag)', () => {
    const keys = new Set([
      localGateKey('c', '127.0.0.1:10085', 'afrows-in'),
      localGateKey('c', '127.0.0.1:10085', 'afrows-in-tcp'),
      localGateKey('c', '127.0.0.1:10086', 'afrows-de-in'),
    ]);
    assert.equal(keys.size, 3);
  });

  it('rejects all-off and sets whose allowed servers are all unconfigured, naming why', () => {
    const configured: CustomerServerAccess = { germany: true, iran: true, usa: false };
    assert.equal(serverAccessProblem(ALL_ON, configured), null);
    assert.equal(serverAccessProblem({ germany: false, iran: true, usa: false }, configured), null);
    assert.match(serverAccessProblem({ germany: false, iran: false, usa: false }, configured) ?? '', /At least one server/);
    const onlyUsa = serverAccessProblem({ germany: false, iran: false, usa: true }, configured) ?? '';
    assert.match(onlyUsa, /\(usa\) is configured/);
    assert.match(onlyUsa, /no working link/);
    assert.match(onlyUsa, /\(germany, iran\)/);
  });
});
