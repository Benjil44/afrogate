/**
 * Per-customer server access (0.118.0) through the REAL BillingService (bundled
 * with esbuild; see helpers/load-bundled.ts): link filtering on the dashboard /
 * Telegram path and the public /sub/<token>, the update flow (partial update,
 * all-off 400, audit, enforcement kick, reseller IDOR guard) and DTO validation.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { deriveSubscriptionToken, hashSubscriptionToken } from '../src/client/subscription-token.ts';
import { bundledSkipReason, loadBundled, requireBackendDependency } from './helpers/load-bundled.ts';

type Service = Record<string, (...args: unknown[]) => Promise<unknown>>;
type Ctor = new (...deps: unknown[]) => Service;
let BillingService: Ctor | null = null;
let UpdateCustomerAccountDto: (new () => object) | null = null;
let CreateCustomerAccountDto: (new () => object) | null = null;

const SECRET = 's'.repeat(48);
const ACCOUNT_ID = '9a0e7e52-0c55-4b7e-9d3f-1f2a3b4c5d6e';
const CONFIG_ID = '0f6c2c3a-8a59-4c1e-9d0e-5b8f7a1d2e3f';
const ENTRY_UUID = '00113fad-42da-4be7-ae1e-cce226baf47e';
const ENV: Record<string, string> = {
  AFROWS_SUBSCRIPTION_SECRET: SECRET,
  AFROWS_SUBSCRIPTION_BASE_URL: 'https://app.afrows.com/sub',
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
  AFROWS_US_MGMT_ENABLED: 'true',
};

interface Access {
  accessGermany: boolean;
  accessIran: boolean;
  accessUsa: boolean;
}

function harness(initial: Partial<Access> = {}, resellerOfAccount = 'reseller-1') {
  const access: Access = { accessGermany: true, accessIran: true, accessUsa: true, ...initial };
  const updates: Array<{ text: string; values: unknown[] }> = [];
  const inserts: unknown[][] = [];
  const audits: unknown[][] = [];
  let reconcileRequests = 0;
  const executor = {
    async query(text: string, values: unknown[] = []) {
      const rows = route(text, values);
      return { rows, rowCount: rows.length };
    },
  };
  function route(text: string, values: unknown[]): unknown[] {
    if (text.includes('cc.entry_uuid AS "entryUuid", cc.label')) {
      return [{ entryUuid: ENTRY_UUID, label: 'cfg', displayName: 'ben', ...access }];
    }
    if (text.includes('WHERE cc.subscription_token_hash = $1')) {
      return [{
        id: CONFIG_ID,
        version: 1,
        entryUuid: ENTRY_UUID,
        configStatus: 'active',
        clientUsedBytes: '0',
        clientQuotaLimitBytes: null,
        accountStatus: 'active',
        accountDeletedAt: null,
        accountExpiresAt: null,
        accountUsedBytes: '0',
        accountQuotaLimitBytes: null,
        perClientLimitBytes: null,
        ...access,
      }];
    }
    if (text.includes('subscription_token_hash AS "tokenHash"')) return [{ version: 1, tokenHash: null }];
    if (text.includes('SET subscription_token_hash = $2')) return [];
    if (text.includes('SELECT id FROM customer_accounts WHERE id = $1')) return [{ id: values[0] }];
    if (text.includes('access_germany AS "accessGermany"') && text.includes('FOR UPDATE')) return [{ ...access }];
    if (text.includes('INSERT INTO customer_accounts')) {
      inserts.push(values);
      return [{ id: ACCOUNT_ID }];
    }
    if (text.includes('UPDATE customer_accounts')) {
      updates.push({ text, values });
      return [];
    }
    if (text.includes('WHERE ra.admin_user_id = $1')) return [{ id: 'reseller-1', status: 'active' }];
    if (text.includes('SELECT reseller_account_id AS "resellerAccountId" FROM customer_accounts')) {
      return [{ resellerAccountId: resellerOfAccount }];
    }
    if (text.includes('FROM reseller_accounts') && text.includes('WHERE id = $1')) return [{ id: values[0] }];
    throw new Error(`unexpected SQL: ${text.slice(0, 120)}`);
  }
  const database = { ...executor, transaction: <T>(cb: (e: typeof executor) => Promise<T>) => cb(executor) };
  const audit = { record: async (...args: unknown[]) => { audits.push(args); } };
  const provisioning = { requestReconcile: () => { reconcileRequests += 1; }, reconcile: async () => undefined };
  const service = new BillingService!(database, audit, undefined, undefined, undefined, undefined, undefined, undefined, provisioning);
  service.getCustomerAccount = async (id: unknown) => ({ id });
  return { service, updates, inserts, audits, reconcileRequests: () => reconcileRequests };
}

const ADMIN = { id: 'admin-1', role: 'admin', type: 'admin' };

describe('server access (BillingService)', { skip: bundledSkipReason }, () => {
  const saved: Record<string, string | undefined> = {};
  before(() => {
    BillingService = loadBundled<{ BillingService: Ctor }>('billing/billing.service.ts', { quiet: true }).BillingService;
    const dtos = loadBundled<{ UpdateCustomerAccountDto: new () => object; CreateCustomerAccountDto: new () => object }>(
      'billing/dto/customer-account.dto.ts',
    );
    UpdateCustomerAccountDto = dtos.UpdateCustomerAccountDto;
    CreateCustomerAccountDto = dtos.CreateCustomerAccountDto;
    for (const [key, value] of Object.entries(ENV)) {
      saved[key] = process.env[key];
      process.env[key] = value;
    }
  });
  after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('resolveEntryLinks (dashboard/export/Telegram) returns only allowed servers, all three by default', async () => {
    const kinds = async (access: Partial<Access>) =>
      ((await harness(access).service.resolveEntryLinks(CONFIG_ID)) as Array<{ kind: string }>).map((l) => l.kind);
    assert.deepEqual(await kinds({}), ['germany', 'iran', 'usa']);
    assert.deepEqual(await kinds({ accessGermany: false }), ['iran', 'usa']);
    assert.deepEqual(await kinds({ accessIran: false, accessUsa: false }), ['germany']);
    assert.deepEqual(await kinds({ accessGermany: false, accessIran: false }), ['usa']);
    const bundle = (await harness({ accessGermany: false }).service.getClientConfigLinkBundle(CONFIG_ID)) as {
      links: Array<{ kind: string }>;
    };
    assert.deepEqual(bundle.links.map((l) => l.kind), ['iran', 'usa']);
    const { link } = (await harness({ accessGermany: false }).service.getClientConfigEntryLink(CONFIG_ID)) as { link: string };
    assert.ok(link.includes('94.74.145.199'), 'copy-link button gets the first ALLOWED link, never Germany');
  });

  it('never falls back to a disallowed server (only USA allowed, USA entry env off -> empty)', async () => {
    process.env.AFROWS_US_ENTRY_ENABLED = 'false';
    try {
      const links = await harness({ accessGermany: false, accessIran: false }).service.resolveEntryLinks(CONFIG_ID);
      assert.deepEqual(links, []);
    } finally {
      process.env.AFROWS_US_ENTRY_ENABLED = 'true';
    }
  });

  it('public /sub/<token> serves only allowed servers', async () => {
    const token = deriveSubscriptionToken(SECRET, CONFIG_ID, 1);
    assert.equal(hashSubscriptionToken(token).length > 0, true);
    const uris = async (access: Partial<Access>) => {
      const payload = (await harness(access).service.resolvePublicSubscription(token)) as { body: string } | null;
      return payload ? Buffer.from(payload.body, 'base64').toString('utf8').split('\n') : null;
    };
    const all = await uris({});
    assert.equal(all?.length, 3);
    const noUsa = await uris({ accessUsa: false });
    assert.deepEqual(noUsa?.map((u) => u.split('#')[1]), ['Afrows%20Germany', 'Afrows%20Shatel']);
    const onlyIran = await uris({ accessGermany: false, accessUsa: false });
    assert.deepEqual(onlyIran?.map((u) => u.split('#')[1]), ['Afrows%20Shatel']);
  });

  it('partial update writes only the given flag, audits before/after and kicks enforcement', async () => {
    const h = harness();
    await h.service.updateCustomerAccount(ACCOUNT_ID, { serverAccess: { usa: false } }, ADMIN);
    assert.equal(h.updates.length, 1);
    assert.match(h.updates[0].text, /access_usa = \$1/);
    assert.doesNotMatch(h.updates[0].text, /access_germany|access_iran/);
    assert.deepEqual(h.updates[0].values, [false, ACCOUNT_ID]);
    const metadata = h.audits[0][4] as Record<string, unknown>;
    assert.deepEqual(metadata.changedFields, ['serverAccess.usa']);
    assert.deepEqual(metadata.serverAccessBefore, { germany: true, iran: true, usa: true });
    assert.deepEqual(metadata.serverAccessAfter, { germany: true, iran: true, usa: false });
    assert.equal(h.reconcileRequests(), 1);
  });

  it('an unchanged value is written but does not kick enforcement', async () => {
    const h = harness();
    await h.service.updateCustomerAccount(ACCOUNT_ID, { serverAccess: { germany: true } }, ADMIN);
    assert.equal(h.reconcileRequests(), 0);
    assert.equal((h.audits[0][4] as Record<string, unknown>).serverAccessBefore, undefined);
  });

  it('rejects (400) a change that leaves all three servers off, writing nothing', async () => {
    const h = harness({ accessGermany: false, accessUsa: false });
    await assert.rejects(
      () => h.service.updateCustomerAccount(ACCOUNT_ID, { serverAccess: { iran: false } }, ADMIN),
      (error: { status?: number; getStatus?: () => number }) => (error.getStatus?.() ?? error.status) === 400,
    );
    await assert.rejects(
      () =>
        harness().service.updateCustomerAccount(ACCOUNT_ID, { serverAccess: { germany: false, iran: false, usa: false } }, ADMIN),
      /At least one server/,
    );
    assert.equal(h.updates.length, 0);
    assert.equal(h.audits.length, 0);
    assert.equal(h.reconcileRequests(), 0);
  });

  it('reseller path: server access is read-only (403), and the IDOR guard still runs first', async () => {
    const seller = { id: 'seller-user', role: 'reseller', type: 'admin' };
    const own = harness();
    await assert.rejects(
      () => own.service.updateResellerCustomerAccount(ACCOUNT_ID, { serverAccess: { iran: false } }, seller),
      (error: { getStatus?: () => number; message?: string }) =>
        error.getStatus?.() === 403 && /Sellers cannot change server access/.test(error.message ?? ''),
    );
    assert.equal(own.updates.length, 0);
    // A plain seller edit without serverAccess still works.
    await own.service.updateResellerCustomerAccount(ACCOUNT_ID, { notes: 'x' }, seller);
    assert.ok(own.updates.some((u) => /notes = /.test(u.text)));
    // Seller create with serverAccess is refused the same way.
    await assert.rejects(
      () => own.service.createResellerCustomerAccount({ serverAccess: { usa: false } }, seller),
      (error: { getStatus?: () => number }) => error.getStatus?.() === 403,
    );
    assert.equal(own.inserts.length, 0);

    const other = harness({}, 'reseller-OTHER');
    await assert.rejects(
      () => other.service.updateResellerCustomerAccount(ACCOUNT_ID, { notes: 'x' }, seller),
      /does not belong to this reseller/,
    );
    assert.equal(other.updates.length, 0);
  });

  it('rejects (400) a change whose allowed servers are all unconfigured, naming why', async () => {
    delete process.env.AFROWS_US_MGMT_ENABLED; // USA entry env on, USA mgmt off -> USA not configured
    try {
      const h = harness();
      assert.deepEqual(h.service.getConfiguredServers(), { germany: true, iran: true, usa: false });
      await assert.rejects(
        () => h.service.updateCustomerAccount(ACCOUNT_ID, { serverAccess: { germany: false, iran: false } }, ADMIN),
        (error: { getStatus?: () => number; message?: string }) =>
          error.getStatus?.() === 400 && /\(usa\) is configured/.test(error.message ?? ''),
      );
      assert.equal(h.updates.length, 0);
      // Turning a configured one off while another configured stays on is fine.
      await h.service.updateCustomerAccount(ACCOUNT_ID, { serverAccess: { germany: false } }, ADMIN);
      assert.equal(h.updates.length, 1);
    } finally {
      process.env.AFROWS_US_MGMT_ENABLED = 'true';
    }
    assert.deepEqual(harness().service.getConfiguredServers(), { germany: true, iran: true, usa: true });
  });

  it('create writes serverAccess in the same INSERT (missing keys = on) and validates it', async () => {
    const h = harness();
    await h.service.createCustomerAccount({ displayName: 'n', serverAccess: { usa: false } }, ADMIN);
    assert.deepEqual(h.inserts[0].slice(-3), [true, true, false]);
    assert.deepEqual((h.audits[0][4] as Record<string, unknown>).serverAccess, { germany: true, iran: true, usa: false });

    await h.service.createCustomerAccount({ displayName: 'n' }, ADMIN);
    assert.deepEqual(h.inserts[1].slice(-3), [true, true, true]);

    await assert.rejects(
      () => h.service.createCustomerAccount({ displayName: 'n', serverAccess: { germany: false, iran: false, usa: false } }, ADMIN),
      /At least one server/,
    );
    delete process.env.AFROWS_US_MGMT_ENABLED;
    try {
      await assert.rejects(
        () => h.service.createCustomerAccount({ displayName: 'n', serverAccess: { germany: false, iran: false } }, ADMIN),
        /is configured on this deployment/,
      );
    } finally {
      process.env.AFROWS_US_MGMT_ENABLED = 'true';
    }
    assert.equal(h.inserts.length, 2);
  });

  it('DTO accepts a partial boolean object and rejects null / non-boolean values', async () => {
    const { plainToInstance } = requireBackendDependency<typeof import('class-transformer')>('class-transformer');
    const { validate } = requireBackendDependency<typeof import('class-validator')>('class-validator');
    const errorsFor = async (payload: Record<string, unknown>) =>
      validate(plainToInstance(UpdateCustomerAccountDto!, payload) as object, { whitelist: true });
    assert.equal((await errorsFor({ serverAccess: { usa: false } })).length, 0);
    assert.equal((await errorsFor({ serverAccess: { germany: true, iran: false, usa: true } })).length, 0);
    assert.equal((await errorsFor({})).length, 0);
    assert.ok((await errorsFor({ serverAccess: null })).length > 0);
    assert.ok((await errorsFor({ serverAccess: 'all' })).length > 0);
    assert.ok((await errorsFor({ serverAccess: { usa: 'no' } })).length > 0);
    const createErrors = async (payload: Record<string, unknown>) =>
      validate(plainToInstance(CreateCustomerAccountDto!, payload) as object, { whitelist: true });
    assert.equal((await createErrors({ serverAccess: { iran: false } })).length, 0);
    assert.ok((await createErrors({ serverAccess: null })).length > 0);
  });
});
