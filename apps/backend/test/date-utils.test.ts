import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { currentUtcDay, formatGrantDay, nextUtcResetAt, parseOptionalDate } from '../src/billing/date-utils.ts';

describe('currentUtcDay', () => {
  it('returns the UTC calendar day of the injected instant', () => {
    assert.equal(currentUtcDay(new Date('2026-06-02T23:59:59Z')), '2026-06-02');
    assert.equal(currentUtcDay(new Date('2026-01-01T00:00:00Z')), '2026-01-01');
  });
});

describe('nextUtcResetAt', () => {
  it('returns midnight of the following UTC day', () => {
    assert.equal(nextUtcResetAt(new Date('2026-06-02T15:30:00Z')), '2026-06-03T00:00:00.000Z');
  });

  it('rolls over month and year boundaries', () => {
    assert.equal(nextUtcResetAt(new Date('2026-12-31T10:00:00Z')), '2027-01-01T00:00:00.000Z');
  });
});

describe('formatGrantDay', () => {
  it('normalizes a Date to YYYY-MM-DD', () => {
    assert.equal(formatGrantDay(new Date('2026-06-02T12:00:00Z')), '2026-06-02');
  });

  it('slices the day key out of a string value', () => {
    assert.equal(formatGrantDay('2026-06-02T08:00:00Z'), '2026-06-02');
    assert.equal(formatGrantDay('2026-06-02'), '2026-06-02');
  });
});

describe('parseOptionalDate', () => {
  it('returns null for empty/missing values', () => {
    assert.equal(parseOptionalDate(null, 'expiresAt'), null);
    assert.equal(parseOptionalDate(undefined, 'expiresAt'), null);
    assert.equal(parseOptionalDate('', 'expiresAt'), null);
  });

  it('parses a valid date', () => {
    const parsed = parseOptionalDate('2026-06-02T00:00:00Z', 'expiresAt');
    assert.ok(parsed instanceof Date);
    assert.equal(parsed?.toISOString(), '2026-06-02T00:00:00.000Z');
  });

  it('throws BadRequestException for an invalid date', () => {
    assert.throws(() => parseOptionalDate('not-a-date', 'expiresAt'), BadRequestException);
  });
});
