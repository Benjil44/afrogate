ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('owner', 'admin', 'supervisor', 'support', 'auditor', 'reseller'));

CREATE TABLE IF NOT EXISTS reseller_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id text NOT NULL,
  display_name text NOT NULL,
  contact_name text,
  telegram_username text,
  status text NOT NULL DEFAULT 'active',
  seller_margin_bps integer NOT NULL DEFAULT 2500,
  currency text NOT NULL DEFAULT 'toman',
  balance_amount bigint NOT NULL DEFAULT 0,
  credit_limit_amount bigint NOT NULL DEFAULT 0,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reseller_accounts_admin_user_unique UNIQUE (admin_user_id),
  CONSTRAINT reseller_accounts_status_check
    CHECK (status IN ('active', 'suspended', 'disabled')),
  CONSTRAINT reseller_accounts_margin_check
    CHECK (seller_margin_bps >= 0 AND seller_margin_bps <= 8000),
  CONSTRAINT reseller_accounts_credit_limit_nonnegative
    CHECK (credit_limit_amount >= 0),
  CONSTRAINT reseller_accounts_balance_credit_check
    CHECK (balance_amount + credit_limit_amount >= 0)
);

CREATE INDEX IF NOT EXISTS reseller_accounts_status_idx
  ON reseller_accounts (status);

CREATE INDEX IF NOT EXISTS reseller_accounts_created_at_idx
  ON reseller_accounts (created_at DESC);

ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS reseller_account_id uuid REFERENCES reseller_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customer_accounts_reseller_account_idx
  ON customer_accounts (reseller_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reseller_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_account_id uuid NOT NULL REFERENCES reseller_accounts(id) ON DELETE RESTRICT,
  entry_type text NOT NULL,
  amount bigint NOT NULL,
  balance_before_amount bigint NOT NULL,
  balance_after_amount bigint NOT NULL,
  currency text NOT NULL,
  source text NOT NULL,
  source_id text,
  volume_package_id uuid REFERENCES volume_packages(id) ON DELETE SET NULL,
  customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
  client_config_id uuid REFERENCES client_configs(id) ON DELETE SET NULL,
  idempotency_key text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reseller_wallet_ledger_entry_type_check
    CHECK (entry_type IN ('topup', 'sale_debit', 'adjustment', 'refund')),
  CONSTRAINT reseller_wallet_ledger_source_check
    CHECK (source IN ('manual_topup', 'client_sale', 'manual_adjustment', 'refund')),
  CONSTRAINT reseller_wallet_ledger_nonzero_amount
    CHECK (amount <> 0),
  CONSTRAINT reseller_wallet_ledger_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS reseller_wallet_ledger_idempotency_unique
  ON reseller_wallet_ledger (idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE INDEX IF NOT EXISTS reseller_wallet_ledger_reseller_created_idx
  ON reseller_wallet_ledger (reseller_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reseller_wallet_ledger_customer_idx
  ON reseller_wallet_ledger (customer_account_id, created_at DESC)
  WHERE customer_account_id IS NOT NULL;
