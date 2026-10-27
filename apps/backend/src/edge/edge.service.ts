import { Injectable, Logger } from '@nestjs/common';
import type { EdgeDeClient, EdgeUsageDelta } from '@afrows/shared';
import { DatabaseService } from '../database/database.service';
import { applyUsageDelta } from '../client/usage-accounting';
import { provisioningEmail } from '../client/xray-provisioning';
import { ACTIVE_DE_CLIENTS_SQL, type ActiveDeClientRow, normalizeUsageDeltas } from './edge-usage';

/**
 * Ireland half of the edge-sync API. Serves the Germany data-plane agent the
 * set of active client_configs to keep provisioned, and ingests the per-customer
 * usage it reports back for metering (via the shared `applyUsageDelta`, so the
 * accounting is identical to the native Xray metering tick). Validation/clamping
 * lives in the pure `edge-usage` helpers.
 */
@Injectable()
export class EdgeService {
  private readonly logger = new Logger(EdgeService.name);

  constructor(private readonly database: DatabaseService) {}

  /** Every ACTIVE client_config that has an entry_uuid — the Germany agent
   *  reconciles its WS inbound against this list. */
  async listActiveDeClients(): Promise<EdgeDeClient[]> {
    const result = await this.database.query<ActiveDeClientRow>(ACTIVE_DE_CLIENTS_SQL);
    return result.rows.map((row) => ({
      clientConfigId: row.clientConfigId,
      entryUuid: row.entryUuid,
      email: provisioningEmail(row.clientConfigId),
    }));
  }

  /**
   * Applies each reported usage delta additively to `used_bytes` (after
   * validating/clamping via normalizeUsageDeltas). An unknown clientConfigId is
   * a safe no-op (0 rows updated → not counted). Returns how many landed.
   *
   * All-or-nothing: the Germany agent keeps its baseline and re-sends the WHOLE
   * batch after any non-2xx, so a partially applied batch would be counted
   * twice. One transaction makes a failed request apply nothing. Rows are
   * applied in id order so concurrent writers lock accounts in a stable order.
   */
  async applyUsage(deltas: EdgeUsageDelta[]): Promise<number> {
    const normalized = normalizeUsageDeltas(deltas).sort((a, b) =>
      a.clientConfigId < b.clientConfigId ? -1 : a.clientConfigId > b.clientConfigId ? 1 : 0,
    );
    if (normalized.length === 0) return 0;
    const applied = await this.database.transaction(async (executor) => {
      let count = 0;
      for (const delta of normalized) {
        if ((await applyUsageDelta(executor, delta.clientConfigId, delta.bytes)) > 0) count += 1;
      }
      return count;
    });
    if (applied) this.logger.log(`Edge usage applied for ${applied} client(s)`);
    return applied;
  }
}
