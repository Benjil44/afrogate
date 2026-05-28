CREATE TABLE IF NOT EXISTS payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
  volume_package_id uuid REFERENCES volume_packages(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
  package_name text NOT NULL,
  package_slug text NOT NULL,
  volume_bytes bigint NOT NULL,
  duration_days integer,
  price_per_gb bigint NOT NULL DEFAULT 0,
  amount bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'manual',
  provider_order_id text,
  provider_capture_id text,
  checkout_url text,
  idempotency_key text,
  paid_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_orders_status_check
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  CONSTRAINT payment_orders_volume_positive
    CHECK (volume_bytes > 0),
  CONSTRAINT payment_orders_duration_positive
    CHECK (duration_days IS NULL OR duration_days > 0),
  CONSTRAINT payment_orders_price_nonnegative
    CHECK (price_per_gb >= 0),
  CONSTRAINT payment_orders_amount_nonnegative
    CHECK (amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_idempotency_unique
  ON payment_orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_provider_order_unique
  ON payment_orders (provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL AND provider_order_id <> '';

CREATE INDEX IF NOT EXISTS payment_orders_status_created_idx
  ON payment_orders (status, created_at);

CREATE INDEX IF NOT EXISTS payment_orders_customer_created_idx
  ON payment_orders (customer_account_id, created_at);

CREATE INDEX IF NOT EXISTS payment_orders_method_created_idx
  ON payment_orders (payment_method_id, created_at);

CREATE INDEX IF NOT EXISTS payment_orders_provider_status_idx
  ON payment_orders (provider, status, created_at);
