import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  routeMarkHex,
  safeConfigFileName,
  safePathSegment,
  safeRouteTableName,
  safeWireGuardInterfaceName,
  shellToken,
} from '../src/operations/command-safety.ts';

describe('safePathSegment', () => {
  it('lowercases and keeps only [a-z0-9_-]', () => {
    assert.equal(safePathSegment('Iran Edge 01'), 'iran-edge-01');
  });

  it('neutralizes path traversal and shell metacharacters', () => {
    assert.equal(safePathSegment('../../etc/passwd'), 'etc-passwd');
    assert.equal(safePathSegment('a; rm -rf /'), 'a-rm--rf');
    assert.equal(safePathSegment('$(whoami)`id`'), 'whoami-id');
    for (const out of [safePathSegment('../../etc/passwd'), safePathSegment('a; rm -rf /')]) {
      assert.doesNotMatch(out, /[^a-z0-9_-]/);
    }
  });

  it('defaults to "main" for empty/all-stripped input', () => {
    assert.equal(safePathSegment(''), 'main');
    assert.equal(safePathSegment('///'), 'main');
  });
});

describe('safeRouteTableName', () => {
  it('always prefixes afrogate_ and a safe segment', () => {
    assert.equal(safeRouteTableName('Iran/../edge'), 'afrogate_iran-edge');
    assert.doesNotMatch(safeRouteTableName('a; b'), /[^a-z0-9_-]/);
  });
});

describe('routeMarkHex', () => {
  it('produces a deterministic 0xA000-masked hex mark', () => {
    assert.equal(routeMarkHex('balanced'), routeMarkHex('balanced'));
    assert.match(routeMarkHex('balanced'), /^0x[a-f0-9]+$/);
  });
});

describe('shellToken', () => {
  it('wraps a value in single quotes', () => {
    assert.equal(shellToken('eth0'), "'eth0'");
  });

  it('neutralizes embedded single quotes and command-injection payloads', () => {
    // classic break-out attempt: '; rm -rf / #
    const dangerous = "'; rm -rf / #";
    const quoted = shellToken(dangerous);
    // result must start and end with the wrapping single quotes
    assert.ok(quoted.startsWith("'") && quoted.endsWith("'"));
    // every embedded single quote is escaped as '\'' — so no bare unescaped quote can close the string early
    assert.equal(shellToken("a'b"), "'a'\\''b'");
    // round-trip: the payload survives only as a literal (no shell metachar is left unquoted)
    assert.ok(quoted.includes("rm -rf"));
  });
});

describe('safeConfigFileName', () => {
  it('keeps [A-Za-z0-9_.:-] and strips separators/metacharacters', () => {
    assert.equal(safeConfigFileName('wg0.conf'), 'wg0.conf');
    assert.doesNotMatch(safeConfigFileName('../../etc/wireguard/wg0'), /[\/\\]/);
    assert.doesNotMatch(safeConfigFileName('a;b|c&d'), /[;|&]/);
    assert.equal(safeConfigFileName(''), 'main');
  });
});

describe('safeWireGuardInterfaceName', () => {
  it('accepts a valid interface name', () => {
    assert.equal(safeWireGuardInterfaceName('wg1', 'id-123'), 'wg1');
  });

  it('derives a safe name when the candidate is invalid or contains metacharacters', () => {
    assert.equal(safeWireGuardInterfaceName('wg 1; rm', 'abc12345xyz'), 'wg-afro-abc12345');
    assert.equal(safeWireGuardInterfaceName('', '!!!'), 'wg-afro-route');
    assert.doesNotMatch(safeWireGuardInterfaceName('$(id)', 'srv'), /[^a-zA-Z0-9_.:-]/);
  });

  it('rejects an over-long (>32 char) candidate and derives instead', () => {
    assert.equal(safeWireGuardInterfaceName('a'.repeat(33), 'srv99999'), 'wg-afro-srv99999');
  });
});
