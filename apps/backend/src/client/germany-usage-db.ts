/**
 * DB-touching helpers for the remote-exit (Germany, USA) usage meter, kept decorator-free and
 * executor-based (like usage-accounting.ts / edge-usage.ts) so the `node --test`
 * type-stripping runner can exercise the SQL-shaping, idempotency, and
 * baseline-advance decisions against a fake executor. The @Injectable service is
 * a thin wrapper that opens the transaction and schedules the tick.
 */
import type { DatabaseQueryExecutor } from '../database/database.service';
import type { ClientUsageSeriesPoint, ClientUsageSeriesWindow } from '@afrows/shared';
import type { DeUserCumulative } from './germany-usage';

/**
 * One remote exit's ledger identity. `source` tags the append-only event, so the
 * (source, idempotency_key) unique index keeps the two sites' identical
 * `<clientConfigId>:<cumulative>` keys from ever colliding; each site keeps its
 * own cumulative high-water-mark in its own baseline table (their counters are
 * independent). Closed literal unions: these are interpolated as SQL
 * identifiers/literals and must never come from input.
 */
export interface RemoteUsageSite {
  source: 'germany-xray' | 'usa-xray';
  createdBy: 'germany-usage-meter' | 'usa-usage-meter';
  baselineTable: 'client_usage_de_baseline' | 'client_usage_us_baseline';
}

export const DE_USAGE_SITE: RemoteUsageSite = {
  source: 'germany-xray',
  createdBy: 'germany-usage-meter',
  baselineTable: 'client_usage_de_baseline',
};

export const US_USAGE_SITE: RemoteUsageSite = {
  source: 'usa-xray',
  createdBy: 'usa-usage-meter',
  baselineTable: 'client_usage_us_baseline',
};

export interface DeBaselineRow {
  clientConfigId: string;
  cumulativeBytes: number;
  observedAt: string;
}

/**
 * The shared pieces this module composes, injected rather than imported so the
 * module has zero relative runtime imports and stays loadable by the `node --test`
 * strip-types runner. The service wires the REAL `computeUsageDelta` +
 * `applyUsageDelta`, so Germany-path accounting is byte-for-byte identical to the
 * local Xray path.
 */
export interface DeUsageDeps {
  computeDelta(current: number, baseline: number | null | undefined): number;
  applyDelta(ex: DatabaseQueryExecutor, clientConfigId: string, bytes: number): Promise<number>;
}

/** Load every last-seen Germany cumulative baseline into a map keyed by client_config id. */
export function loadDeBaselines(db: DatabaseQueryExecutor): Promise<Map<string, DeBaselineRow>> {
  return loadRemoteBaselines(db, DE_USAGE_SITE);
}

/** Load one site's last-seen cumulative baselines, keyed by client_config id. */
export async function loadRemoteBaselines(
  db: DatabaseQueryExecutor,
  site: RemoteUsageSite,
): Promise<Map<string, DeBaselineRow>> {
  const result = await db.query<DeBaselineRow>(
    `SELECT client_config_id AS "clientConfigId",
            cumulative_bytes AS "cumulativeBytes",
            observed_at AS "observedAt"
     FROM ${site.baselineTable}`,
  );
  // cumulative_bytes is a bigint → node-postgres hands it back as a STRING. Coerce
  // to a real number here so every consumer (computeUsageDelta) subtracts a number,
  // not a string that isFinite() rejects → treats-as-0 → over-counts (see
  // computeUsageDelta). computeUsageDelta also coerces defensively; this keeps the
  // map's typed contract honest.
  return new Map(
    result.rows.map((row) => [
      row.clientConfigId,
      { ...row, cumulativeBytes: Number(row.cumulativeBytes) },
    ]),
  );
}

/**
 * Apply one user's cumulative snapshot. MUST run inside a transaction (pass the
 * transaction executor): append-only event -> shared used_bytes write ->
 * hourly/daily rollups -> baseline advance (LAST, so a rollback un-advances it and
 * the delta retries next tick — no loss, no double count). Returns the applied
 * positive delta, or 0 when skipped (unknown client / no new bytes / already
 * recorded). An unknown client creates NO baseline row so it catches up from 0
 * once it appears in Postgres.
 */
export function applyDeUserUsage(
  ex: DatabaseQueryExecutor,
  user: DeUserCumulative,
  baseline: DeBaselineRow | undefined,
  observedAtIso: string,
  deps: DeUsageDeps,
): Promise<number> {
  return applyRemoteUserUsage(ex, user, baseline, observedAtIso, deps, DE_USAGE_SITE);
}

