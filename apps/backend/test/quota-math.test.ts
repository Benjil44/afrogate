import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { BYTES_PER_GB, MAX_SAFE_BYTES, addPositiveBytes, gbToBytes, computeAllocatedQuotaLimitBytes, normalizeOptionalUsageBytes, normalizePositiveByteDelta } from '../src/billing/quota-math.ts';

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

describe("normalizeOptionalUsageBytes", () => {
  it("passes through null and safe non-negative integers", () => {
    assert.equal(normalizeOptionalUsageBytes(null, "b"), null);
    assert.equal(normalizeOptionalUsageBytes(0, "b"), 0);
    assert.equal(normalizeOptionalUsageBytes(1024, "b"), 1024);
  });
  it("rejects negative/fractional/over-max", () => {
    assert.throws(() => normalizeOptionalUsageBytes(-1, "b"), BadRequestException);
    assert.throws(() => normalizeOptionalUsageBytes(1.5, "b"), BadRequestException);
  });
});

describe("normalizePositiveByteDelta", () => {
  it("requires a strictly positive safe integer", () => {
    assert.equal(normalizePositiveByteDelta(50, "d"), 50);
    assert.throws(() => normalizePositiveByteDelta(0, "d"), BadRequestException);
    assert.throws(() => normalizePositiveByteDelta(null, "d"), BadRequestException);
  });
});

describe("addPositiveBytes", () => {
  it("adds within the safe range", () => {
    assert.equal(addPositiveBytes(100, 50, "overflow"), 150);
  });
  it("throws on unsafe overflow", () => {
    assert.throws(() => addPositiveBytes(MAX_SAFE_BYTES, 1, "overflow"), BadRequestException);
  });
});

describe("gbToBytes", () => {
  it("converts gigabytes to bytes", () => {
    assert.equal(gbToBytes(1), BYTES_PER_GB);
    assert.equal(gbToBytes(2), 2 * 1024 ** 3);
    assert.equal(gbToBytes(0), 0);
  });
});
