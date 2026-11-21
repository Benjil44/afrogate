-- "Germany Fast x2" direct-REALITY remote-exit usage metering (mirrors 0065 for the USA,
-- 0057 for Germany).
--
-- The Germany-Fast xray recorder writes a MONOTONIC cumulative per-user byte total to
-- /var/lib/afrows/def-usage.json (same format as de-usage.json / us-usage.json). The backend
-- pulls it over SSH and turns the jump since the last-seen cumulative into a positive delta
-- charged to the SAME customer quota (billed 2x by default). This counter is INDEPENDENT of the
-- Cloudflare Germany counter ('germany-xray' / client_usage_de_baseline), so it gets its own
-- high-water-mark table and its own ledger source ('de-fast-xray'): the (source, idempotency_key)
-- unique index then keeps the two Germany meters' identical "<clientConfigId>:<cumulative>" keys
-- apart. Reusing 'germany-xray' / client_usage_de_baseline here would corrupt both baselines.
-- Hourly/daily rollups are shared (additive per bucket).

-- DROP + re-ADD is idempotent under the re-run-every-file migration runner. This supersedes the
-- source list set by 0065 (adds 'de-fast-xray'); keep every value 0065 allowed.
ALTER TABLE client_usage_events DROP CONSTRAINT IF EXISTS client_usage_events_source_check;
ALTER TABLE client_usage_events ADD CONSTRAINT client_usage_events_source_check
  CHECK (source IN (
    'admin', 'agent', 'panel_sync', 'payment_adjustment',
    'manual_adjustment', 'client_report', 'germany-xray', 'usa-xray', 'de-fast-xray', 'unknown'
  ));

CREATE TABLE IF NOT EXISTS client_usage_def_baseline (
  client_config_id uuid PRIMARY KEY REFERENCES client_configs(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  cumulative_bytes bigint NOT NULL DEFAULT 0,
  observed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_usage_def_baseline_cumulative_nonnegative CHECK (cumulative_bytes >= 0)
);
