-- 0068_customer_grace_until.sql
-- 24h renewal grace. When a customer uploads a payment receipt (Telegram top-up),
-- grace_until is set to now() + 24h; quota enforcement then treats the account as
-- under quota until grace_until passes, so service continues while the operator
-- reviews the receipt even if the account crosses its quota. Cleared (set NULL)
-- when the top-up request is approved or rejected.
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS grace_until timestamptz;

-- Partial index: the enforcement cut and the restore/reconcile predicates test
-- `grace_until > now()` for only the small set of accounts currently in grace.
CREATE INDEX IF NOT EXISTS customer_accounts_grace_until_idx
  ON customer_accounts (grace_until)
  WHERE grace_until IS NOT NULL;
