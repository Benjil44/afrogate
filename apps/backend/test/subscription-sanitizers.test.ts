import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ClientSubscriptionEndpointSummary } from '@afrogate/shared';
import {
  endpointHostPort,
  firstCredentialList,
  firstCredentialString,
  firstSafeEndpointNumber,
  invalidSubscriptionCredential,
  isUuidValue,
  parseSubscriptionAddress,
  renderIkev2ClientProfile,
  renderL2tpClientProfile,
  renderVlessClientUri,
  renderWireGuardClientConfig,
  sanitizeSubscriptionConfigValue,
  scalarCredentialValue,
  subscriptionConfigFormat,
  subscriptionEndpointTarget,
  subscriptionPublicProfile,
  subscriptionSecretMissingFields,
} from '../src/billing/subscription-sanitizers.ts';

const endpoint = (over: Partial<ClientSubscriptionEndpointSummary>): ClientSubscriptionEndpointSummary =>
  over as ClientSubscriptionEndpointSummary;

const outbound = (over: Record<string, unknown>) => over as never;

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

describe('subscriptionConfigFormat / subscriptionSecretMissingFields', () => {
  it('maps protocols to format labels', () => {
    assert.equal(subscriptionConfigFormat('wireguard'), 'wireguard-profile');
    assert.equal(subscriptionConfigFormat('vless'), 'vless-uri');
    assert.equal(subscriptionConfigFormat('l2tp'), 'l2tp-profile');
    assert.equal(subscriptionConfigFormat('ikev2'), 'ikev2-profile');
    assert.equal(subscriptionConfigFormat('other'), 'manual-profile');
  });

  it('lists required secret fields per protocol', () => {
    assert.deepEqual(subscriptionSecretMissingFields('vless'), ['client_uuid']);
    assert.deepEqual(subscriptionSecretMissingFields('wireguard'), [
      'client_private_key',
      'client_public_key',
      'peer_public_key',
    ]);
    assert.deepEqual(subscriptionSecretMissingFields('unknown'), []);
  });
});

describe('isUuidValue', () => {
  it('accepts valid UUIDs and rejects malformed ones', () => {
    assert.equal(isUuidValue('123e4567-e89b-12d3-a456-426614174000'), true);
    assert.equal(isUuidValue('not-a-uuid'), false);
    assert.equal(isUuidValue('123e4567e89b12d3a456426614174000'), false);
  });
});

describe('invalidSubscriptionCredential', () => {
  it('returns a blocked result carrying the missing fields', () => {
    assert.deepEqual(invalidSubscriptionCredential(['client_uuid']), {
      status: 'blocked_secret_invalid',
      missingFields: ['client_uuid'],
      warnings: ['stored_client_secret_material_incomplete'],
    });
  });
});

