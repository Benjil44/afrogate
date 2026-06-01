import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readBearerToken, secureTokenEquals } from '../src/security/bearer-token.ts';

describe('readBearerToken', () => {
  it('extracts the token after a "Bearer " prefix', () => {
    assert.equal(readBearerToken('Bearer abc123'), 'abc123');
  });

  it('trims surrounding whitespace from the token', () => {
    assert.equal(readBearerToken('Bearer   abc123  '), 'abc123');
  });

  it('returns undefined when the Authorization header is missing', () => {
    assert.equal(readBearerToken(undefined), undefined);
  });

  it('returns undefined when there is no "Bearer " prefix', () => {
    assert.equal(readBearerToken('abc123'), undefined);
    assert.equal(readBearerToken('Token abc123'), undefined);
  });

  it('is case-sensitive about the "Bearer " scheme', () => {
    assert.equal(readBearerToken('bearer abc123'), undefined);
    assert.equal(readBearerToken('BEARER abc123'), undefined);
  });

  it('returns an empty string when the scheme has no token', () => {
    // "Bearer " with nothing after it slices to '' (and trims to '').
    assert.equal(readBearerToken('Bearer '), '');
  });
});

describe('secureTokenEquals (constant-time comparison)', () => {
  it('returns true for identical strings', () => {
    assert.equal(secureTokenEquals('s3cr3t-token', 's3cr3t-token'), true);
  });

  it('returns false for different strings of the same length', () => {
    assert.equal(secureTokenEquals('aaaaaa', 'aaaaab'), false);
  });

  it('returns false when lengths differ (no throw)', () => {
    assert.equal(secureTokenEquals('short', 'a-much-longer-token'), false);
    assert.equal(secureTokenEquals('a-much-longer-token', 'short'), false);
  });

  it('returns false when the actual value is undefined', () => {
    assert.equal(secureTokenEquals(undefined, 'expected'), false);
  });

  it('returns false when the actual value is an empty string', () => {
    // The guard `if (!actual) return false` rejects empty input before comparison.
    assert.equal(secureTokenEquals('', ''), false);
    assert.equal(secureTokenEquals('', 'expected'), false);
  });

  it('handles unicode without throwing and compares by byte content', () => {
    assert.equal(secureTokenEquals('tökén', 'tökén'), true);
    assert.equal(secureTokenEquals('tökén', 'token'), false);
  });
});
