import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DatabaseQueryExecutor } from '../database/database.service';

/**
 * Merge a temporary/duplicate customer account (e.g. a bot-minted `Customer-XXXX`)
 * INTO a real account, then archive the source. Cleans up duplicates and the
 * "registered first, connected to the real account later" case.
 *
 * Everything happens in ONE caller-owned transaction. Both account rows are locked
 * FOR UPDATE up front so the balance/quota math is race-free. The source's LIVE
 * assets move to the target and the source is soft-archived (same spirit as
 * customer-account-deletion.ts) — nothing is hard-deleted, so the FK-RESTRICT
 * accounting history (payment_orders, quota_charge_events, rewarded_ad_grants)
 * stays attached to the archived source for audit.
 *
 * What moves:
 *   - Remaining GB: max(0, source.quota_limit_bytes - source.used_bytes) is added
 *     to the target's quota_limit_bytes (decimal-safe, matching quota-math.ts).
 *     A null (unlimited) source contributes nothing; a null (unlimited) target
 *     stays unlimited.
 *   - Gems: source.gems_balance is credited to the target and zeroed on the source,
 *     each as a signed `merge` gems_ledger row (mirrors gems.ts earnGems).
 *   - Configs: source's client_configs are reassigned to the target so the user's
 *     working VLESS/WG keeps working. wireguard_peers follow via client_config_id.
 *   - Telegram + phone: moved to the target only where the target lacks them, then
 *     nulled on the source so the archived source never holds the unique telegram_id.
 *   - Referrals: rows referred_by = source are re-pointed to the target.
 *
 * This module is kept SELF-CONTAINED (no relative value imports; the byte math and
 * the archived-status constant are inlined) so the `node --test` runner can load it
 * directly. The inlined values MUST stay in step with their sources:
 *   - BYTES_PER_GB / computeAllocatedQuotaLimitBytes  ← billing/quota-math.ts
 *   - the +/− ledger row + cached balance write        ← billing/gems.ts (earnGems)
 *   - ARCHIVED_ACCOUNT_STATUS                          ← billing/customer-account-deletion.ts
 */

/** Decimal gigabyte: 1 GB = 1,000,000,000 bytes (NOT the 2^30 binary GiB). */
const BYTES_PER_GB = 1_000_000_000;
const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;

/** Status an archived (merged-away) source is forced into so enforcement cuts it. */
const ARCHIVED_ACCOUNT_STATUS = 'disabled' as const;

/** Gems ledger reason tag for both sides of a merge transfer. */
const MERGE_GEMS_REASON = 'merge' as const;

/**
 * New target quota limit after adding `volumeBytes` of remaining headroom. A null
 * current limit falls back to the used-byte baseline (never retroactively forgiving
 * prior usage). Mirrors quota-math.ts computeAllocatedQuotaLimitBytes.
 */
function computeAllocatedQuotaLimitBytes(
  quotaLimitBeforeBytes: number | null,
  usedBytes: number,
  volumeBytes: number,
): number {
  const after = (quotaLimitBeforeBytes ?? usedBytes) + volumeBytes;
  if (!Number.isSafeInteger(after) || after > MAX_SAFE_BYTES) {
    throw new BadRequestException('Merged quota would exceed the safe byte limit');
  }
  return after;
}

/** Coerce a bigint-as-string/number column to a finite number, else null. */
function toFiniteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Trim to a non-empty string, else null (mirrors the SQL `NULLIF(x, '')`). */
function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? value ?? null : null;
}

/** Keep the target's value when present, else adopt the source's — `COALESCE(NULLIF(target,''), source)`. */
function coalesceNonEmpty(target: string | null | undefined, source: string | null | undefined): string | null {
  return nonEmpty(target) ?? nonEmpty(source);
}

interface MergeAccountRow {
  id: string;
  deletedAt: Date | string | null;
  quotaLimitBytes: string | number | null;
  usedBytes: string | number | null;
  gemsBalance: string | number | null;
  telegramId: string | null;
  telegramUsername: string | null;
  phone: string | null;
}

