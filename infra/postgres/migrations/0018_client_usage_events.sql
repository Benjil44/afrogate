CREATE TABLE IF NOT EXISTS client_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  client_config_id uuid NOT NULL REFERENCES client_configs(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'admin',
  direction text NOT NULL DEFAULT 'combined',
  used_bytes_delta bigint NOT NULL,
  rx_bytes bigint,
  tx_bytes bigint,
  observed_at timestamptz NOT NULL DEFAULT now(),
  window_start timestamptz,
  window_end timestamptz,
  idempotency_key text,
  external_reference text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_usage_events_source_check
    CHECK (source IN ('admin', 'agent', 'panel_sync', 'payment_adjustment', 'manual_adjustment', 'client_report', 'unknown')),
  CONSTRAINT client_usage_events_direction_check
    CHECK (direction IN ('rx', 'tx', 'combined')),
  CONSTRAINT client_usage_events_delta_nonnegative
    CHECK (used_bytes_delta >= 0),
  CONSTRAINT client_usage_events_rx_nonnegative
    CHECK (rx_bytes IS NULL OR rx_bytes >= 0),
  CONSTRAINT client_usage_events_tx_nonnegative
    CHECK (tx_bytes IS NULL OR tx_bytes >= 0),
  CONSTRAINT client_usage_events_window_order
    CHECK (window_start IS NULL OR window_end IS NULL OR window_end >= window_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS client_usage_events_source_idempotency_unique
  ON client_usage_events (source, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE INDEX IF NOT EXISTS client_usage_events_client_observed_idx
  ON client_usage_events (client_config_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS client_usage_events_account_observed_idx
  ON client_usage_events (customer_account_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS client_usage_events_created_idx
  ON client_usage_events (created_at DESC);
