import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDelta, isCustomerBlocked } from '../src/routers/gateway-billing.util.ts';

test('delta is newest minus cursor', () => {
  assert.equal(computeDelta({ rx: 1000, tx: 500 }, { rx: 200, tx: 100 }), 1200); // (1000-200)+(500-100)
});

test('delta is reset-aware: counter dropped below cursor', () => {
  // wg0 restarted: newest < cursor -> count the newest as the whole delta
  assert.equal(computeDelta({ rx: 50, tx: 30 }, { rx: 1000, tx: 900 }), 80);
});

test('no cursor yet -> newest counts as baseline (zero delta)', () => {
  assert.equal(computeDelta({ rx: 1000, tx: 500 }, null), 0);
});

test('blocked when expired', () => {
  const past = new Date(Date.now() - 1000).toISOString();
  assert.equal(isCustomerBlocked({ status: 'active', expiresAt: past, usedBytes: 0, quotaLimitBytes: 100 }), 'expired');
});

test('blocked when over quota', () => {
  assert.equal(isCustomerBlocked({ status: 'active', expiresAt: null, usedBytes: 100, quotaLimitBytes: 100 }), 'over_quota');
});

test('blocked when inactive', () => {
  assert.equal(isCustomerBlocked({ status: 'suspended', expiresAt: null, usedBytes: 0, quotaLimitBytes: null }), 'inactive');
});

test('not blocked when active, in-date, under quota', () => {
  assert.equal(isCustomerBlocked({ status: 'active', expiresAt: null, usedBytes: 10, quotaLimitBytes: 100 }), null);
});
