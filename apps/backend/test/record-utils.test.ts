import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { asRecord, stringFromRecord } from '../src/billing/record-utils.ts';

describe('asRecord', () => {
  it('returns plain objects unchanged', () => {
    const obj = { a: 1 };
    assert.equal(asRecord(obj), obj);
  });

  it('rejects null, arrays, and primitives', () => {
    assert.equal(asRecord(null), null);
    assert.equal(asRecord(undefined), null);
    assert.equal(asRecord([1, 2, 3]), null);
    assert.equal(asRecord('string'), null);
    assert.equal(asRecord(42), null);
  });
});

describe('stringFromRecord', () => {
  it('returns the trimmed string value for a key', () => {
    assert.equal(stringFromRecord({ id: '  abc  ' }, 'id'), 'abc');
    assert.equal(stringFromRecord({ id: 'xyz' }, 'id'), 'xyz');
  });

  it('returns null for missing, empty, blank, or non-string values', () => {
    assert.equal(stringFromRecord({ id: '' }, 'id'), null);
    assert.equal(stringFromRecord({ id: '   ' }, 'id'), null);
    assert.equal(stringFromRecord({ id: 123 }, 'id'), null);
    assert.equal(stringFromRecord({}, 'id'), null);
    assert.equal(stringFromRecord(null, 'id'), null);
    assert.equal(stringFromRecord(undefined, 'id'), null);
  });
});
