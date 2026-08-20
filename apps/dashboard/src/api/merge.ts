import type { AdminCustomerAccountDetail } from '@afrows/shared';
import * as adminApi from './admin';
import { getApiBaseUrl } from './base';

/**
 * Customer account merge (duplicate -> real account) dashboard adapter.
 *
 * The backend is landing this EXACT contract in `api/admin.ts` (which the
 * backend owns):
 * - `mergeCustomerAccount(sessionToken, sourceAccountId, targetAccountId)`
 *   -> `POST /admin/customer-accounts/:sourceId/merge` body `{ targetAccountId }`
 *
 * The SOURCE is the account being merged away (its remaining GB, gems, and
 * configs move to the target, then it is archived); the TARGET is the real
 * account that receives everything.
 *
 * Until it lands, this module types the documented shape locally and delegates
 * to `adminApi.mergeCustomerAccount` as soon as it exists (falling back to the
 * documented REST route meanwhile). Once `admin.ts` carries the function this
 * file becomes a pass-through — delete it and import straight from `./admin`.
 */

type MergeCustomerAccountFn = (
  sessionToken: string,
  sourceAccountId: string,
  targetAccountId: string,
) => Promise<AdminCustomerAccountDetail>;

export async function mergeCustomerAccount(
  sessionToken: string,
  sourceAccountId: string,
  targetAccountId: string,
): Promise<AdminCustomerAccountDetail> {
  const landed = (adminApi as unknown as Record<string, unknown>).mergeCustomerAccount;
  if (typeof landed === 'function') {
    return (landed as MergeCustomerAccountFn)(sessionToken, sourceAccountId, targetAccountId);
  }
  const response = await fetch(
    `${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(sourceAccountId)}/merge`,
    {
      body: JSON.stringify({ targetAccountId }),
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
  if (!response.ok) throw new Error(`merge_account_failed_${response.status}`);
  return response.json() as Promise<AdminCustomerAccountDetail>;
}
