-- Customer subscription expiry + free-form tags.
--   expires_at: NULL = never expires; when in the past the account can't log in.
--   tags: operator labels (e.g. {vip, trial, reseller-x}) for filtering/segmentation.
ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
