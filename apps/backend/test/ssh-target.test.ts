import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSafeSshHost } from '../src/operations/ssh-target.ts';

describe('isSafeSshHost (protocol server-apply ssh destination)', () => {
  it('accepts hostnames and IP addresses', () => {
    for (const host of ['185.252.30.123', 'de.example.com', '2001:db8::1', 'vps-1']) {
      assert.equal(isSafeSshHost(host), true, host);
    }
  });

  it('rejects option injection via a leading dash', () => {
    for (const host of ['-oProxyCommand=/tmp/x', '-F/tmp/cfg', '-']) {
      assert.equal(isSafeSshHost(host), false, host);
    }
  });

  it('still rejects shell metacharacters, whitespace, empty and over-long values', () => {
    for (const host of ['a b', 'a;b', 'a$b', 'a`b', "a'b", '', 'a'.repeat(254)]) {
      assert.equal(isSafeSshHost(host), false, host);
    }
  });
});
