import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashAgentToken } from '../src/security/agent-token.ts';
import { hashClientToken } from '../src/security/client-token.ts';

describe('hashAgentToken', () => {
  it('is deterministic and produces a 64-char hex SHA-256 digest', () => {
    const hash = hashAgentToken('agent-plaintext-token');
    assert.equal(hash, hashAgentToken('agent-plaintext-token'));
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('differs for different tokens and never returns the raw token', () => {
    assert.notEqual(hashAgentToken('token-a'), hashAgentToken('token-b'));
    assert.notEqual(hashAgentToken('agent-plaintext-token'), 'agent-plaintext-token');
  });

  it('agent and client token hashes use the same scheme but are independent values', () => {
    // both are SHA-256 hex; identical input yields identical digest (same algorithm),
    // which is fine because they are stored in separate tables and looked up by hash.
    assert.equal(hashAgentToken('x'), hashClientToken('x'));
  });
});
