-- Per-seller customer cap. NULL = unlimited (the existing behaviour). When set,
-- a reseller cannot create more than `max_customers` customer accounts; enforced
-- in the reseller create + sale paths (billing.service). Independent of the
-- wallet credit limit (which bounds spend, not headcount).
ALTER TABLE reseller_accounts
  ADD COLUMN IF NOT EXISTS max_customers int;

ALTER TABLE reseller_accounts
  DROP CONSTRAINT IF EXISTS reseller_accounts_max_customers_nonnegative;
ALTER TABLE reseller_accounts
  ADD CONSTRAINT reseller_accounts_max_customers_nonnegative
  CHECK (max_customers IS NULL OR max_customers >= 0);
