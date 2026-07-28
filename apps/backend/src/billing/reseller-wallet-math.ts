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

/** Afrows's share in basis points; never negative even if margin exceeds 100%. */
export function afrowsShareBps(sellerMarginBps: number): number {
  return Math.max(BASIS_POINTS - sellerMarginBps, 0);
}

export interface ResellerSaleAmounts {
  /** The platform's cost for this sale (= GB × currentGbPrice). Equals the wallet debit. */
  costAmount: number;
  /** The markup the reseller KEEPS as cash (cost × marginBps). Informational — never debited. */
  sellerMarginAmount: number;
  /** What the reseller charges their own customer (cost + kept markup). */
  resellerSellPrice: number;
  /** The amount debited from the reseller wallet. In the cost-based model this equals the cost. */
  walletDebitAmount: number;
}

/**
 * Margin = markup on COST (cost-based model, locked 2026-07-27).
 *
 * The reseller wallet is debited the platform's COST for the sale. On top of that
 * cost the reseller adds their margin as a markup they keep as cash — the platform
 * never takes the markup. So for a cost `C` and margin `m` bps:
 *   walletDebit      = C            (the reseller pays the cost)
 *   sellerMargin     = round(C·m)   (the markup the reseller keeps, NOT debited)
 *   resellerSellPrice = C + margin  (what the reseller charges their customer)
 *
 * This is the FLIP of the previous share-based model (which debited `price − margin`).
 * Costs are clamped to a non-negative integer (no fractional currency, no negatives).
 */
export function computeResellerSaleAmounts(costAmount: number, sellerMarginBps: number): ResellerSaleAmounts {
  const cost = Math.max(Math.round(costAmount), 0);
  const sellerMarginAmount = Math.round((cost * sellerMarginBps) / BASIS_POINTS);
  return {
    costAmount: cost,
    sellerMarginAmount,
    resellerSellPrice: cost + sellerMarginAmount,
    walletDebitAmount: cost,
  };
}

/**
 * The platform COST of granting `gb` decimal gigabytes at the current per-GB
 * price, rounded to a whole currency unit. This is the amount the reseller wallet
 * is debited for a per-GB sale. Both inputs must be finite; `gb` must be positive
 * and `gbPrice` non-negative.
 */
export function computeResellerGbCost(gb: number, gbPrice: number): number {
  if (!Number.isFinite(gb) || gb <= 0) {
    throw new BadRequestException('GB amount must be a positive number');
  }
  if (!Number.isFinite(gbPrice) || gbPrice < 0) {
    throw new BadRequestException('GB price must be a non-negative number');
  }
  return Math.round(gb * gbPrice);
}

/** A reseller can absorb a debit while its post-debit balance stays within the allowed credit limit. */
export function walletCanCoverDebit(balanceAfterAmount: number, creditLimitAmount: number): boolean {
  return balanceAfterAmount + creditLimitAmount >= 0;
}
