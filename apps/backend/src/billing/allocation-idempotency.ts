import { ConflictException } from '@nestjs/common';

/** The idempotency key for an allocation: the caller-supplied key (trimmed), else `payment_order:<id>`. */
export function resolveAllocationIdempotencyKey(dtoKey: string | null | undefined, orderId: string): string {
  const trimmed = typeof dtoKey === 'string' ? dtoKey.trim() : '';
  return trimmed || `payment_order:${orderId}`;
}

export interface ExistingAllocationDecision<T> {
  allocation: T;
  customerAccountId: string;
  duplicate: true;
}

/**
 * Decides whether a paid order has already been allocated, guaranteeing no
 * double-credit:
 *  - an allocation already on this order  -> return it (duplicate)
 *  - an allocation under the same idempotency key but a DIFFERENT order -> ConflictException
 *  - an allocation under the key for this order -> return it (duplicate)
 *  - otherwise -> null (caller proceeds to allocate)
 */
export function resolveExistingAllocation<T extends { paymentOrderId: string; customerAccountId: string }>(
  existingForOrder: T | null,
  existingForKey: T | null,
  orderId: string,
): ExistingAllocationDecision<T> | null {
  if (existingForOrder) {
    return { allocation: existingForOrder, customerAccountId: existingForOrder.customerAccountId, duplicate: true };
  }

  if (existingForKey) {
    if (existingForKey.paymentOrderId !== orderId) {
      throw new ConflictException('Payment order allocation idempotency key already belongs to another order');
    }
    return { allocation: existingForKey, customerAccountId: existingForKey.customerAccountId, duplicate: true };
  }

  return null;
}
