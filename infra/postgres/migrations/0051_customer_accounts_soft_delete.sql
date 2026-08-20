-- Soft delete (archive) for customer accounts. Operator "delete" archives the
-- account instead of destroying it, so payment/accounting history is retained
-- and the account is recoverable. `deleted_at` NULL = live; non-NULL = archived.
-- Access is cut by also setting status = 'disabled' (enforcement joins gate on
-- customer_accounts.status = 'active'); deleted_at hides the row from the
-- operator Customers listing and is defense-in-depth on entitlement lookups.
ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- The Customers listing filters `deleted_at IS NULL` and orders by created_at DESC.
-- A partial index over the live rows keeps that scan cheap as archived rows grow.
CREATE INDEX IF NOT EXISTS customer_accounts_active_created_idx
  ON customer_accounts (created_at DESC)
  WHERE deleted_at IS NULL;
