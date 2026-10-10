/**
 * Drives the REAL BillingService subscription methods (public `GET /sub/:token`
 * resolution, rotation, reseller IDOR guard, export decoration) against an
 * in-memory SQL router. BillingService uses Nest decorators + constructor
 * parameter properties, so it is bundled with esbuild exactly like
 * telegram-bot-superadmin.test.ts (skipped locally if esbuild is unresolvable).
 */
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { deriveSubscriptionToken, hashSubscriptionToken } from '../src/client/subscription-token.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const requireFromBackend = createRequire(path.join(backendRoot, 'package.json'));

type Service = Record<string, (...args: unknown[]) => Promise<unknown>>;
type Ctor = new (...deps: unknown[]) => Service;

let BillingService: Ctor | null = null;
let skipReason: string | false = false;
try {
  requireFromBackend.resolve('esbuild');
} catch {
  if (process.env.CI) throw new Error('esbuild must be resolvable from apps/backend in CI');
  skipReason = 'esbuild not resolvable from apps/backend';
}

function loadService(): Ctor {
  requireFromBackend('reflect-metadata');
  const esbuild = requireFromBackend('esbuild') as typeof import('esbuild');
  const out = esbuild.buildSync({
    entryPoints: [path.join(backendRoot, 'src/billing/billing.service.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    write: false,
    tsconfig: path.join(backendRoot, 'tsconfig.json'),
    target: 'node20',
    logLevel: 'error',
  });
  const filename = path.join(here, '__billing.service.bundle.cjs');
  const mod = new Module(filename) as Module & { _compile(code: string, filename: string): void; paths: string[] };
  mod.filename = filename;
  mod.paths = (Module as unknown as { _nodeModulePaths(dir: string): string[] })._nodeModulePaths(here);
  mod._compile(out.outputFiles[0].text, filename);
  return (mod.exports as { BillingService: Ctor }).BillingService;
}

const SECRET = 's'.repeat(48);
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
};

interface ConfigState {
  version: number;
  tokenHash: string | null;
  configStatus: string;
  accountStatus: string;
  accountDeletedAt: Date | null;
  exists: boolean;
}

function harness(overrides: Partial<ConfigState> = {}) {
  const state: ConfigState = {
    version: 1,
    tokenHash: null,
    configStatus: 'active',
    accountStatus: 'active',
    accountDeletedAt: null,
    exists: true,
    ...overrides,
  };
  const audits: unknown[][] = [];
  const queries: string[] = [];
  const executor = {
    async query(text: string, values: unknown[] = []) {
      queries.push(text);
      const rows = route(text, values);
      return { rows, rowCount: rows.length };
    },
  };
  function route(text: string, values: unknown[]): unknown[] {
    if (text.includes('WHERE cc.subscription_token_hash = $1')) {
      if (!state.exists || values[0] !== state.tokenHash) return [];
      return [{
        id: CONFIG_ID,
        version: state.version,
        entryUuid: ENTRY_UUID,
        configStatus: state.configStatus,
        clientUsedBytes: '1000',
        clientQuotaLimitBytes: null,
        accountStatus: state.accountStatus,
        accountDeletedAt: state.accountDeletedAt,
        accountExpiresAt: new Date('2026-12-01T00:00:00Z'),
        accountUsedBytes: '2500000000',
        accountQuotaLimitBytes: '20000000000',
        perClientLimitBytes: null,
      }];
    }
    if (text.includes('FOR UPDATE') && text.includes('subscription_token_version')) {
      return state.exists ? [{ version: state.version, customerAccountId: 'acct-1' }] : [];
    }
    if (text.includes('SET subscription_token_version = $2, subscription_token_hash = $3')) {
      state.version = values[1] as number;
      state.tokenHash = values[2] as string;
      return [];
    }
    if (text.includes('SET subscription_token_hash = $2')) {
      if (values[2] === state.version) state.tokenHash = values[1] as string;
      return [];
    }
    if (text.includes('subscription_token_hash AS "tokenHash"')) {
      return state.exists ? [{ version: state.version, tokenHash: state.tokenHash }] : [];
    }
    if (text.includes('cc.entry_uuid AS "entryUuid", cc.label')) {
      return state.exists ? [{ entryUuid: ENTRY_UUID, label: 'cfg', displayName: 'ben' }] : [];
    }
    if (text.includes('WHERE ra.admin_user_id = $1')) return [{ id: 'reseller-1', status: 'active' }];
    if (text.includes('FOR SHARE OF cc, ca')) return [{ customerAccountId: 'acct-1', resellerAccountId: 'reseller-OTHER' }];
    throw new Error(`unexpected SQL: ${text.slice(0, 120)}`);
  }
  const database = { ...executor, transaction: <T>(cb: (e: typeof executor) => Promise<T>) => cb(executor) };
  const audit = { record: async (...args: unknown[]) => { audits.push(args); } };
  const service = new BillingService!(database, audit);
  return { service, state, audits, queries };
}

describe('public subscription (BillingService)', { skip: skipReason }, () => {
  const saved: Record<string, string | undefined> = {};
  before(() => {
    BillingService = loadService();
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

  const tokenV1 = () => deriveSubscriptionToken(SECRET, CONFIG_ID, 1);

  it('lazily backfills the hash on first URL read and serves both links', async () => {
    const h = harness();
    const url = await h.service.getClientConfigSubscriptionUrl(CONFIG_ID);
    assert.equal(url, `https://app.afrows.com/sub/${tokenV1()}`);
    assert.equal(h.state.tokenHash, hashSubscriptionToken(tokenV1()));

    const payload = (await h.service.resolvePublicSubscription(tokenV1())) as { body: string; headers: Record<string, string> };
    const uris = Buffer.from(payload.body, 'base64').toString('utf8').split('\n');
    assert.equal(uris.length, 2);
    assert.ok(uris[0].startsWith(`vless://${ENTRY_UUID}@de.afrows.com:443?`) && uris[0].endsWith('#Afrows%20Germany'));
    assert.ok(uris[1].startsWith(`vless://${ENTRY_UUID}@94.74.145.199:443?`) && uris[1].endsWith('#Afrows%20Shatel'));
    assert.ok(!payload.body.includes('ben') && !Buffer.from(payload.body, 'base64').toString().includes('ben'));
    assert.equal(payload.headers['subscription-userinfo'], 'upload=0; download=2500000000; total=20000000000; expire=1796083200');
  });

  it('rotation bumps the version, audits, and kills the old URL at once', async () => {
    const h = harness({ tokenHash: hashSubscriptionToken(tokenV1()) });
    const rotated = (await h.service.rotateClientConfigSubscriptionToken(CONFIG_ID, { id: 'admin-1', role: 'admin', type: 'admin' })) as {
      subscriptionUrl: string;
    };
    const tokenV2 = deriveSubscriptionToken(SECRET, CONFIG_ID, 2);
    assert.equal(rotated.subscriptionUrl, `https://app.afrows.com/sub/${tokenV2}`);
    assert.equal(h.state.version, 2);
    assert.equal(await h.service.resolvePublicSubscription(tokenV1()), null);
    assert.ok(await h.service.resolvePublicSubscription(tokenV2));
    assert.equal(h.audits.length, 1);
    assert.equal(h.audits[0][1], 'client_config.subscription_token.rotated');
    assert.ok(!JSON.stringify(h.audits[0]).includes(tokenV2), 'audit never carries the token');
  });

  it('returns null (404) for deleted configs, disabled/expired configs and archived or non-active accounts', async () => {
    const hash = hashSubscriptionToken(tokenV1());
    for (const overrides of [
      { exists: false },
      { configStatus: 'disabled' },
      { configStatus: 'expired' },
      { accountStatus: 'disabled', accountDeletedAt: new Date() },
      { accountStatus: 'suspended' },
    ] as Array<Partial<ConfigState>>) {
      const h = harness({ tokenHash: hash, ...overrides });
      assert.equal(await h.service.resolvePublicSubscription(tokenV1()), null, JSON.stringify(overrides));
    }
  });

  it('still serves an over-quota (limited) config', async () => {
    const h = harness({ tokenHash: hashSubscriptionToken(tokenV1()), configStatus: 'limited' });
    assert.ok(await h.service.resolvePublicSubscription(tokenV1()));
  });

  it('rejects malformed tokens before any DB access, and everything when the feature is off', async () => {
    const h = harness({ tokenHash: hashSubscriptionToken(tokenV1()) });
    assert.equal(await h.service.resolvePublicSubscription("' OR 1=1 --"), null);
    assert.equal(await h.service.resolvePublicSubscription(`${tokenV1()}x`), null);
    assert.equal(h.queries.length, 0);

    process.env.AFROWS_SUBSCRIPTION_SECRET = 'short';
    try {
      assert.equal(await h.service.resolvePublicSubscription(tokenV1()), null);
      assert.equal(await h.service.getClientConfigSubscriptionUrl(CONFIG_ID), null);
      await assert.rejects(() => h.service.rotateClientConfigSubscriptionToken(CONFIG_ID, undefined), /not configured/);
      assert.equal(h.queries.length, 0);
    } finally {
      process.env.AFROWS_SUBSCRIPTION_SECRET = SECRET;
    }
  });

  it('a token whose hash collides but HMAC does not match is refused (timing-safe compare)', async () => {
    const forged = 'A'.repeat(32);
    const h = harness({ tokenHash: hashSubscriptionToken(forged) });
    assert.equal(await h.service.resolvePublicSubscription(forged), null);
  });

  it('reseller rotation is IDOR-guarded to the seller own customers', async () => {
    const h = harness({ tokenHash: hashSubscriptionToken(tokenV1()) });
    await assert.rejects(
      () => h.service.rotateResellerClientConfigSubscriptionToken(CONFIG_ID, { id: 'seller-user', role: 'reseller', type: 'admin' }),
      /does not belong to this reseller/,
    );
    assert.equal(h.state.version, 1);
    assert.equal(h.audits.length, 0);
  });

  it('resolveEntryLinks returns Germany then Shatel with customer remarks and QR SVGs', async () => {
    const h = harness();
    const links = (await h.service.resolveEntryLinks(CONFIG_ID)) as Array<{ kind: string; uri: string; qrSvg: string }>;
    assert.deepEqual(links.map((link) => link.kind), ['germany', 'iran']);
    assert.ok(links[0].uri.endsWith(`#${encodeURIComponent('ben · Germany')}`));
    assert.ok(links[1].uri.endsWith(`#${encodeURIComponent('ben · Shatel')}`));
    assert.ok(links.every((link) => link.qrSvg.startsWith('<svg')));
    const { link } = (await h.service.getClientConfigEntryLink(CONFIG_ID)) as { link: string };
    assert.equal(link, links[0].uri);
  });
});
