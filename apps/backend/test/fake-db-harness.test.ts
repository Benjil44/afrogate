import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ensureClientConfigBelongsToReseller,
  ensureCustomerAccountBelongsToReseller,
} from '../src/billing/reseller-ownership.ts';
import { createFakeDatabase, createFakeExecutor, uniqueViolation } from './helpers/fake-db.ts';

describe('fake-db harness', () => {
  it('records each query with its bound params (ids are parameterized, not interpolated)', async () => {
    const executor = createFakeExecutor([{ rows: [{ resellerAccountId: 'reseller-1' }] }]);
    await ensureCustomerAccountBelongsToReseller(executor, 'cust-1', 'reseller-1');

    assert.equal(executor.calls.length, 1);
    assert.match(executor.calls[0].text, /FROM customer_accounts WHERE id = \$1/);
    assert.deepEqual(executor.calls[0].values, ['cust-1']);
  });

  it('drives an executor-param ownership guard through scripted rows (happy path)', async () => {
    const executor = createFakeExecutor([{ rows: [{ resellerAccountId: 'reseller-1' }] }]);
    await assert.doesNotReject(ensureCustomerAccountBelongsToReseller(executor, 'cust-1', 'reseller-1'));
  });

  it('surfaces NotFound when the scripted result has no rows', async () => {
    const executor = createFakeExecutor([{ rows: [] }]);
    await assert.rejects(
      ensureCustomerAccountBelongsToReseller(executor, 'missing', 'reseller-1'),
      NotFoundException,
    );
  });

  it('surfaces a cross-tenant (IDOR) attempt as BadRequest', async () => {
    const executor = createFakeExecutor([{ rows: [{ resellerAccountId: 'reseller-OTHER' }] }]);
    await assert.rejects(
      ensureCustomerAccountBelongsToReseller(executor, 'cust-1', 'reseller-1'),
      BadRequestException,
    );
  });

  it('runs an executor through the fake transaction wrapper', async () => {
    const db = createFakeDatabase([
      { rows: [{ customerAccountId: 'cust-1', resellerAccountId: 'reseller-1' }] },
    ]);
    await db.transaction((executor) =>
      ensureClientConfigBelongsToReseller(executor, 'config-1', 'reseller-1', 'cust-1'),
    );
    assert.equal(db.executor.calls.length, 1);
    assert.deepEqual(db.executor.calls[0].values, ['config-1']);
  });

  it('propagates a scripted unique-constraint violation (simulates the DB idempotency guard)', async () => {
    const executor = createFakeExecutor([uniqueViolation()]);
    await assert.rejects(
      executor.query('INSERT INTO payment_order_allocations (...) VALUES (...)'),
      (error: unknown) => (error as { code?: string }).code === '23505',
    );
  });
});
