import { BadRequestException } from '@nestjs/common';

/** Local record reader (kept module-local so this file has no runtime relative imports). */
function recordOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringOf(record: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export interface PayPalWebhookPaymentUpdate {
  nextStatus: string;
  action: string;
  shouldUpdate: boolean;
}

/** Maps a PayPal webhook event onto the local payment-order status, with idempotent no-ops. */
export function payPalWebhookPaymentUpdate(
  existing: { status: string },
  eventType: string | null,
): PayPalWebhookPaymentUpdate {
  if (eventType === 'CHECKOUT.ORDER.APPROVED') {
    return { nextStatus: existing.status, action: 'approval_recorded', shouldUpdate: true };
  }

  if (eventType === 'PAYMENT.CAPTURE.PENDING') {
    return { nextStatus: existing.status, action: 'capture_pending_recorded', shouldUpdate: true };
  }

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    if (existing.status === 'paid') return { nextStatus: existing.status, action: 'already_paid', shouldUpdate: true };
    if (existing.status !== 'pending') {
      return { nextStatus: existing.status, action: `ignored_${existing.status}`, shouldUpdate: false };
    }
    return { nextStatus: 'paid', action: 'marked_paid', shouldUpdate: true };
  }

  if (
    eventType === 'PAYMENT.CAPTURE.DENIED' ||
    eventType === 'PAYMENT.CAPTURE.DECLINED' ||
    eventType === 'PAYMENT.CAPTURE.FAILED'
  ) {
    if (existing.status !== 'pending') {
      return { nextStatus: existing.status, action: `ignored_${existing.status}`, shouldUpdate: false };
    }
    return { nextStatus: 'failed', action: 'marked_failed', shouldUpdate: true };
  }

  if (eventType === 'PAYMENT.CAPTURE.REFUNDED' || eventType === 'PAYMENT.CAPTURE.REVERSED') {
    if (existing.status !== 'paid') {
      return { nextStatus: existing.status, action: `ignored_${existing.status}`, shouldUpdate: false };
    }
    return { nextStatus: 'refunded', action: 'marked_refunded', shouldUpdate: true };
  }

  return { nextStatus: existing.status, action: 'ignored', shouldUpdate: false };
}

/** Ensures a payment order is a PayPal order before running PayPal-specific flows. */
export function assertPayPalPaymentOrder(order: { provider: string }): void {
  if (order.provider !== 'paypal') {
    throw new BadRequestException('Payment order provider must be paypal');
  }
}

/** Resolves the PayPal order id from a webhook resource (related ids first, then the resource id). */
export function extractPayPalWebhookOrderId(
  eventType: string | null,
  resource: Record<string, unknown> | null,
): string | null {
  const supplementary = recordOf(resource?.supplementary_data);
  const relatedIds = recordOf(supplementary?.related_ids);
  const relatedOrderId = stringOf(relatedIds, 'order_id');
  if (relatedOrderId) return relatedOrderId;

  if (eventType?.startsWith('CHECKOUT.ORDER.')) {
    return stringOf(resource, 'id');
  }

  return null;
}

/** Resolves the PayPal capture id from a PAYMENT.CAPTURE.* webhook resource. */
export function extractPayPalWebhookCaptureId(
  eventType: string | null,
  resource: Record<string, unknown> | null,
): string | null {
  if (!eventType?.startsWith('PAYMENT.CAPTURE.')) return null;
  return stringOf(resource, 'id');
}

/** Merges a patch into the `paypal` sub-record of order metadata, dropping undefined patch values. */
export function mergePayPalMetadata(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const current = existing ?? {};
  const currentPayPal = recordOf(current.paypal) ?? {};
  const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));

  return {
    ...current,
    paypal: {
      ...currentPayPal,
      ...cleanPatch,
    },
  };
}
