import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyScryptPassword } from '../src/security/password.ts';

describe('hashPassword', () => {
  it('produces a scrypt$N$r$p$salt$hash encoded string', () => {
    const hash = hashPassword('correct horse battery staple');
    const parts = hash.split('$');
    assert.equal(parts.length, 6);
    assert.equal(parts[0], 'scrypt');
    assert.equal(parts[1], '16384');
    assert.equal(parts[2], '8');
    assert.equal(parts[3], '1');
    assert.ok(parts[4].length > 0, 'salt segment present');
    assert.ok(parts[5].length > 0, 'hash segment present');
  });

  it('uses a random salt so the same password hashes differently each time', () => {
    assert.notEqual(hashPassword('same-password'), hashPassword('same-password'));
  });
});

describe('verifyScryptPassword', () => {
  it('accepts the correct password against its own hash', () => {
    const hash = hashPassword('s3cret-Pa55');
    assert.equal(verifyScryptPassword('s3cret-Pa55', hash), true);
  });

  it('rejects an incorrect password', () => {
    const hash = hashPassword('s3cret-Pa55');
    assert.equal(verifyScryptPassword('s3cret-Pa56', hash), false);
    assert.equal(verifyScryptPassword('', hash), false);
  });

  it('rejects malformed stored hashes without throwing', () => {
    assert.equal(verifyScryptPassword('x', ''), false);
    assert.equal(verifyScryptPassword('x', 'not-a-hash'), false);
    assert.equal(verifyScryptPassword('x', 'bcrypt$16384$8$1$aaaa$bbbb'), false); // wrong algorithm prefix
    assert.equal(verifyScryptPassword('x', 'scrypt$x$8$1$aaaa$bbbb'), false); // non-integer N
    assert.equal(verifyScryptPassword('x', 'scrypt$16384$8$1$aaaa'), false); // too few segments
  });

  it('is resistant to a tampered hash segment', () => {
    const hash = hashPassword('rotate-me');
    const parts = hash.split('$');
    parts[5] = parts[5].slice(0, -2) + (parts[5].endsWith('AA') ? 'BB' : 'AA');
    assert.equal(verifyScryptPassword('rotate-me', parts.join('$')), false);
  });
});
