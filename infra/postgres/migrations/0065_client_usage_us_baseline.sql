-- USA remote-exit usage metering (mirrors 0057 for Germany).
--
-- The USA xray recorder writes a MONOTONIC cumulative per-user byte total to
-- /var/lib/afrows/us-usage.json (same format as de-usage.json). Ireland pulls it
-- over SSH and turns the jump since the last-seen cumulative into a positive
-- delta charged to the SAME customer quota. The USA counter is independent of
-- Germany's, so it gets its own high-water-mark table, and its ledger rows use
-- their own source ('usa-xray') so the (source, idempotency_key) unique index
-- keeps the two sites' identical "<clientConfigId>:<cumulative>" keys apart.
-- Hourly/daily rollups are shared (additive per bucket).

-- DROP + re-ADD is idempotent under the re-run-every-file migration runner.
-- 'de-fast-xray' (0071) is listed here too: every file is re-applied on each deploy, so
-- this ADD must already accept Germany-Fast rows or it would fail once they exist. Keep
-- this a SUPERSET matching the newest source list (0071).
ALTER TABLE client_usage_events DROP CONSTRAINT IF EXISTS client_usage_events_source_check;
ALTER TABLE client_usage_events ADD CONSTRAINT client_usage_events_source_check
  CHECK (source IN (
    'admin', 'agent', 'panel_sync', 'payment_adjustment',
    'manual_adjustment', 'client_report', 'germany-xray', 'usa-xray', 'de-fast-xray', 'unknown'
  ));

CREATE TABLE IF NOT EXISTS client_usage_us_baseline (
  client_config_id uuid PRIMARY KEY REFERENCES client_configs(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  cumulative_bytes bigint NOT NULL DEFAULT 0,
  observed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_usage_us_baseline_cumulative_nonnegative CHECK (cumulative_bytes >= 0)
);
