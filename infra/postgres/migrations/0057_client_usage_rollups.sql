-- Germany-path usage metering: per-client rollups + a per-client cumulative
-- baseline (high-water-mark) for the Germany durable-buffer delta math.
--
-- The Germany xray recorder writes a MONOTONIC cumulative per-user byte total to
-- /var/lib/afrows/de-usage.json. Ireland pulls it over SSH and turns the jump
-- since the last-seen cumulative into a positive delta. `client_usage_de_baseline`
-- stores that last-seen cumulative and is advanced ONLY after the delta is written,
-- so a village blackout loses nothing (the next successful read catches up).
--
-- The two rollup tables are compact time-bucketed aggregates that back the
-- per-user usage charts without rescanning the append-only client_usage_events.
-- Retention: hourly ~48h (charts window), daily long. Pruning lives in the
-- GermanyUsageMeteringService tick (see pruneRollups()).

-- Allow the Germany metering source on the append-only events ledger.
-- DROP + re-ADD is idempotent under the re-run-every-file migration runner.
-- 'usa-xray' (0065) is listed here too: every file is re-applied on each deploy,
-- so this ADD must already accept USA rows or it would fail once they exist.
ALTER TABLE client_usage_events DROP CONSTRAINT IF EXISTS client_usage_events_source_check;
ALTER TABLE client_usage_events ADD CONSTRAINT client_usage_events_source_check
  CHECK (source IN (
    'admin', 'agent', 'panel_sync', 'payment_adjustment',
    'manual_adjustment', 'client_report', 'germany-xray', 'usa-xray', 'unknown'
  ));

CREATE TABLE IF NOT EXISTS client_usage_de_baseline (
  client_config_id uuid PRIMARY KEY REFERENCES client_configs(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  cumulative_bytes bigint NOT NULL DEFAULT 0,
  observed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_usage_de_baseline_cumulative_nonnegative CHECK (cumulative_bytes >= 0)
);

CREATE TABLE IF NOT EXISTS client_usage_hourly (
  client_config_id uuid NOT NULL REFERENCES client_configs(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  bucket_start timestamptz NOT NULL,
  used_bytes bigint NOT NULL DEFAULT 0,
  rx_bytes bigint NOT NULL DEFAULT 0,
  tx_bytes bigint NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'germany-xray',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_usage_hourly_pk PRIMARY KEY (client_config_id, bucket_start),
  CONSTRAINT client_usage_hourly_used_nonnegative CHECK (used_bytes >= 0),
  CONSTRAINT client_usage_hourly_rx_nonnegative CHECK (rx_bytes >= 0),
  CONSTRAINT client_usage_hourly_tx_nonnegative CHECK (tx_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS client_usage_hourly_client_bucket_idx
  ON client_usage_hourly (client_config_id, bucket_start DESC);
CREATE INDEX IF NOT EXISTS client_usage_hourly_bucket_idx
  ON client_usage_hourly (bucket_start DESC);

CREATE TABLE IF NOT EXISTS client_usage_daily (
  client_config_id uuid NOT NULL REFERENCES client_configs(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  bucket_start timestamptz NOT NULL,
  used_bytes bigint NOT NULL DEFAULT 0,
  rx_bytes bigint NOT NULL DEFAULT 0,
  tx_bytes bigint NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'germany-xray',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_usage_daily_pk PRIMARY KEY (client_config_id, bucket_start),
  CONSTRAINT client_usage_daily_used_nonnegative CHECK (used_bytes >= 0),
  CONSTRAINT client_usage_daily_rx_nonnegative CHECK (rx_bytes >= 0),
  CONSTRAINT client_usage_daily_tx_nonnegative CHECK (tx_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS client_usage_daily_client_bucket_idx
  ON client_usage_daily (client_config_id, bucket_start DESC);
CREATE INDEX IF NOT EXISTS client_usage_daily_bucket_idx
  ON client_usage_daily (bucket_start DESC);