describe('renderVlessClientUri', () => {
  const ep = endpoint({ host: 'vpn.example', port: 443, transport: 'ws' });

  it('renders a vless URI with params from metadata', () => {
    const result = renderVlessClientUri(
      outbound({ name: 'My Node' }),
      ep,
      { clientUuid: '123e4567-e89b-12d3-a456-426614174000' },
      { security: 'tls', sni: 'vpn.example', path: '/ws' },
    );
    assert.equal(result.status, 'rendered');
    assert.match(result.uri ?? '', /^vless:\/\/123e4567-e89b-12d3-a456-426614174000@vpn\.example:443\?/);
    assert.match(result.uri ?? '', /type=ws/);
    assert.match(result.uri ?? '', /security=tls/);
    assert.match(result.uri ?? '', /#My%20Node$/);
  });

  it('blocks when the uuid is missing or invalid', () => {
    const result = renderVlessClientUri(outbound({ name: 'n' }), ep, { clientUuid: 'bad' }, {});
    assert.equal(result.status, 'blocked_secret_invalid');
    assert.ok(result.missingFields.includes('client_uuid'));
  });

  it('brackets a bare IPv6 host', () => {
    const result = renderVlessClientUri(
      outbound({ name: 'n' }),
      endpoint({ host: '2001:db8::1', port: 443 }),
      { clientUuid: '123e4567-e89b-12d3-a456-426614174000' },
      {},
    );
    assert.match(result.uri ?? '', /@\[2001:db8::1\]:443\?/);
  });
});

describe('renderWireGuardClientConfig', () => {
  it('renders a full interface/peer profile', () => {
    const result = renderWireGuardClientConfig(
      endpoint({ host: 'wg.example', port: 51820 }),
      { clientPrivateKey: 'PRIV', clientAddress: '10.0.0.2/32' },
      { peerPublicKey: 'PUB' },
    );
    assert.equal(result.status, 'rendered');
    assert.match(result.configText ?? '', /\[Interface\]/);
    assert.match(result.configText ?? '', /PrivateKey = PRIV/);
    assert.match(result.configText ?? '', /Endpoint = wg\.example:51820/);
    assert.match(result.configText ?? '', /AllowedIPs = 0\.0\.0\.0\/0, ::\/0/);
  });

  it('rejects secret values carrying CRLF (sanitizer drops them → missing field)', () => {
    const result = renderWireGuardClientConfig(
      endpoint({ host: 'wg.example', port: 51820 }),
      { clientPrivateKey: `PRIV${LF}Endpoint = evil`, clientAddress: '10.0.0.2/32' },
      { peerPublicKey: 'PUB' },
    );
    assert.equal(result.status, 'blocked_secret_invalid');
    assert.ok(result.missingFields.includes('client_private_key'));
  });

  it('reports all missing fields when secret material is empty', () => {
    const result = renderWireGuardClientConfig(endpoint({ host: null, port: null }), {}, {});
    assert.deepEqual(result.missingFields.sort(), [
      'client_address',
      'client_private_key',
      'peer_public_key',
      'public_endpoint',
    ]);
  });
});

describe('renderL2tpClientProfile / renderIkev2ClientProfile', () => {
  it('renders an L2TP profile', () => {
    const result = renderL2tpClientProfile(
      endpoint({ host: 'l2tp.example', port: 1701 }),
      { username: 'u', password: 'p', preSharedKey: 'psk' },
      {},
    );
    assert.equal(result.status, 'rendered');
    assert.match(result.configText ?? '', /Protocol: L2TP\/IPsec/);
    assert.match(result.configText ?? '', /Username: u/);
  });

  it('renders an IKEv2 profile with certificate-only auth', () => {
    const result = renderIkev2ClientProfile(
      endpoint({ host: 'ikev2.example', port: 4500 }),
      { identity: 'id', certificateAlias: 'cert-1' },
      {},
    );
    assert.equal(result.status, 'rendered');
    assert.match(result.configText ?? '', /Protocol: IKEv2/);
    assert.match(result.configText ?? '', /Certificate: cert-1/);
  });

  it('blocks IKEv2 when no auth material is present', () => {
    const result = renderIkev2ClientProfile(endpoint({ host: 'ikev2.example', port: 4500 }), { identity: 'id' }, {});
    assert.equal(result.status, 'blocked_secret_invalid');
    assert.ok(result.missingFields.includes('client_auth_material'));
  });
});

describe('subscriptionPublicProfile', () => {
  it('builds a non-sensitive profile marked secretSafe', () => {
    const profile = subscriptionPublicProfile(
      'vless',
      outbound({ id: 'o1', routeGroup: 'eu', name: 'n' }),
      endpoint({ host: 'h', port: 443, address: null, transport: 'ws', countryCode: 'NL', usageMultiplier: 1 }),
    );
    assert.equal(profile.secretSafe, true);
    assert.equal(profile.protocol, 'vless');
    assert.equal(profile.endpoint, 'h:443');
    assert.equal(profile.countryCode, 'NL');
  });
});
