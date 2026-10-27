import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRouterRoleAndCustomer } from '../src/routers/router-role.util.ts';

const CUST = '9a0e7e52-0c55-4b7e-9d3f-1f2a3b4c5d6e';

test('transport router rejects a customer link', () => {
  assert.throws(() => resolveRouterRoleAndCustomer('transport', CUST), /transport router cannot have a customer/i);
});

test('gateway may be unassigned (null customer)', () => {
  assert.deepEqual(resolveRouterRoleAndCustomer('gateway', null), { role: 'gateway', customerAccountId: null });
});

test('gateway: blank customer means unassigned', () => {
  assert.deepEqual(resolveRouterRoleAndCustomer('gateway', '  '), { role: 'gateway', customerAccountId: null });
});

test('gateway keeps its customer', () => {
  assert.deepEqual(resolveRouterRoleAndCustomer('gateway', CUST), { role: 'gateway', customerAccountId: CUST });
});

test('gateway rejects a non-uuid customer id with a 400 (not a PG 22P02 → 500)', () => {
  assert.throws(() => resolveRouterRoleAndCustomer('gateway', 'cust-1'), /must be a UUID/);
});

test('village kind forces transport role and null customer', () => {
  assert.deepEqual(resolveRouterRoleAndCustomer('gateway', 'cust-1', 'village'), { role: 'transport', customerAccountId: null });
});
