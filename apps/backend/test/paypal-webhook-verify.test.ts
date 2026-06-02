import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import {
  buildPayPalSignatureVerificationRequest,
  interpretPayPalVerificationResponse,
  requirePayPalWebhookHeader,
  stringProperty,
} from '../src/billing/paypal-webhook-verify.ts';

const headers = {
  authAlgo: 'SHA256withRSA',
  certUrl: 'https://api.paypal.com/cert',
  transmissionId: 'tx-1',
  transmissionSig: 'sig-1',
  transmissionTime: '2026-06-02T00:00:00Z',
};
const event = { id: 'evt-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', extra: 1 };

describe('requirePayPalWebhookHeader', () => {
  it('returns the trimmed header value', () => {
    assert.equal(requirePayPalWebhookHeader('  abc ', 'X'), 'abc');
  });
  it('throws UnauthorizedException for missing/empty headers', () => {
    assert.throws(() => requirePayPalWebhookHeader(undefined, 'PAYPAL-AUTH-ALGO'), UnauthorizedException);
    assert.throws(() => requirePayPalWebhookHeader('   ', 'PAYPAL-CERT-URL'), UnauthorizedException);
  });
});

describe('stringProperty', () => {
  it('extracts trimmed string properties, null otherwise', () => {
    assert.equal(stringProperty({ id: '  x ' }, 'id'), 'x');
    assert.equal(stringProperty({ id: 42 }, 'id'), null);
    assert.equal(stringProperty(null, 'id'), null);
    assert.equal(stringProperty('not-an-object', 'id'), null);
  });
});

describe('buildPayPalSignatureVerificationRequest', () => {
  it('builds the verify-webhook-signature body from headers + webhook id + event', () => {
    const body = buildPayPalSignatureVerificationRequest(headers, 'WH-123', event);
    assert.deepEqual(body, {
      auth_algo: 'SHA256withRSA',
      cert_url: 'https://api.paypal.com/cert',
      transmission_id: 'tx-1',
      transmission_sig: 'sig-1',
      transmission_time: '2026-06-02T00:00:00Z',
      webhook_id: 'WH-123',
      webhook_event: event,
    });
  });

  it('throws when any required signature header is missing', () => {
    assert.throws(
      () => buildPayPalSignatureVerificationRequest({ ...headers, transmissionSig: undefined }, 'WH-123', event),
      UnauthorizedException,
    );
  });
});

describe('interpretPayPalVerificationResponse', () => {
  it('returns event id/type when verification SUCCEEDS', () => {
    assert.deepEqual(interpretPayPalVerificationResponse('SUCCESS', event), {
      eventId: 'evt-1',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
    });
  });

  it('throws UnauthorizedException for any non-SUCCESS status (forgery/tamper)', () => {
    for (const status of ['FAILURE', '', null, undefined, 'success']) {
      assert.throws(() => interpretPayPalVerificationResponse(status, event), UnauthorizedException);
    }
  });

  it('tolerates a verified event missing id/type (returns nulls)', () => {
    assert.deepEqual(interpretPayPalVerificationResponse('SUCCESS', {}), { eventId: null, eventType: null });
  });
});
