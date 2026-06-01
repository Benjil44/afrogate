import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DatabaseQueryExecutor } from '../src/database/database.service.ts';
import {
  ensureClientConfigBelongsToReseller,
  ensureCustomerAccountBelongsToReseller,
} from '../src/billing/reseller-ownership.ts';

interface FakeCall {
  text: string;
  values: unknown[] | undefined;
}

/**
 * In-memory fake of DatabaseQueryExecutor. Returns the provided rows for the
 * first (only) query and records the SQL + params so tests can assert that the
 * ownership check parameterizes the id rather than interpolating it.
 */
function fakeExecutor(rows: unknown[]): { executor: DatabaseQueryExecutor; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  const executor = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      return { rows } as unknown as Awaited<ReturnType<DatabaseQueryExecutor['query']>>;
    },
  } satisfies DatabaseQueryExecutor;
  return { executor, calls };
}

describe('ensureCustomerAccountBelongsToReseller', () => {
  it('resolves when the account belongs to the reseller', async () => {
    const { executor, calls } = fakeExecutor([{ resellerAccountId: 'reseller-1' }]);
    await assert.doesNotReject(
      ensureCustomerAccountBelongsToReseller(executor, 'cust-1', 'reseller-1'),
    );
    // parameterized: the customer id is bound, never string-interpolated
    assert.deepEqual(calls[0].values, ['cust-1']);
    assert.match(calls[0].text, /WHERE id = \$1/);
  });

  it('throws NotFoundException for an unknown account', async () => {
    const { executor } = fakeExecutor([]);
    await assert.rejects(
      ensureCustomerAccountBelongsToReseller(executor, 'missing', 'reseller-1'),
      NotFoundException,
    );
  });

  it('throws BadRequestException for a cross-tenant (IDOR) attempt', async () => {
    const { executor } = fakeExecutor([{ resellerAccountId: 'reseller-2' }]);
    await assert.rejects(
      ensureCustomerAccountBelongsToReseller(executor, 'cust-1', 'reseller-1'),
      BadRequestException,
    );
  });

  it('rejects an account with no reseller owner (null) for a reseller actor', async () => {
    const { executor } = fakeExecutor([{ resellerAccountId: null }]);
    await assert.rejects(
      ensureCustomerAccountBelongsToReseller(executor, 'cust-1', 'reseller-1'),
      BadRequestException,
    );
  });
});

describe('ensureClientConfigBelongsToReseller', () => {
  it('resolves when the client config belongs to the reseller (no customer filter)', async () => {
    const { executor } = fakeExecutor([{ customerAccountId: 'cust-1', resellerAccountId: 'reseller-1' }]);
    await assert.doesNotReject(
      ensureClientConfigBelongsToReseller(executor, 'cc-1', 'reseller-1', null),
    );
  });

  it('resolves when the client config also matches the selected customer account', async () => {
    const { executor } = fakeExecutor([{ customerAccountId: 'cust-1', resellerAccountId: 'reseller-1' }]);
    await assert.doesNotReject(
      ensureClientConfigBelongsToReseller(executor, 'cc-1', 'reseller-1', 'cust-1'),
    );
  });

  it('throws NotFoundException for an unknown client config', async () => {
    const { executor } = fakeExecutor([]);
    await assert.rejects(
      ensureClientConfigBelongsToReseller(executor, 'missing', 'reseller-1', null),
      NotFoundException,
    );
  });

  it('throws BadRequestException when the config belongs to another customer account', async () => {
    const { executor } = fakeExecutor([{ customerAccountId: 'cust-1', resellerAccountId: 'reseller-1' }]);
    await assert.rejects(
      ensureClientConfigBelongsToReseller(executor, 'cc-1', 'reseller-1', 'cust-2'),
      BadRequestException,
    );
  });

  it('throws BadRequestException when the config belongs to another reseller (IDOR)', async () => {
    const { executor } = fakeExecutor([{ customerAccountId: 'cust-1', resellerAccountId: 'reseller-2' }]);
    await assert.rejects(
      ensureClientConfigBelongsToReseller(executor, 'cc-1', 'reseller-1', null),
      BadRequestException,
    );
  });

  it('binds only the client config id as a query parameter', async () => {
    const { executor, calls } = fakeExecutor([{ customerAccountId: 'cust-1', resellerAccountId: 'reseller-1' }]);
    await ensureClientConfigBelongsToReseller(executor, 'cc-9', 'reseller-1', null);
    assert.deepEqual(calls[0].values, ['cc-9']);
  });
});
