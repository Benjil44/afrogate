import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SESSION_VERSION,
  constantTimeStringEquals,
  parseSessionPayload,
  signPayload,
  type AdminSessionPayload,
} from '../src/security/session-token.ts';

const validPayload: AdminSessionPayload = {
  v: SESSION_VERSION,
  sub: 'superadmin',
  username: 'superadmin',
  role: 'superadmin',
  type: 'admin',
  isSuperAdmin: true,
  iat: 1_700_000_000,
  exp: 1_700_003_600,
};

const encode = (payload: unknown): string =>
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

describe('signPayload', () => {
  it('is deterministic for the same payload and secret', () => {
    assert.equal(signPayload('abc', 'secret'), signPayload('abc', 'secret'));
  });

  it('changes when the secret changes (forged tokens cannot be re-signed)', () => {
    assert.notEqual(signPayload('abc', 'secret-a'), signPayload('abc', 'secret-b'));
  });

  it('changes when the payload changes', () => {
    assert.notEqual(signPayload('abc', 'secret'), signPayload('abd', 'secret'));
  });
});

describe('constantTimeStringEquals', () => {
  it('returns true for identical signatures', () => {
    const sig = signPayload(encode(validPayload), 'k');
    assert.equal(constantTimeStringEquals(sig, sig), true);
  });

  it('returns false for a tampered signature and for length mismatches', () => {
    assert.equal(constantTimeStringEquals('aaaa', 'aaab'), false);
    assert.equal(constantTimeStringEquals('short', 'longer-value'), false);
  });
});

describe('parseSessionPayload', () => {
  it('round-trips a valid encoded payload', () => {
    const parsed = parseSessionPayload(encode(validPayload));
    assert.deepEqual(parsed, validPayload);
  });

  it('returns null for non-base64 / non-JSON garbage without throwing', () => {
    assert.equal(parseSessionPayload('!!!not base64!!!'), null);
    assert.equal(parseSessionPayload(Buffer.from('not json', 'utf8').toString('base64url')), null);
  });

  it('returns null when required fields are missing or mistyped', () => {
    assert.equal(parseSessionPayload(encode({ ...validPayload, sub: 123 })), null);
    assert.equal(parseSessionPayload(encode({ ...validPayload, exp: '1700003600' })), null);
    const { iat: _omit, ...withoutIat } = validPayload;
    assert.equal(parseSessionPayload(encode(withoutIat)), null);
  });

  it('returns null when the token type is not "admin"', () => {
    assert.equal(parseSessionPayload(encode({ ...validPayload, type: 'client' })), null);
  });
});

describe('end-to-end sign + verify + parse flow', () => {
  it('verifies a self-signed token and rejects a tampered one', () => {
    const secret = 'a-very-long-random-session-secret';
    const encoded = encode(validPayload);
    const signature = signPayload(encoded, secret);

    // legitimate token
    assert.equal(constantTimeStringEquals(signPayload(encoded, secret), signature), true);
    assert.deepEqual(parseSessionPayload(encoded), validPayload);

    // attacker edits the payload (e.g. escalates role) but cannot forge the signature without the secret
    const tampered = encode({ ...validPayload, role: 'superadmin', sub: 'attacker' });
    assert.equal(constantTimeStringEquals(signPayload(tampered, secret), signature), false);
  });
});
