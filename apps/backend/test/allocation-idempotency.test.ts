import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import {
  resolveAllocationIdempotencyKey,
  resolveExistingAllocation,
} from '../src/billing/allocation-idempotency.ts';

interface FakeAllocation {
  paymentOrderId: string;
  customerAccountId: string;
}

describe('resolveAllocationIdempotencyKey', () => {
  it('uses the caller-supplied key when present', () => {
    assert.equal(resolveAllocationIdempotencyKey('checkout-abc', 'order-1'), 'checkout-abc');
    assert.equal(resolveAllocationIdempotencyKey('  trim-me  ', 'order-1'), 'trim-me');
  });

  it('falls back to a deterministic per-order key when missing or blank', () => {
    assert.equal(resolveAllocationIdempotencyKey(null, 'order-9'), 'payment_order:order-9');
    assert.equal(resolveAllocationIdempotencyKey(undefined, 'order-9'), 'payment_order:order-9');
    assert.equal(resolveAllocationIdempotencyKey('   ', 'order-9'), 'payment_order:order-9');
  });
});

describe('resolveExistingAllocation', () => {
  it('returns null when nothing is allocated yet (caller proceeds)', () => {
    assert.equal(resolveExistingAllocation<FakeAllocation>(null, null, 'order-1'), null);
  });

  it('returns the existing allocation already on this order (no double-credit)', () => {
    const existing: FakeAllocation = { paymentOrderId: 'order-1', customerAccountId: 'cust-1' };
    const result = resolveExistingAllocation(existing, null, 'order-1');
    assert.deepEqual(result, { allocation: existing, customerAccountId: 'cust-1', duplicate: true });
  });

  it('returns the allocation found under this order’s idempotency key', () => {
    const existing: FakeAllocation = { paymentOrderId: 'order-1', customerAccountId: 'cust-7' };
    const result = resolveExistingAllocation<FakeAllocation>(null, existing, 'order-1');
    assert.deepEqual(result, { allocation: existing, customerAccountId: 'cust-7', duplicate: true });
  });

  it('prefers the per-order allocation over a key match when both exist', () => {
    const forOrder: FakeAllocation = { paymentOrderId: 'order-1', customerAccountId: 'cust-order' };
    const forKey: FakeAllocation = { paymentOrderId: 'order-1', customerAccountId: 'cust-key' };
    const result = resolveExistingAllocation(forOrder, forKey, 'order-1');
    assert.equal(result?.customerAccountId, 'cust-order');
  });

  it('throws ConflictException when the key already belongs to another order', () => {
    const stolen: FakeAllocation = { paymentOrderId: 'order-OTHER', customerAccountId: 'cust-x' };
    assert.throws(() => resolveExistingAllocation<FakeAllocation>(null, stolen, 'order-1'), ConflictException);
  });
});
