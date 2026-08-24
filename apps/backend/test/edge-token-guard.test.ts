import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkEdgeToken } from '../src/security/edge-token.ts';

const TOKEN = 'edge-secret-token';

describe('checkEdgeToken (EdgeTokenGuard decision)', () => {
  it('accepts a Bearer token equal to the configured secret', () => {
    assert.deepEqual(checkEdgeToken(`Bearer ${TOKEN}`, TOKEN), { ok: true });
  });

  it('rejects a wrong token as invalid (→ 401)', () => {
    assert.deepEqual(checkEdgeToken('Bearer nope', TOKEN), { ok: false, reason: 'invalid' });
  });

  it('rejects a missing Authorization header as missing (→ 401)', () => {
    assert.deepEqual(checkEdgeToken(undefined, TOKEN), { ok: false, reason: 'missing' });
  });

  it('rejects a non-Bearer scheme as missing (→ 401)', () => {
    assert.deepEqual(checkEdgeToken(`Token ${TOKEN}`, TOKEN), { ok: false, reason: 'missing' });
  });

  it('rejects ALL requests as unconfigured (→ 503) when the secret is unset — endpoints inert', () => {
    assert.deepEqual(checkEdgeToken(`Bearer ${TOKEN}`, undefined), { ok: false, reason: 'unconfigured' });
    assert.deepEqual(checkEdgeToken(undefined, undefined), { ok: false, reason: 'unconfigured' });
  });

  it('rejects ALL requests as unconfigured (→ 503) when the secret is empty/whitespace', () => {
    assert.deepEqual(checkEdgeToken(`Bearer ${TOKEN}`, '   '), { ok: false, reason: 'unconfigured' });
    assert.deepEqual(checkEdgeToken(`Bearer ${TOKEN}`, ''), { ok: false, reason: 'unconfigured' });
  });

  it('is length-safe: a token of a different length is invalid, not a throw', () => {
    assert.deepEqual(checkEdgeToken('Bearer short', 'a-much-longer-secret'), { ok: false, reason: 'invalid' });
  });
});
