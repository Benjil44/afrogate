import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePassword, normalizeLoginIdentifier } from '../src/security/generate-password.ts';

test('generatePassword returns a string of the requested length', () => {
  assert.equal(generatePassword(16).length, 16);
  assert.equal(generatePassword(24).length, 24);
});

test('generatePassword uses only the unambiguous alphabet', () => {
  const pw = generatePassword(200);
  assert.match(pw, /^[A-HJ-NP-Za-km-z2-9]+$/); // no 0/O/1/I/l ambiguity
});

test('generatePassword is different each call', () => {
  const a = generatePassword(20);
  const b = generatePassword(20);
  assert.notEqual(a, b);
});

test('generatePassword enforces a sane minimum length', () => {
  assert.ok(generatePassword(4).length >= 12);
});

test('normalizeLoginIdentifier trims and lowercases', () => {
  assert.equal(normalizeLoginIdentifier('  User@Example.COM '), 'user@example.com');
  assert.equal(normalizeLoginIdentifier('ShopBerlin'), 'shopberlin');
});

test('normalizeLoginIdentifier returns null for blank', () => {
  assert.equal(normalizeLoginIdentifier('   '), null);
  assert.equal(normalizeLoginIdentifier(undefined), null);
});
