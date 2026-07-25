-- Telegram self-service: manual card-to-card top-up requests + per-Telegram-user
-- state (language + in-progress flow), plus two new bot settings.
--
-- Flow: a linked customer picks a volume package in the bot (status
-- 'awaiting_receipt'), sends the card-to-card receipt photo (-> 'pending'), and
-- an admin approves ('approved', credits quota) or rejects ('rejected') it in the
-- dashboard. Nothing here credits quota by itself; the backend applies the
-- package to the account's quota_limit_bytes on approval.

CREATE TABLE IF NOT EXISTS telegram_topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  telegram_id text,
  telegram_chat_id text,
  volume_package_id uuid REFERENCES volume_packages(id),
  amount_minor bigint,
  currency text,
  receipt_file_id text,
  status text NOT NULL DEFAULT 'awaiting_receipt'
    CHECK (status IN ('awaiting_receipt', 'pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  CONSTRAINT telegram_topup_requests_amount_nonnegative
    CHECK (amount_minor IS NULL OR amount_minor >= 0)
);

-- Admin approval queue: default view is the newest pending receipts first.
CREATE INDEX IF NOT EXISTS telegram_topup_requests_status_created_idx
  ON telegram_topup_requests (status, created_at DESC);

-- Correlate an incoming receipt photo to the user's latest awaiting request.
CREATE INDEX IF NOT EXISTS telegram_topup_requests_telegram_status_idx
  ON telegram_topup_requests (telegram_id, status, created_at DESC);

-- Per-Telegram-user record, independent of having a customer account. Holds the
-- chosen bot language (picked at first /start, before the account exists) and a
-- small state blob for the in-progress menu/charge flow.
CREATE TABLE IF NOT EXISTS telegram_users (
  telegram_id text PRIMARY KEY,
  chat_id text,
  language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'fa')),
  state jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Two self-service settings on the existing singleton settings row:
--   card_to_card_info : destination (card number + holder) shown to users on charge
--   trial_quota_bytes : trial quota for new self-serve accounts (NULL -> default 1e9)
ALTER TABLE telegram_bot_settings ADD COLUMN IF NOT EXISTS card_to_card_info text;
ALTER TABLE telegram_bot_settings ADD COLUMN IF NOT EXISTS trial_quota_bytes bigint;

ALTER TABLE telegram_bot_settings
  DROP CONSTRAINT IF EXISTS telegram_bot_settings_trial_quota_nonnegative;
ALTER TABLE telegram_bot_settings
  ADD CONSTRAINT telegram_bot_settings_trial_quota_nonnegative
    CHECK (trial_quota_bytes IS NULL OR trial_quota_bytes >= 0);
