CREATE TABLE IF NOT EXISTS customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  telegram_id text,
  telegram_username text,
  paid_number_hash text,
  status text NOT NULL DEFAULT 'active',
  quota_scope text NOT NULL DEFAULT 'account_shared',
  quota_limit_bytes bigint,
  per_client_limit_bytes bigint,
  used_bytes bigint NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_accounts_status_check
    CHECK (status IN ('active', 'suspended', 'disabled')),
  CONSTRAINT customer_accounts_quota_scope_check
    CHECK (quota_scope IN ('account_shared', 'per_client')),
  CONSTRAINT customer_accounts_quota_limit_nonnegative
    CHECK (quota_limit_bytes IS NULL OR quota_limit_bytes >= 0),
  CONSTRAINT customer_accounts_per_client_limit_nonnegative
    CHECK (per_client_limit_bytes IS NULL OR per_client_limit_bytes >= 0),
  CONSTRAINT customer_accounts_used_nonnegative
    CHECK (used_bytes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_telegram_id_unique
  ON customer_accounts (telegram_id)
  WHERE telegram_id IS NOT NULL AND telegram_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_paid_number_hash_unique
  ON customer_accounts (paid_number_hash)
  WHERE paid_number_hash IS NOT NULL AND paid_number_hash <> '';

CREATE INDEX IF NOT EXISTS customer_accounts_status_idx
  ON customer_accounts (status);

CREATE INDEX IF NOT EXISTS customer_accounts_quota_scope_idx
  ON customer_accounts (quota_scope);

CREATE TABLE IF NOT EXISTS client_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  label text NOT NULL,
  protocol text NOT NULL DEFAULT 'custom',
  external_panel text,
  external_panel_user_id text,
  external_panel_config_id text,
  device_limit integer,
  quota_limit_bytes bigint,
  used_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_configs_status_check
    CHECK (status IN ('active', 'limited', 'disabled', 'expired')),
  CONSTRAINT client_configs_device_limit_positive
    CHECK (device_limit IS NULL OR device_limit > 0),
  CONSTRAINT client_configs_quota_limit_nonnegative
    CHECK (quota_limit_bytes IS NULL OR quota_limit_bytes >= 0),
  CONSTRAINT client_configs_used_nonnegative
    CHECK (used_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS client_configs_customer_account_idx
  ON client_configs (customer_account_id);

CREATE INDEX IF NOT EXISTS client_configs_status_idx
  ON client_configs (status);

CREATE INDEX IF NOT EXISTS client_configs_protocol_idx
  ON client_configs (protocol);

CREATE INDEX IF NOT EXISTS client_configs_external_panel_idx
  ON client_configs (external_panel, external_panel_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS client_configs_external_config_unique
  ON client_configs (external_panel, external_panel_config_id)
  WHERE external_panel IS NOT NULL
    AND external_panel <> ''
    AND external_panel_config_id IS NOT NULL
    AND external_panel_config_id <> '';
