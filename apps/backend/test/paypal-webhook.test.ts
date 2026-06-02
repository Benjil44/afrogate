import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  assertPayPalPaymentOrder,
  extractPayPalWebhookCaptureId,
  extractPayPalWebhookOrderId,
  mergePayPalMetadata,
  payPalWebhookPaymentUpdate,
} from '../src/billing/paypal-webhook.ts';

describe('payPalWebhookPaymentUpdate', () => {
  it('records approval and pending capture without changing status', () => {
    assert.deepEqual(payPalWebhookPaymentUpdate({ status: 'pending' }, 'CHECKOUT.ORDER.APPROVED'), {
      nextStatus: 'pending',
      action: 'approval_recorded',
      shouldUpdate: true,
    });
    assert.deepEqual(payPalWebhookPaymentUpdate({ status: 'pending' }, 'PAYMENT.CAPTURE.PENDING'), {
      nextStatus: 'pending',
      action: 'capture_pending_recorded',
      shouldUpdate: true,
    });
  });

  it('marks a pending order paid on capture completed', () => {
    assert.deepEqual(payPalWebhookPaymentUpdate({ status: 'pending' }, 'PAYMENT.CAPTURE.COMPLETED'), {
      nextStatus: 'paid',
      action: 'marked_paid',
      shouldUpdate: true,
    });
  });

  it('is idempotent when capture completes on an already-paid order', () => {
    assert.deepEqual(payPalWebhookPaymentUpdate({ status: 'paid' }, 'PAYMENT.CAPTURE.COMPLETED'), {
      nextStatus: 'paid',
      action: 'already_paid',
      shouldUpdate: true,
    });
  });

  it('ignores capture completed for non-pending/non-paid states', () => {
    assert.deepEqual(payPalWebhookPaymentUpdate({ status: 'refunded' }, 'PAYMENT.CAPTURE.COMPLETED'), {
      nextStatus: 'refunded',
      action: 'ignored_refunded',
      shouldUpdate: false,
    });
  });

  it('marks a pending order failed on denied/declined/failed captures', () => {
    for (const eventType of ['PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.DECLINED', 'PAYMENT.CAPTURE.FAILED']) {
      assert.deepEqual(payPalWebhookPaymentUpdate({ status: 'pending' }, eventType), {
        nextStatus: 'failed',
        action: 'marked_failed',
        shouldUpdate: true,
      });
    }
  });

  it('does not fail a non-pending order', () => {
    assert.deepEqual(payPalWebhookPaymentUpdate({ status: 'paid' }, 'PAYMENT.CAPTURE.FAILED'), {
      nextStatus: 'paid',
      action: 'ignored_paid',
      shouldUpdate: false,
    });
  });

  it('refunds only a paid order on refunded/reversed', () => {
    for (const eventType of ['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED']) {
      assert.deepEqual(payPalWebhookPaymentUpdate({ status: 'paid' }, eventType), {
        nextStatus: 'refunded',
        action: 'marked_refunded',
        shouldUpdate: true,
      });
      assert.equal(payPalWebhookPaymentUpdate({ status: 'pending' }, eventType).shouldUpdate, false);
    }
  });

  it('ignores unknown or null event types', () => {
    assert.deepEqual(payPalWebhookPaymentUpdate({ status: 'pending' }, 'SOMETHING.ELSE'), {
      nextStatus: 'pending',
      action: 'ignored',
      shouldUpdate: false,
    });
    assert.equal(payPalWebhookPaymentUpdate({ status: 'pending' }, null).action, 'ignored');
  });
});

describe('assertPayPalPaymentOrder', () => {
  it('passes for a paypal order and rejects others', () => {
    assert.doesNotThrow(() => assertPayPalPaymentOrder({ provider: 'paypal' }));
    assert.throws(() => assertPayPalPaymentOrder({ provider: 'card' }), BadRequestException);
  });
});

describe('extractPayPalWebhookOrderId', () => {
  it('prefers the related order id from supplementary data', () => {
    const resource = { supplementary_data: { related_ids: { order_id: '  ORD-1  ' } }, id: 'CAP-9' };
    assert.equal(extractPayPalWebhookOrderId('PAYMENT.CAPTURE.COMPLETED', resource), 'ORD-1');
  });

  it('falls back to the resource id for CHECKOUT.ORDER events', () => {
    assert.equal(extractPayPalWebhookOrderId('CHECKOUT.ORDER.APPROVED', { id: 'ORD-2' }), 'ORD-2');
  });

  it('returns null when no order id is resolvable', () => {
    assert.equal(extractPayPalWebhookOrderId('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-9' }), null);
    assert.equal(extractPayPalWebhookOrderId(null, null), null);
  });
});

describe('extractPayPalWebhookCaptureId', () => {
  it('returns the resource id only for PAYMENT.CAPTURE events', () => {
    assert.equal(extractPayPalWebhookCaptureId('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-1' }), 'CAP-1');
    assert.equal(extractPayPalWebhookCaptureId('CHECKOUT.ORDER.APPROVED', { id: 'ORD-1' }), null);
    assert.equal(extractPayPalWebhookCaptureId('PAYMENT.CAPTURE.COMPLETED', {}), null);
  });
});

describe('mergePayPalMetadata', () => {
  it('merges the patch into the paypal sub-record, preserving other keys', () => {
    const merged = mergePayPalMetadata({ other: 1, paypal: { a: 1 } }, { b: 2 });
    assert.deepEqual(merged, { other: 1, paypal: { a: 1, b: 2 } });
  });

  it('drops undefined patch values and tolerates missing existing metadata', () => {
    const merged = mergePayPalMetadata(null, { a: 1, skip: undefined });
    assert.deepEqual(merged, { paypal: { a: 1 } });
  });
});
