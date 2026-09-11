-- Seller <-> Telegram linkage, gated by superadmin approval (NOT self-service).
-- A seller submits their phone, Telegram numeric id, and a card number (shown to
-- their customers for card-to-card payment) from the dashboard; a superadmin
-- reviews and approves/rejects. Only an 'approved' link lets the seller's
-- Telegram id resolve to a seller session in the bot (role-aware dispatch).
--
-- telegram_link_status: none (never submitted) | pending (awaiting review) |
-- approved (bot access granted) | rejected (denied; seller may resubmit, which
-- moves it back to pending). telegram_linked_at is stamped on approval only.
ALTER TABLE reseller_accounts
  ADD COLUMN IF NOT EXISTS telegram_id text,
  ADD COLUMN IF NOT EXISTS telegram_link_phone text,
  ADD COLUMN IF NOT EXISTS card_info text,
  ADD COLUMN IF NOT EXISTS telegram_link_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS telegram_link_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamptz;

ALTER TABLE reseller_accounts
  DROP CONSTRAINT IF EXISTS reseller_accounts_telegram_link_status_check;
ALTER TABLE reseller_accounts
  ADD CONSTRAINT reseller_accounts_telegram_link_status_check
  CHECK (telegram_link_status IN ('none', 'pending', 'approved', 'rejected'));

-- Only one seller may hold an APPROVED link to a given Telegram id at a time
-- (a pending/rejected duplicate is fine; approval enforces the real exclusion).
DROP INDEX IF EXISTS reseller_accounts_telegram_id_approved_unique;
CREATE UNIQUE INDEX reseller_accounts_telegram_id_approved_unique
  ON reseller_accounts (telegram_id)
  WHERE telegram_link_status = 'approved' AND telegram_id IS NOT NULL;

-- Fast lookup for the bot's role-resolution query (approved sellers by telegram_id).
CREATE INDEX IF NOT EXISTS reseller_accounts_telegram_link_status_idx
  ON reseller_accounts (telegram_link_status);
