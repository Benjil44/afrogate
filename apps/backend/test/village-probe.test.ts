import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EGRESS_HEALTH_MAX_AGE_MS, isRouterAuthRejection, readGermanyUp } from '../src/routers/village-probe.ts';

describe('village probe helpers', () => {
  it('treats 401/403 REST errors as an auth rejection (router is up)', () => {
    assert.equal(isRouterAuthRejection('MikroTik GET /system/resource -> 401: {"error":401}'), true);
    assert.equal(isRouterAuthRejection('MikroTik GET /system/resource -> 403: forbidden'), true);
    assert.equal(isRouterAuthRejection('MikroTik GET /system/resource -> 404: no such'), false);
    assert.equal(isRouterAuthRejection('connect ETIMEDOUT 10.20.0.2:80'), false);
    assert.equal(isRouterAuthRejection(null), false);
  });

  const now = Date.parse('2026-10-10T21:30:00Z');
  const file = (body: unknown) => async () => JSON.stringify(body);

  it('reads germanyUp from a fresh snapshot', async () => {
    assert.equal(await readGermanyUp(file({ germanyUp: true, updatedAt: '2026-10-10T21:29:35Z' }), {}, now), true);
    assert.equal(await readGermanyUp(file({ germanyUp: false, updatedAt: '2026-10-10T21:29:35Z' }), {}, now), false);
  });

  it('returns null for a stale, malformed or missing snapshot', async () => {
    const stale = new Date(now - EGRESS_HEALTH_MAX_AGE_MS - 1000).toISOString();
    assert.equal(await readGermanyUp(file({ germanyUp: true, updatedAt: stale }), {}, now), null);
    assert.equal(await readGermanyUp(file({ germanyUp: 'yes', updatedAt: '2026-10-10T21:29:35Z' }), {}, now), null);
    assert.equal(await readGermanyUp(async () => { throw new Error('ENOENT'); }, {}, now), null);
  });

  it('honours AFROWS_EGRESS_HEALTH_PATH', async () => {
    let seen = '';
    await readGermanyUp(async (p) => { seen = p; return '{}'; }, { AFROWS_EGRESS_HEALTH_PATH: '/tmp/h.json' }, now);
    assert.equal(seen, '/tmp/h.json');
  });
});
