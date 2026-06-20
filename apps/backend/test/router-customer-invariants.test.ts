import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRouterRoleAndCustomer } from '../src/routers/router-role.util.ts';

test('transport router rejects a customer link', () => {
  assert.throws(() => resolveRouterRoleAndCustomer('transport', 'cust-1'), /transport router cannot have a customer/i);
});

test('gateway may be unassigned (null customer)', () => {
  assert.deepEqual(resolveRouterRoleAndCustomer('gateway', null), { role: 'gateway', customerAccountId: null });
});

test('gateway keeps its customer', () => {
  assert.deepEqual(resolveRouterRoleAndCustomer('gateway', 'cust-1'), { role: 'gateway', customerAccountId: 'cust-1' });
});

test('village kind forces transport role and null customer', () => {
  assert.deepEqual(resolveRouterRoleAndCustomer('gateway', 'cust-1', 'village'), { role: 'transport', customerAccountId: null });
});
