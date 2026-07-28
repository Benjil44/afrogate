import type {
  AdminCustomerAccountSummary,
  AdminResellerAccountSummary,
  AdminResellerGbChargeResponse,
  AdminResellerGbQuote,
  AdminResellerTopupRequest,
  AdminSessionResponse,
  CreateResellerGbChargeRequest,
  ResellerTopupRequestStatus,
} from '@afrows/shared';
import {
  approveResellerTopup as adminApproveResellerTopup,
  createResellerGbCharge,
  createResellerTopupRequest,
  fetchAdminResellerTopups,
  fetchGbPrice as adminFetchGbPrice,
  fetchResellerCustomers as adminFetchResellerCustomers,
  fetchResellerGbQuote,
  fetchResellerTopupReceipt as adminFetchResellerTopupReceipt,
  fetchResellerTopupRequests,
  impersonateReseller as adminImpersonateReseller,
  rejectResellerTopup as adminRejectResellerTopup,
  updateGbPrice as adminUpdateGbPrice,
} from './admin';

/**
 * Reseller per-GB pricing + wallet-topup approval + seller oversight adapter.
 *
 * The backend contract landed in `api/admin.ts` / `packages/shared`, so this
 * module is now a thin passthrough that keeps the page-facing names/shapes
 * stable. Delegates (page-facing name -> real function in `./admin`):
 * - fetchGbPrice / updateGbPrice          -> fetchGbPrice / updateGbPrice
 * - quoteResellerGbSale                   -> fetchResellerGbQuote
 * - createResellerGbSale                  -> createResellerGbCharge
 * - createResellerWalletTopupRequest      -> createResellerTopupRequest
 * - fetchMyResellerWalletTopups           -> fetchResellerTopupRequests
 * - fetchResellerTopups                   -> fetchAdminResellerTopups
 * - approveResellerTopup                  -> approveResellerTopup
 * - rejectResellerTopup                   -> rejectResellerTopup
 * - fetchResellerTopupReceipt             -> fetchResellerTopupReceipt
 * - fetchResellerCustomers                -> fetchResellerCustomers (unwraps .accounts)
 * - impersonateReseller                   -> impersonateReseller (flattens the session token)
 *
 * Pages can migrate to importing `./admin` directly; delete this file once
 * nothing imports it.
 */

/** The single current platform cost per GB (superadmin-managed). */
export interface GbPriceSummary {
  amount: number;
  currency: string;
}

/** Quote for a per-GB seller sale: debit = cost, margin = markup the seller KEEPS. */
export type ResellerGbSaleQuote = AdminResellerGbQuote;

/** A seller card-to-card wallet top-up request (receipt + admin approval). */
export type ResellerWalletTopupRequestSummary = AdminResellerTopupRequest;

export type ResellerTopupStatus = ResellerTopupRequestStatus;

/** Result of "Sign in as seller": a reseller-scoped session (audited server-side). */
export interface ImpersonateResellerResult {
  reseller: AdminResellerAccountSummary;
  session: AdminSessionResponse;
  sessionToken: string;
}

// --- GB price (superadmin) --------------------------------------------------

export async function fetchGbPrice(sessionToken: string, signal?: AbortSignal): Promise<GbPriceSummary> {
  const response = await adminFetchGbPrice(sessionToken, signal);
  return { amount: response.gbPrice, currency: response.currency };
}

export async function updateGbPrice(sessionToken: string, amount: number): Promise<GbPriceSummary> {
  const response = await adminUpdateGbPrice(sessionToken, { gbPrice: amount });
  return { amount: response.gbPrice, currency: response.currency };
}

// --- Per-GB sale quote + sale (reseller session) ----------------------------

export async function quoteResellerGbSale(
  sessionToken: string,
  gb: number,
  signal?: AbortSignal,
): Promise<ResellerGbSaleQuote> {
  const response = await fetchResellerGbQuote(sessionToken, gb, signal);
  return response.quote;
}

export async function createResellerGbSale(
  sessionToken: string,
  payload: CreateResellerGbChargeRequest,
): Promise<AdminResellerGbChargeResponse> {
  return createResellerGbCharge(sessionToken, payload);
}

// --- Seller wallet top-up requests (reseller creates, admin approves) -------

export async function createResellerWalletTopupRequest(
  sessionToken: string,
  payload: { amount: number; note?: string },
  receiptFile: File,
): Promise<ResellerWalletTopupRequestSummary> {
  return createResellerTopupRequest(sessionToken, payload.amount, receiptFile, payload.note);
}

/** The signed-in seller's own top-up requests (newest first). */
export async function fetchMyResellerWalletTopups(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<ResellerWalletTopupRequestSummary[]> {
  return fetchResellerTopupRequests(sessionToken, signal);
}

export async function fetchResellerTopups(
  sessionToken: string,
  status?: ResellerTopupStatus | 'all',
): Promise<ResellerWalletTopupRequestSummary[]> {
  return fetchAdminResellerTopups(sessionToken, status === 'all' ? undefined : status);
}

export async function approveResellerTopup(sessionToken: string, id: string): Promise<ResellerWalletTopupRequestSummary> {
  return adminApproveResellerTopup(sessionToken, id);
}

export async function rejectResellerTopup(
  sessionToken: string,
  id: string,
  reason: string,
): Promise<ResellerWalletTopupRequestSummary> {
  return adminRejectResellerTopup(sessionToken, id, reason);
}

export async function fetchResellerTopupReceipt(sessionToken: string, id: string): Promise<Blob> {
  return adminFetchResellerTopupReceipt(sessionToken, id);
}

// --- Seller oversight (admin) -----------------------------------------------

/** A seller's customer accounts (with used/quota bytes). */
export async function fetchResellerCustomers(
  sessionToken: string,
  resellerId: string,
  signal?: AbortSignal,
): Promise<AdminCustomerAccountSummary[]> {
  const response = await adminFetchResellerCustomers(sessionToken, resellerId, signal);
  return response.accounts;
}

// --- Impersonation ("Sign in as seller"; audited server-side) ---------------

export async function impersonateReseller(sessionToken: string, resellerId: string): Promise<ImpersonateResellerResult> {
  const response = await adminImpersonateReseller(sessionToken, resellerId);
  return {
    reseller: response.reseller,
    session: response.session,
    sessionToken: response.session.sessionToken,
  };
}
