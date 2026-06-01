import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { ClientAuthActor } from '../src/security/auth-request.ts';
import { assertClientScope, hashClientToken, normalizeScopes } from '../src/security/client-token.ts';

const clientActor = (scopes: string[]): ClientAuthActor =>
  ({
    id: 'client-config-1',
    type: 'client',
    clientConfigId: 'client-config-1',
    customerAccountId: 'cust-1',
    tokenId: 'tok-1',
    scopes,
    clientStatus: 'active',
    accountStatus: 'active',
  }) as ClientAuthActor;

describe('hashClientToken', () => {
  it('is deterministic for the same token', () => {
    assert.equal(hashClientToken('plaintext-token'), hashClientToken('plaintext-token'));
  });

  it('produces a 64-char hex SHA-256 digest', () => {
    const hash = hashClientToken('plaintext-token');
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('differs for different tokens', () => {
    assert.notEqual(hashClientToken('token-a'), hashClientToken('token-b'));
  });

  it('never returns the raw token (tokens are stored/looked up by hash only)', () => {
    assert.notEqual(hashClientToken('plaintext-token'), 'plaintext-token');
  });
});

describe('normalizeScopes', () => {
  it('returns a deduped list of non-empty string scopes', () => {
    assert.deepEqual(normalizeScopes(['client:read', 'client:read', 'client:write']), ['client:read', 'client:write']);
  });

  it('drops non-string and empty entries', () => {
    assert.deepEqual(normalizeScopes(['client:read', '', 42, null, undefined, 'client:write']), ['client:read', 'client:write']);
  });

  it('returns an empty array for non-array input', () => {
    assert.deepEqual(normalizeScopes(null), []);
    assert.deepEqual(normalizeScopes('client:read'), []);
    assert.deepEqual(normalizeScopes(undefined), []);
  });
});

describe('assertClientScope', () => {
  it('passes when the client token carries the required scope', () => {
    assert.doesNotThrow(() => assertClientScope(clientActor(['client:read', 'client:write']), 'client:read'));
  });

  it('throws ForbiddenException when the scope is missing', () => {
    assert.throws(() => assertClientScope(clientActor(['client:read']), 'client:write'), ForbiddenException);
  });

  it('throws ForbiddenException for a token with no scopes', () => {
    assert.throws(() => assertClientScope(clientActor([]), 'client:read'), ForbiddenException);
  });
});
