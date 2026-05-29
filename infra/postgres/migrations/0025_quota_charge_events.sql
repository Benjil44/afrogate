CREATE TABLE IF NOT EXISTS quota_charge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
  charge_scope text NOT NULL DEFAULT 'account_quota',
  volume_bytes_delta bigint NOT NULL,
  account_quota_before_bytes bigint,
  account_quota_after_bytes bigint,
  client_config_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_quota_changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_panel_write_status text NOT NULL DEFAULT 'not_executed',
  idempotency_key text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quota_charge_events_scope_check
    CHECK (charge_scope IN ('account_quota', 'selected_clients', 'account_and_selected_clients')),
  CONSTRAINT quota_charge_events_external_panel_write_status_check
    CHECK (external_panel_write_status IN ('not_configured', 'not_executed')),
  CONSTRAINT quota_charge_events_volume_positive
    CHECK (volume_bytes_delta > 0),
  CONSTRAINT quota_charge_events_account_before_nonnegative
    CHECK (account_quota_before_bytes IS NULL OR account_quota_before_bytes >= 0),
  CONSTRAINT quota_charge_events_account_after_nonnegative
    CHECK (account_quota_after_bytes IS NULL OR account_quota_after_bytes >= 0),
  CONSTRAINT quota_charge_events_client_ids_array
    CHECK (jsonb_typeof(client_config_ids) = 'array'),
  CONSTRAINT quota_charge_events_client_changes_array
    CHECK (jsonb_typeof(client_quota_changes) = 'array'),
  CONSTRAINT quota_charge_events_scope_shape
    CHECK (
      (
        charge_scope = 'account_quota'
        AND account_quota_after_bytes IS NOT NULL
        AND jsonb_array_length(client_config_ids) = 0
      )
      OR (
        charge_scope = 'selected_clients'
        AND account_quota_after_bytes IS NULL
        AND jsonb_array_length(client_config_ids) > 0
      )
      OR (
        charge_scope = 'account_and_selected_clients'
        AND account_quota_after_bytes IS NOT NULL
        AND jsonb_array_length(client_config_ids) > 0
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS quota_charge_events_idempotency_unique
  ON quota_charge_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE INDEX IF NOT EXISTS quota_charge_events_customer_created_idx
  ON quota_charge_events (customer_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS quota_charge_events_created_idx
  ON quota_charge_events (created_at DESC);
