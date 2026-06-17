-- Email/username + password login for customer accounts (mobile app account mode).
-- login_email accepts an email OR a simple handle; uniqueness is case-insensitive.
ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS login_email text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_login_email_key
  ON customer_accounts (lower(login_email))
  WHERE login_email IS NOT NULL;
