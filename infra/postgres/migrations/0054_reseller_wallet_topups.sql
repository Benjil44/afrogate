-- Reseller card-to-card wallet top-up requests + the per-GB price control.
--
-- Flow: a reseller requests a wallet top-up (amount + a card-to-card receipt image
-- stored server-side as bytea), a superadmin/admin reviews it in the dashboard and
-- approves (credits the reseller wallet via the reseller_wallet_ledger) or rejects it.
-- Nothing here credits the wallet by itself; the backend writes the ledger topup on
-- approval and links it back via wallet_ledger_id.

-- The current per-GB price (the platform's COST per decimal GB) lives on the existing
-- billing_settings singleton as price_per_gb (added in 0014). Re-assert it here so a
-- fresh/partial database always has the column the reseller per-GB sale path reads.
ALTER TABLE billing_settings
  ADD COLUMN IF NOT EXISTS price_per_gb bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS reseller_wallet_topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_account_id uuid NOT NULL REFERENCES reseller_accounts(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  currency text NOT NULL,
  -- Receipt image stored server-side (bytea) + its content type, served only via an
  -- authenticated endpoint. Never a public URL; never sent to an unauthenticated port.
  receipt_bytes bytea,
  receipt_content_type text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamptz,
  -- The reseller_wallet_ledger topup entry written on approval (audit linkage).
  wallet_ledger_id uuid REFERENCES reseller_wallet_ledger(id) ON DELETE SET NULL,
  CONSTRAINT reseller_wallet_topup_requests_amount_positive
    CHECK (amount > 0)
);

-- Admin approval queue: newest pending requests first.
CREATE INDEX IF NOT EXISTS reseller_wallet_topup_requests_status_created_idx
  ON reseller_wallet_topup_requests (status, created_at DESC);

-- A reseller's own top-up history (their panel), newest first.
CREATE INDEX IF NOT EXISTS reseller_wallet_topup_requests_reseller_created_idx
  ON reseller_wallet_topup_requests (reseller_account_id, created_at DESC);
