import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ClientSubscriptionEndpointSummary } from '@afrogate/shared';
import {
  endpointHostPort,
  firstCredentialList,
  firstCredentialString,
  firstSafeEndpointNumber,
  parseSubscriptionAddress,
  sanitizeSubscriptionConfigValue,
  scalarCredentialValue,
  subscriptionEndpointTarget,
} from '../src/billing/subscription-sanitizers.ts';

const endpoint = (over: Partial<ClientSubscriptionEndpointSummary>): ClientSubscriptionEndpointSummary =>
  over as ClientSubscriptionEndpointSummary;

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const NUL = String.fromCharCode(0);

describe('sanitizeSubscriptionConfigValue', () => {
  it('trims and returns safe values', () => {
    assert.equal(sanitizeSubscriptionConfigValue('  vmess://abc  ', 220), 'vmess://abc');
  });

  it('rejects empty and over-length values', () => {
    assert.equal(sanitizeSubscriptionConfigValue('   ', 220), null);
    assert.equal(sanitizeSubscriptionConfigValue('a'.repeat(50), 10), null);
  });

  it('rejects CR/LF/NUL injection attempts', () => {
    assert.equal(sanitizeSubscriptionConfigValue(`host${CR}injected`, 220), null);
    assert.equal(sanitizeSubscriptionConfigValue(`host${LF}injected`, 220), null);
    assert.equal(sanitizeSubscriptionConfigValue(`host${NUL}injected`, 220), null);
  });
});

describe('scalarCredentialValue', () => {
  it('stringifies scalars, rejects non-scalars', () => {
    assert.equal(scalarCredentialValue('x'), 'x');
    assert.equal(scalarCredentialValue(42), '42');
    assert.equal(scalarCredentialValue(true), 'true');
    assert.equal(scalarCredentialValue(false), 'false');
    assert.equal(scalarCredentialValue(Number.NaN), null);
    assert.equal(scalarCredentialValue({}), null);
    assert.equal(scalarCredentialValue(null), null);
  });
});

describe('firstCredentialString', () => {
  it('returns the first safe value across records and keys', () => {
    assert.equal(
      firstCredentialString([{ a: '' }, { uuid: '  u-1  ', id: 'x' }], ['uuid', 'id'], 80),
      'u-1',
    );
  });

  it('skips values that fail sanitization and returns null when none match', () => {
    assert.equal(firstCredentialString([{ a: `bad${LF}v` }], ['a'], 80), null);
    assert.equal(firstCredentialString([{}], ['missing'], 80), null);
  });
});

describe('firstCredentialList', () => {
  it('joins array values into a sanitized comma list', () => {
    assert.equal(firstCredentialList([{ dns: ['1.1.1.1', '8.8.8.8'] }], ['dns'], 256), '1.1.1.1, 8.8.8.8');
  });

  it('falls back to scalar values', () => {
    assert.equal(firstCredentialList([{ dns: '1.1.1.1' }], ['dns'], 256), '1.1.1.1');
  });
});

describe('endpointHostPort', () => {
  it('formats host:port, host-only, or null', () => {
    assert.equal(endpointHostPort(endpoint({ host: 'h', port: 443 })), 'h:443');
    assert.equal(endpointHostPort(endpoint({ host: 'h', port: null })), 'h');
    assert.equal(endpointHostPort(endpoint({ host: null })), null);
  });
});

describe('firstSafeEndpointNumber', () => {
  it('returns the first valid port', () => {
    assert.equal(firstSafeEndpointNumber({ p: '443' }, ['p']), 443);
    assert.equal(firstSafeEndpointNumber({ p: '0', q: '8080' }, ['p', 'q']), 8080);
  });

  it('rejects out-of-range / non-integer ports', () => {
    assert.equal(firstSafeEndpointNumber({ p: '70000' }, ['p']), null);
    assert.equal(firstSafeEndpointNumber({ p: 'abc' }, ['p']), null);
  });
});

describe('parseSubscriptionAddress', () => {
  it('parses host:port with a scheme and path', () => {
    assert.deepEqual(parseSubscriptionAddress('https://host.example:8443/path'), { host: 'host.example', port: 8443 });
  });

  it('parses bracketed IPv6 with port', () => {
    assert.deepEqual(parseSubscriptionAddress('[2001:db8::1]:443'), { host: '2001:db8::1', port: 443 });
  });

  it('treats bare hosts and multi-colon hosts without brackets as host-only', () => {
    assert.deepEqual(parseSubscriptionAddress('host.example'), { host: 'host.example', port: null });
    assert.deepEqual(parseSubscriptionAddress('2001:db8::1'), { host: '2001:db8::1', port: null });
  });

  it('returns nulls for empty input', () => {
    assert.deepEqual(parseSubscriptionAddress(null), { host: null, port: null });
  });
});

describe('subscriptionEndpointTarget', () => {
  it('prefers structured host/port and builds an authority', () => {
    assert.deepEqual(subscriptionEndpointTarget(endpoint({ host: 'h', port: 443, address: null })), {
      host: 'h',
      port: 443,
      authority: 'h:443',
    });
  });

  it('falls back to parsing the address', () => {
    assert.deepEqual(subscriptionEndpointTarget(endpoint({ host: null, port: null, address: 'host.example:8443' })), {
      host: 'host.example',
      port: 8443,
      authority: 'host.example:8443',
    });
  });

  it('sanitizes a raw address when no host can be resolved', () => {
    const result = subscriptionEndpointTarget(endpoint({ host: null, port: null, address: `bad${LF}addr` }));
    assert.equal(result.authority, null);
  });
});
