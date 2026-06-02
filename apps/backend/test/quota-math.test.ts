import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { MAX_SAFE_BYTES, computeAllocatedQuotaLimitBytes } from '../src/billing/quota-math.ts';

describe('computeAllocatedQuotaLimitBytes', () => {
  it('treats a null limit as the used-byte baseline so a top-up grants only the purchased volume', () => {
    // account used 100 bytes, no prior limit, buys 50 -> limit 150 -> remaining 50
    assert.equal(computeAllocatedQuotaLimitBytes(null, 100, 50), 150);
  });

  it('adds the purchased volume to an existing limit (used bytes ignored)', () => {
    assert.equal(computeAllocatedQuotaLimitBytes(1000, 100, 50), 1050);
  });

  it('does not retroactively forgive prior usage on the null-baseline path', () => {
    // used 1000, no limit, buys 200 -> new limit 1200 (remaining = 200, not 1200)
    const limit = computeAllocatedQuotaLimitBytes(null, 1000, 200);
    assert.equal(limit - 1000, 200);
  });

  it('treats a zero existing limit as a real limit (not null)', () => {
    assert.equal(computeAllocatedQuotaLimitBytes(0, 5000, 50), 50);
  });

  it('throws when the result would overflow the safe byte range', () => {
    assert.throws(() => computeAllocatedQuotaLimitBytes(MAX_SAFE_BYTES, 0, 1), BadRequestException);
    assert.throws(() => computeAllocatedQuotaLimitBytes(null, MAX_SAFE_BYTES, 1), BadRequestException);
  });
});
