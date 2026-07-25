import type {
  AdminCustomerAccountSummary,
  AdminTelegramBotSettingsSummary,
  UpdateTelegramBotSettingsRequest,
} from '@afrows/shared';
import * as adminApi from './admin';
import { getApiBaseUrl } from './base';

/**
 * afroWS bot v2 (referrals + gems) dashboard adapter.
 *
 * The backend is landing these EXACT contracts in `packages/shared` /
 * `api/admin.ts` (which the backend owns):
 * - customer summary/detail: `phone`, `gemsBalance`, `referralCode`, `referralCount`
 * - `adjustCustomerGems(sessionToken, customerAccountId, delta, reason)`
 * - telegram settings: `gemRedeemPerGb`, `gemReferralSignup`,
 *   `gemReferralPurchasePct`, `gemMilestoneEvery`, `gemMilestoneBonus`
 *
 * Until they land, this module types the documented shape locally and, for the
 * gems-adjust call, delegates to `adminApi.adjustCustomerGems` as soon as it
 * exists (falling back to the documented REST route meanwhile). Once the shared
 * types carry the fields, the intersection casts below become no-ops — delete
 * this file and import straight from `./admin` at that point.
 */

/** v2 fields on a customer account (optional until `@afrows/shared` lands them). */
export interface CustomerGemFields {
  /** Phone collected by the bot at signup (stored in clear, admin-visible). */
  phone?: string | null;
  /** Gems wallet balance (100 gems = 1 GB at the default economy). */
  gemsBalance?: number;
  /** Short invite code behind t.me/…?start=<code>. */
  referralCode?: string | null;
  /** Completed referrals attributed to this account. */
  referralCount?: number;
}

/** Read the v2 fields off an account summary without widening call sites. */
export const customerGemFields = (account: AdminCustomerAccountSummary): CustomerGemFields =>
  account as AdminCustomerAccountSummary & CustomerGemFields;

/** Gem-economy knobs on the Telegram bot settings (numbers; admin-configurable). */
export interface TelegramGemEconomyFields {
  /** Gems needed to redeem 1 GB (default 100). */
  gemRedeemPerGb?: number | null;
  /** Gems the inviter earns when a referred user completes registration (default 50). */
  gemReferralSignup?: number | null;
  /** Percent of a referred user's purchased GB paid to the inviter in gems (default 20). */
  gemReferralPurchasePct?: number | null;
  /** A milestone bonus lands after every N completed referrals (default 10). */
  gemMilestoneEvery?: number | null;
  /** Gems granted at each milestone (default 300). */
  gemMilestoneBonus?: number | null;
}

/** Read the gem-economy fields off the bot settings summary. */
export const telegramGemEconomy = (settings: AdminTelegramBotSettingsSummary): TelegramGemEconomyFields =>
  settings as AdminTelegramBotSettingsSummary & TelegramGemEconomyFields;

/** PATCH payload for the telegram settings including the gem-economy fields. */
export type UpdateTelegramBotSettingsWithGems = UpdateTelegramBotSettingsRequest & TelegramGemEconomyFields;

export interface AdjustCustomerGemsResponse {
  gemsBalance: number;
}

type AdjustCustomerGemsFn = (
  sessionToken: string,
  customerAccountId: string,
  delta: number,
  reason: string,
) => Promise<AdjustCustomerGemsResponse>;

/**
 * Credit/debit a customer's gems wallet (audited with a reason).
 * Delegates to the backend-owned `adminApi.adjustCustomerGems` once it lands;
 * until then, calls the documented route directly.
 */
export async function adjustCustomerGems(
  sessionToken: string,
  customerAccountId: string,
  delta: number,
  reason: string,
): Promise<AdjustCustomerGemsResponse> {
  const landed = (adminApi as unknown as Record<string, unknown>).adjustCustomerGems;
  if (typeof landed === 'function') {
    return (landed as AdjustCustomerGemsFn)(sessionToken, customerAccountId, delta, reason);
  }
  const response = await fetch(
    `${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(customerAccountId)}/gems`,
    {
      body: JSON.stringify({ delta, reason }),
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
  if (!response.ok) throw new Error(`adjust_gems_failed_${response.status}`);
  return response.json() as Promise<AdjustCustomerGemsResponse>;
}
