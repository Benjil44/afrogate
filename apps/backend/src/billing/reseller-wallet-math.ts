import { BadRequestException } from '@nestjs/common';

export const BASIS_POINTS = 10000;
export const DEFAULT_RESELLER_MARGIN_BPS = 2500;
export const MAX_RESELLER_MARGIN_BPS = 8000;

/**
 * Validates and resolves a reseller seller-margin in basis points. Throws
 * BadRequestException for non-integer, negative, or out-of-range values.
 */
export function normalizeResellerMarginBps(value: number | null | undefined, fallback: number): number {
  const normalized = value ?? fallback;
  if (!Number.isInteger(normalized) || normalized < 0 || normalized > MAX_RESELLER_MARGIN_BPS) {
    throw new BadRequestException('Reseller seller margin must be an integer between 0 and 8000 basis points');
  }
  return normalized;
}

/** AfroGate's share in basis points; never negative even if margin exceeds 100%. */
export function afroGateShareBps(sellerMarginBps: number): number {
  return Math.max(BASIS_POINTS - sellerMarginBps, 0);
}

export interface ResellerSaleAmounts {
  sellerMarginAmount: number;
  walletDebitAmount: number;
}

/**
 * Splits a customer package price into the reseller's seller margin and the
 * amount debited from the reseller wallet (AfroGate's share). The wallet debit
 * never goes below zero.
 */
export function computeResellerSaleAmounts(customerPriceAmount: number, sellerMarginBps: number): ResellerSaleAmounts {
  const sellerMarginAmount = Math.round((customerPriceAmount * sellerMarginBps) / BASIS_POINTS);
  const walletDebitAmount = Math.max(customerPriceAmount - sellerMarginAmount, 0);
  return { sellerMarginAmount, walletDebitAmount };
}

/** A reseller can absorb a debit while its post-debit balance stays within the allowed credit limit. */
export function walletCanCoverDebit(balanceAfterAmount: number, creditLimitAmount: number): boolean {
  return balanceAfterAmount + creditLimitAmount >= 0;
}
