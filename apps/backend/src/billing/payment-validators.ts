import { BadRequestException } from '@nestjs/common';

const SECRET_LIKE_KEY = /(secret|token|password|private[_-]?key|client[_-]?secret|webhook[_-]?secret|credential)/i;

const ALLOWED_PAYMENT_ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'failed'],
  paid: ['refunded'],
  failed: [],
  refunded: [],
};

/** Guards the payment-order status machine; a no-op move is allowed, anything else must be whitelisted. */
export function assertPaymentOrderStatusTransition(currentStatus: string, nextStatus: string): void {
  if (currentStatus === nextStatus) return;
  if (!ALLOWED_PAYMENT_ORDER_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    throw new BadRequestException(`Payment order cannot move from ${currentStatus} to ${nextStatus}`);
  }
}

/** Ensures a payment method's max amount is not below its min amount. */
export function assertAmountRange(minAmount: number | null, maxAmount: number | null): void {
  if (minAmount !== null && maxAmount !== null && maxAmount < minAmount) {
    throw new BadRequestException('Payment method max amount must be greater than or equal to min amount');
  }
}

/** Recursively rejects secret-like keys before public metadata is persisted/returned. */
export function assertNoSecretLikeKeys(value: unknown, context: string, path = 'metadata'): void {
  if (!value || typeof value !== 'object') return;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_LIKE_KEY.test(key)) {
      throw new BadRequestException(`${context} must not contain secret-like key "${path}.${key}"`);
    }
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      assertNoSecretLikeKeys(nested, context, `${path}.${key}`);
    }
  }
}

/** Serializes a public metadata record after asserting it carries no secret-like keys. */
export function stringifyPublicRecord(value: Record<string, unknown>, context: string): string {
  assertNoSecretLikeKeys(value, context);
  return JSON.stringify(value);
}
