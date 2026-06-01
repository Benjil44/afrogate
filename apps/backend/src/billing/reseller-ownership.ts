import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DatabaseQueryExecutor } from '../database/database.service';

/**
 * Guards that a customer account belongs to the given reseller before any
 * reseller-scoped read/write. Throws NotFoundException for an unknown account
 * and BadRequestException for a cross-tenant (IDOR) attempt.
 */
export async function ensureCustomerAccountBelongsToReseller(
  executor: DatabaseQueryExecutor,
  customerAccountId: string,
  resellerAccountId: string,
): Promise<void> {
  const result = await executor.query<{ resellerAccountId: string | null }>(
    'SELECT reseller_account_id AS "resellerAccountId" FROM customer_accounts WHERE id = $1 FOR SHARE',
    [customerAccountId],
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundException('Customer account not found');
  if (row.resellerAccountId !== resellerAccountId) {
    throw new BadRequestException('Customer account does not belong to this reseller');
  }
}

/**
 * Guards that a client config belongs to the given reseller (and, when
 * provided, to the selected customer account). Throws NotFoundException for an
 * unknown config and BadRequestException for a cross-tenant (IDOR) attempt.
 */
export async function ensureClientConfigBelongsToReseller(
  executor: DatabaseQueryExecutor,
  clientConfigId: string,
  resellerAccountId: string,
  customerAccountId: string | null,
): Promise<void> {
  const result = await executor.query<{ customerAccountId: string; resellerAccountId: string | null }>(
    `
        SELECT
          cc.customer_account_id AS "customerAccountId",
          ca.reseller_account_id AS "resellerAccountId"
        FROM client_configs cc
        JOIN customer_accounts ca ON ca.id = cc.customer_account_id
        WHERE cc.id = $1
        FOR SHARE OF cc, ca
      `,
    [clientConfigId],
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundException('Client config not found');
  if (customerAccountId && row.customerAccountId !== customerAccountId) {
    throw new BadRequestException('Client config does not belong to the selected customer account');
  }
  if (row.resellerAccountId !== resellerAccountId) {
    throw new BadRequestException('Client config does not belong to this reseller');
  }
}
