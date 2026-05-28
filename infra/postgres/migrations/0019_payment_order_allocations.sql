CREATE TABLE IF NOT EXISTS payment_order_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id uuid NOT NULL REFERENCES payment_orders(id) ON DELETE RESTRICT,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
  allocation_scope text NOT NULL DEFAULT 'account_quota',
  volume_bytes_delta bigint NOT NULL,
  quota_limit_before_bytes bigint,
  quota_limit_after_bytes bigint NOT NULL,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_order_allocations_scope_check
    CHECK (allocation_scope IN ('account_quota')),
  CONSTRAINT payment_order_allocations_volume_positive
    CHECK (volume_bytes_delta > 0),
  CONSTRAINT payment_order_allocations_before_nonnegative
    CHECK (quota_limit_before_bytes IS NULL OR quota_limit_before_bytes >= 0),
  CONSTRAINT payment_order_allocations_after_nonnegative
    CHECK (quota_limit_after_bytes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_order_allocations_order_unique
  ON payment_order_allocations (payment_order_id);

CREATE UNIQUE INDEX IF NOT EXISTS payment_order_allocations_idempotency_unique
  ON payment_order_allocations (idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE INDEX IF NOT EXISTS payment_order_allocations_customer_created_idx
  ON payment_order_allocations (customer_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_order_allocations_created_idx
  ON payment_order_allocations (created_at DESC);
