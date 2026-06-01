import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import {
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  canonicalJson,
  clampToleranceSeconds,
  computeRewardedAdSignature,
  isTimestampFresh,
  normalizeHexSignature,
  secureHexCompare,
} from '../src/billing/rewarded-ad-webhook.crypto.ts';

describe('canonicalJson', () => {
  it('is independent of object key order', () => {
    assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  });

  it('drops undefined values and sorts nested keys', () => {
    assert.equal(canonicalJson({ z: undefined, a: { y: 1, x: 2 } }), '{"a":{"x":2,"y":1}}');
  });
});

describe('computeRewardedAdSignature', () => {
  it('is deterministic for the same secret/timestamp/payload', () => {
    const a = computeRewardedAdSignature('secret', '2026-06-02T00:00:00Z', '{"x":1}');
    const b = computeRewardedAdSignature('secret', '2026-06-02T00:00:00Z', '{"x":1}');
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
  });

  it('changes with secret, timestamp, or payload', () => {
    const base = computeRewardedAdSignature('secret', 't', 'p');
    assert.notEqual(base, computeRewardedAdSignature('other', 't', 'p'));
    assert.notEqual(base, computeRewardedAdSignature('secret', 't2', 'p'));
    assert.notEqual(base, computeRewardedAdSignature('secret', 't', 'p2'));
  });
});

describe('normalizeHexSignature', () => {
  const valid = 'a'.repeat(64);
  it('accepts a 64-char hex signature and lowercases it', () => {
    assert.equal(normalizeHexSignature('A'.repeat(64)), valid);
  });
  it('strips an optional sha256= prefix', () => {
    assert.equal(normalizeHexSignature(`sha256=${valid}`), valid);
  });
  it('throws on missing, short, or non-hex signatures', () => {
    assert.throws(() => normalizeHexSignature(undefined), UnauthorizedException);
    assert.throws(() => normalizeHexSignature('abc'), UnauthorizedException);
    assert.throws(() => normalizeHexSignature('z'.repeat(64)), UnauthorizedException);
  });
});

describe('secureHexCompare', () => {
  it('matches equal hex and rejects differing/short hex', () => {
    assert.equal(secureHexCompare('a'.repeat(64), 'a'.repeat(64)), true);
    assert.equal(secureHexCompare('a'.repeat(64), 'b'.repeat(64)), false);
    assert.equal(secureHexCompare('aa', 'aabb'), false);
  });
});

describe('clampToleranceSeconds', () => {
  it('defaults on invalid input', () => {
    assert.equal(clampToleranceSeconds(undefined), DEFAULT_WEBHOOK_TOLERANCE_SECONDS);
    assert.equal(clampToleranceSeconds('not-a-number'), DEFAULT_WEBHOOK_TOLERANCE_SECONDS);
  });
  it('clamps to the [30, 3600] window', () => {
    assert.equal(clampToleranceSeconds('5'), 30);
    assert.equal(clampToleranceSeconds('99999'), 3600);
    assert.equal(clampToleranceSeconds('600'), 600);
  });
});

describe('isTimestampFresh', () => {
  const now = Date.parse('2026-06-02T12:00:00Z');
  it('accepts a timestamp within tolerance', () => {
    assert.equal(isTimestampFresh('2026-06-02T11:59:00Z', 300, now), true);
  });
  it('rejects a stale (replayed) timestamp', () => {
    assert.equal(isTimestampFresh('2026-06-02T11:00:00Z', 300, now), false);
  });
  it('rejects an invalid timestamp', () => {
    assert.equal(isTimestampFresh('not-a-date', 300, now), false);
  });
});

describe('end-to-end webhook forgery resistance', () => {
  const secret = 'webhook-secret';
  const timestamp = '2026-06-02T12:00:00Z';
  const payload = { clientConfigId: 'cc-1', adSessionId: 's1', rewardAmount: 5 };

  it('a correctly-signed payload matches; tampering or wrong secret does not', () => {
    const signature = computeRewardedAdSignature(secret, timestamp, canonicalJson(payload));

    // legitimate
    assert.equal(secureHexCompare(signature, computeRewardedAdSignature(secret, timestamp, canonicalJson(payload))), true);

    // attacker tampers the payload (e.g. bumps rewardAmount) -> signature no longer matches
    const tampered = { ...payload, rewardAmount: 9999 };
    assert.equal(secureHexCompare(signature, computeRewardedAdSignature(secret, timestamp, canonicalJson(tampered))), false);

    // attacker without the secret cannot forge
    assert.equal(secureHexCompare(signature, computeRewardedAdSignature('guessed-secret', timestamp, canonicalJson(payload))), false);
  });
});