export interface CustomerAccountMergeOutcome {
  /** Remaining GB moved from source into the target (0 when source unlimited/empty). */
  gbMoved: number;
  /** Remaining bytes moved from source into the target. */
  bytesMoved: number;
  /** Gems credited to the target and zeroed on the source. */
  gemsMoved: number;
  /** client_configs rows reassigned to the target. */
  configsMoved: number;
  /** WireGuard peers that followed the reassigned configs (caller reconciles wg0 if > 0). */
  wgPeersMoved: number;
  /** referred_by rows re-pointed from source to target. */
  referralsRepointed: number;
  /** True when the source had an unlimited (null) quota, so no GB were added. */
  sourceQuotaUnlimited: boolean;
  /** True when the target has an unlimited (null) quota, so it stays unlimited. */
  targetQuotaUnlimited: boolean;
}

/**
 * Merge `sourceId` INTO `targetAccountId` inside a caller-owned transaction. Locks
 * both account rows FOR UPDATE. Validates (both exist, not self-merge, source live)
 * then moves remaining GB, gems, client_configs, telegram/phone and referrals to the
 * target and archives the source. Returns the movement counts the caller needs to
 * decide whether to reconcile wg0 / re-provision. Records one audit event.
 */
export async function mergeCustomerAccountInTransaction(
  executor: DatabaseQueryExecutor,
  sourceId: string,
  targetAccountId: string,
  recordAudit: (metadata: Record<string, unknown>) => Promise<void>,
): Promise<CustomerAccountMergeOutcome> {
  if (sourceId === targetAccountId) {
    throw new BadRequestException('Cannot merge an account into itself');
  }

  // Lock BOTH rows in one statement, ordered by id so concurrent merges acquire the
  // locks in a consistent order (deadlock-free).
  const locked = await executor.query<MergeAccountRow>(
    `SELECT id,
            deleted_at AS "deletedAt",
            quota_limit_bytes AS "quotaLimitBytes",
            used_bytes AS "usedBytes",
            gems_balance AS "gemsBalance",
            telegram_id AS "telegramId",
            telegram_username AS "telegramUsername",
            phone
       FROM customer_accounts
      WHERE id IN ($1, $2)
      ORDER BY id
      FOR UPDATE`,
    [sourceId, targetAccountId],
  );
  const source = locked.rows.find((row) => row.id === sourceId);
  const target = locked.rows.find((row) => row.id === targetAccountId);
  if (!source || !target) throw new NotFoundException('Customer account not found');
  if (source.deletedAt != null) {
    throw new BadRequestException('Source account is already archived');
  }

  // 1. Remaining GB. A null source limit is unlimited → contributes nothing.
  const sourceLimit = toFiniteNumber(source.quotaLimitBytes);
  const sourceUsed = toFiniteNumber(source.usedBytes) ?? 0;
  const targetLimit = toFiniteNumber(target.quotaLimitBytes);
  const targetUsed = toFiniteNumber(target.usedBytes) ?? 0;
  const sourceQuotaUnlimited = sourceLimit === null;
  const targetQuotaUnlimited = targetLimit === null;

  const bytesMoved = sourceQuotaUnlimited ? 0 : Math.max(0, (sourceLimit as number) - sourceUsed);
  // Add remaining headroom to the target unless the target is unlimited (stays unlimited).
  if (bytesMoved > 0 && !targetQuotaUnlimited) {
    const newTargetLimit = computeAllocatedQuotaLimitBytes(targetLimit, targetUsed, bytesMoved);
    await executor.query(
      `UPDATE customer_accounts SET quota_limit_bytes = $2, updated_at = now() WHERE id = $1`,
      [targetAccountId, newTargetLimit],
    );
  }
  const gbMoved = bytesMoved / BYTES_PER_GB;

  // 2. Gems: credit the target, zero the source. Each side is a signed `merge`
  //    ledger row + cached-balance write (mirrors gems.ts earnGems). Source is set
  //    to exactly 0 (we hold the lock; balance == gemsMoved) — respects the >= 0 CHECK.
  const gemsMoved = toFiniteNumber(source.gemsBalance) ?? 0;
  if (gemsMoved > 0) {
    await executor.query(
      `INSERT INTO gems_ledger (customer_account_id, delta, reason, ref) VALUES ($1, $2, $3, $4)`,
      [targetAccountId, gemsMoved, MERGE_GEMS_REASON, sourceId],
    );
    await executor.query(
      `UPDATE customer_accounts SET gems_balance = gems_balance + $2, updated_at = now() WHERE id = $1`,
      [targetAccountId, gemsMoved],
    );
    await executor.query(
      `INSERT INTO gems_ledger (customer_account_id, delta, reason, ref) VALUES ($1, $2, $3, $4)`,
      [sourceId, -gemsMoved, MERGE_GEMS_REASON, targetAccountId],
    );
    await executor.query(
      `UPDATE customer_accounts SET gems_balance = 0, updated_at = now() WHERE id = $1`,
      [sourceId],
    );
  }

  // 3. Configs. Count the source's WireGuard peers BEFORE reassigning (afterwards
  //    they belong to the target), then move every client_config to the target so
  //    the user's working VLESS/WG keeps serving. wireguard_peers follow via
  //    client_config_id (no row change needed).
  const wgPeers = await executor.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count
       FROM wireguard_peers wp
       JOIN client_configs cc ON cc.id = wp.client_config_id
      WHERE cc.customer_account_id = $1`,
    [sourceId],
  );
  const wgPeersMoved = toFiniteNumber(wgPeers.rows[0]?.count) ?? 0;

  const configs = await executor.query(
    `UPDATE client_configs SET customer_account_id = $2, updated_at = now() WHERE customer_account_id = $1`,
    [sourceId, targetAccountId],
  );
  const configsMoved = configs.rowCount ?? 0;

  // 4. Telegram link + phone. Release them on the SOURCE first so the partial unique
  //    index on telegram_id never sees a duplicate, then set the merged values on the
  //    target only where it was lacking them (COALESCE(NULLIF(target,''), source)).
  const mergedTelegramId = coalesceNonEmpty(target.telegramId, source.telegramId);
  const mergedTelegramUsername = coalesceNonEmpty(target.telegramUsername, source.telegramUsername);
  const mergedPhone = coalesceNonEmpty(target.phone, source.phone);
  const identityChanged =
    mergedTelegramId !== nonEmpty(target.telegramId) ||
    mergedTelegramUsername !== nonEmpty(target.telegramUsername) ||
    mergedPhone !== nonEmpty(target.phone);

  await executor.query(
    `UPDATE customer_accounts
        SET telegram_id = NULL, telegram_username = NULL, phone = NULL, updated_at = now()
      WHERE id = $1`,
    [sourceId],
  );
  if (identityChanged) {
    await executor.query(
      `UPDATE customer_accounts
          SET telegram_id = $2, telegram_username = $3, phone = $4, updated_at = now()
        WHERE id = $1`,
      [targetAccountId, mergedTelegramId, mergedTelegramUsername, mergedPhone],
    );
  }

  // 5. Referrals. Re-point everyone the source invited to the target. Exclude the
  //    target itself (if it was referred by the source) so the no-self-referral CHECK
  //    is never violated. The target keeps its own referral_code.
  const referrals = await executor.query(
    `UPDATE customer_accounts SET referred_by = $2, updated_at = now()
      WHERE referred_by = $1 AND id <> $2`,
    [sourceId, targetAccountId],
  );
  const referralsRepointed = referrals.rowCount ?? 0;

  // 6. Archive the source (same spirit as customer-account-deletion.ts): its configs
  //    already moved to the target, so no WireGuard peers remain to mark absent. Just
  //    stamp deleted_at + disable so it drops from the Customers listing and enforcement.
  await executor.query(
    `UPDATE customer_accounts
        SET deleted_at = now(), status = $2, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL`,
    [sourceId, ARCHIVED_ACCOUNT_STATUS],
  );

  await recordAudit({
    sourceId,
    targetAccountId,
    gbMoved,
    gemsMoved,
    configsMoved,
    wgPeersMoved,
    referralsRepointed,
    sourceQuotaUnlimited,
  });

  return {
    gbMoved,
    bytesMoved,
    gemsMoved,
    configsMoved,
    wgPeersMoved,
    referralsRepointed,
    sourceQuotaUnlimited,
    targetQuotaUnlimited,
  };
}