/** Site-generic body of `applyDeUserUsage` (same contract; see above). */
export async function applyRemoteUserUsage(
  ex: DatabaseQueryExecutor,
  user: DeUserCumulative,
  baseline: DeBaselineRow | undefined,
  observedAtIso: string,
  deps: DeUsageDeps,
  site: RemoteUsageSite,
): Promise<number> {
  const acct = await ex.query<{ customerAccountId: string }>(
    `SELECT customer_account_id AS "customerAccountId" FROM client_configs WHERE id = $1`,
    [user.clientConfigId],
  );
  const customerAccountId = acct.rows[0]?.customerAccountId;
  if (!customerAccountId) return 0;

  const delta = deps.computeDelta(user.cumulativeBytes, baseline?.cumulativeBytes);
  if (delta <= 0) {
    await upsertRemoteBaseline(ex, site, user, customerAccountId, observedAtIso);
    return 0;
  }

  const windowStart = baseline?.observedAt ?? null;
  const inserted = await ex.query(
    `INSERT INTO client_usage_events
       (customer_account_id, client_config_id, source, direction, used_bytes_delta, raw_used_bytes_delta, usage_multiplier,
        observed_at, window_start, window_end, idempotency_key, metadata, created_by)
     VALUES ($1, $2,
             '${site.source}',
             'combined', $3, $3, 1, $4::timestamptz, $5, $4::timestamptz, $6, '{}'::jsonb,
             '${site.createdBy}')
     ON CONFLICT (source, idempotency_key)
       WHERE idempotency_key IS NOT NULL AND idempotency_key <> ''
       DO NOTHING
     RETURNING id`,
    [
      customerAccountId,
      user.clientConfigId,
      delta,
      observedAtIso,
      windowStart,
      `${user.clientConfigId}:${user.cumulativeBytes}`,
    ],
  );
  if ((inserted.rowCount ?? 0) === 0) {
    // this exact cumulative was already recorded (race) — advance baseline, no double count
    await upsertRemoteBaseline(ex, site, user, customerAccountId, observedAtIso);
    return 0;
  }

  await deps.applyDelta(ex, user.clientConfigId, delta);
  // ON CONFLICT adds the delta into the existing bucket, so re-applying accumulates
  // rather than overwrites (idempotent per-delta via the event key above; additive
  // per-bucket here). Literal SQL per table/unit — no identifier interpolation.
  const rollupValues = [user.clientConfigId, customerAccountId, delta, observedAtIso];
  await ex.query(
    `INSERT INTO client_usage_hourly
       (client_config_id, customer_account_id, bucket_start, used_bytes, rx_bytes, tx_bytes, source, updated_at)
     VALUES ($1, $2, date_trunc('hour', $4::timestamptz), $3, 0, 0,
             '${site.source}', now())
     ON CONFLICT (client_config_id, bucket_start) DO UPDATE SET
       used_bytes = client_usage_hourly.used_bytes + excluded.used_bytes,
       customer_account_id = excluded.customer_account_id,
       updated_at = now()`,
    rollupValues,
  );
  await ex.query(
    `INSERT INTO client_usage_daily
       (client_config_id, customer_account_id, bucket_start, used_bytes, rx_bytes, tx_bytes, source, updated_at)
     VALUES ($1, $2, date_trunc('day', $4::timestamptz), $3, 0, 0,
             '${site.source}', now())
     ON CONFLICT (client_config_id, bucket_start) DO UPDATE SET
       used_bytes = client_usage_daily.used_bytes + excluded.used_bytes,
       customer_account_id = excluded.customer_account_id,
       updated_at = now()`,
    rollupValues,
  );
  await upsertRemoteBaseline(ex, site, user, customerAccountId, observedAtIso);
  return delta;
}

async function upsertRemoteBaseline(
  ex: DatabaseQueryExecutor,
  site: RemoteUsageSite,
  user: DeUserCumulative,
  customerAccountId: string,
  observedAtIso: string,
): Promise<void> {
  await ex.query(
    `INSERT INTO ${site.baselineTable}
       (client_config_id, customer_account_id, cumulative_bytes, observed_at, updated_at)
     VALUES ($1, $2, $3, $4::timestamptz, now())
     ON CONFLICT (client_config_id) DO UPDATE SET
       customer_account_id = excluded.customer_account_id,
       cumulative_bytes = excluded.cumulative_bytes,
       observed_at = excluded.observed_at,
       updated_at = now()`,
    [user.clientConfigId, customerAccountId, user.cumulativeBytes, observedAtIso],
  );
}

/** Retention prune: hourly older than `hours`, daily older than `days`. */
export async function pruneDeRollups(
  db: DatabaseQueryExecutor,
  hours: number,
  days: number,
): Promise<void> {
  await db.query(
    `DELETE FROM client_usage_hourly WHERE bucket_start < now() - ($1::int * interval '1 hour')`,
    [hours],
  );
  await db.query(
    `DELETE FROM client_usage_daily WHERE bucket_start < now() - ($1::int * interval '1 day')`,
    [days],
  );
}

interface UsageSeriesRow {
  bucketStart: string;
  usedBytes: string | number;
}

/**
 * Rollup-backed usage series for one client. `48h` -> 48 hourly + 2 daily buckets;
 * `30d` -> 48 hourly + 30 daily buckets. Reads only the compact rollups.
 */
export async function queryClientUsageSeries(
  db: DatabaseQueryExecutor,
  clientConfigId: string,
  window: ClientUsageSeriesWindow,
): Promise<{ hourly: ClientUsageSeriesPoint[]; daily: ClientUsageSeriesPoint[] }> {
  const dailyDays = window === '30d' ? 30 : 2;

  const hourly = await db.query<UsageSeriesRow>(
    `SELECT bucket_start AS "bucketStart", used_bytes AS "usedBytes"
     FROM client_usage_hourly
     WHERE client_config_id = $1
       AND bucket_start >= date_trunc('hour', now()) - interval '48 hours'
     ORDER BY bucket_start ASC`,
    [clientConfigId],
  );
  const daily = await db.query<UsageSeriesRow>(
    `SELECT bucket_start AS "bucketStart", used_bytes AS "usedBytes"
     FROM client_usage_daily
     WHERE client_config_id = $1
       AND bucket_start >= date_trunc('day', now()) - ($2::int * interval '1 day')
     ORDER BY bucket_start ASC`,
    [clientConfigId, dailyDays],
  );

  return {
    hourly: hourly.rows.map(toSeriesPoint),
    daily: daily.rows.map(toSeriesPoint),
  };
}

function toSeriesPoint(row: UsageSeriesRow): ClientUsageSeriesPoint {
  return { bucketStart: new Date(row.bucketStart).toISOString(), usedBytes: Number(row.usedBytes) || 0 };
}
