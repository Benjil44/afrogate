import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stripResellerManagedQuotaFields } from '../src/billing/reseller-customer-guard.ts';

describe('stripResellerManagedQuotaFields (free-quota bypass guard)', () => {
  it('removes a preset quota so a reseller cannot grant data without a wallet debit', () => {
    const out = stripResellerManagedQuotaFields({
      displayName: 'Mahdis',
      quotaLimitBytes: 500_000_000_000, // 500 GB, would be free
    });
    assert.equal(out.quotaLimitBytes, undefined);
    assert.equal(out.displayName, 'Mahdis'); // other fields preserved
  });

  it('removes usedBytes so used volume cannot be rewritten', () => {
    const out = stripResellerManagedQuotaFields({ usedBytes: 999 });
    assert.equal(out.usedBytes, undefined);
  });

  it('leaves legitimate edit fields untouched (name, notes, status, per-client cap)', () => {
    const out = stripResellerManagedQuotaFields({
      displayName: 'Ben',
      notes: 'vip',
      status: 'active',
      perClientLimitBytes: 10_000_000_000, // a CAP (restriction), not a grant — keep it
    });
    assert.equal(out.displayName, 'Ben');
    assert.equal(out.notes, 'vip');
    assert.equal(out.status, 'active');
    assert.equal(out.perClientLimitBytes, 10_000_000_000);
    assert.equal(out.quotaLimitBytes, undefined);
    assert.equal(out.usedBytes, undefined);
  });

  it('is a no-op-safe copy when quota/used were never present', () => {
    const input = { displayName: 'Saeed' };
    const out = stripResellerManagedQuotaFields(input);
    assert.equal(out.displayName, 'Saeed');
    assert.notEqual(out, input); // returns a new object, does not mutate the caller's dto
  });

  it('strips a quota of 0 or null too (never lets these paths write the column)', () => {
    assert.equal(stripResellerManagedQuotaFields({ quotaLimitBytes: 0 }).quotaLimitBytes, undefined);
    assert.equal(stripResellerManagedQuotaFields({ quotaLimitBytes: null }).quotaLimitBytes, undefined);
  });
});
