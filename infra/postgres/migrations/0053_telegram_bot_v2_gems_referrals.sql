-- afroWS bot v2: registration data (phone), a gems wallet + append-only gems
-- ledger, referral graph (code + referred_by), and the admin-configurable gem
-- economy on the singleton telegram_bot_settings row.
--
-- Economy defaults mirror docs/telegram-bot-v2-plan.md §"Default economy":
--   redeem 100 gems = 1 GB; +50 gems referral signup; 20% of a referred
--   purchase's GB paid to the inviter in gems; every 10 completed referrals a
--   +300 gems milestone bonus. All values are admin-editable via settings.

-- 1. Registration + wallet + referral columns on customer_accounts.
--    phone is stored in CLEAR (operator-visible, names the VLESS config); it is
--    NOT a login credential. gems_balance is the cached wallet total kept in step
--    with gems_ledger (the ledger is the source of truth / audit trail).
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS gems_balance bigint NOT NULL DEFAULT 0;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES customer_accounts(id);

ALTER TABLE customer_accounts
  DROP CONSTRAINT IF EXISTS customer_accounts_gems_balance_nonnegative;
ALTER TABLE customer_accounts
  ADD CONSTRAINT customer_accounts_gems_balance_nonnegative
    CHECK (gems_balance >= 0);

-- An account must not refer itself.
ALTER TABLE customer_accounts
  DROP CONSTRAINT IF EXISTS customer_accounts_no_self_referral;
ALTER TABLE customer_accounts
  ADD CONSTRAINT customer_accounts_no_self_referral
    CHECK (referred_by IS NULL OR referred_by <> id);

-- 2. Backfill a stable, unique referral code for every existing account before the
--    unique index is created. md5(id) is deterministic (re-runnable) and collision
--    -safe for the current account population; new accounts get codes from the
--    rewards engine with a live uniqueness check.
UPDATE customer_accounts
  SET referral_code = upper(substr(md5(id::text), 1, 8))
  WHERE referral_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_referral_code_key
  ON customer_accounts (referral_code)
  WHERE referral_code IS NOT NULL;

-- Inviter -> referred lookups (referral counts, milestone checks).
CREATE INDEX IF NOT EXISTS customer_accounts_referred_by_idx
  ON customer_accounts (referred_by)
  WHERE referred_by IS NOT NULL;

-- 3. Append-only audit of every gem movement (earn + redeem). delta is signed
--    (positive = credited, negative = spent). `reason` is a stable machine tag
--    (referral_signup | referral_commission | referral_milestone | redeem |
--    admin_adjust); `ref` optionally correlates to the source row (referred
--    account id, topup request id, milestone marker).
CREATE TABLE IF NOT EXISTS gems_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  delta bigint NOT NULL,
  reason text NOT NULL,
  ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gems_ledger_account_created_idx
  ON gems_ledger (customer_account_id, created_at DESC);

-- Dedup guard for one-time credits (signup bonus / milestone / commission): the
-- rewards engine checks (reason, ref) before crediting.
CREATE INDEX IF NOT EXISTS gems_ledger_reason_ref_idx
  ON gems_ledger (reason, ref);

-- 4. Admin-configurable gem economy on the singleton settings row (defaults per plan).
ALTER TABLE telegram_bot_settings ADD COLUMN IF NOT EXISTS gem_redeem_per_gb int NOT NULL DEFAULT 100;
ALTER TABLE telegram_bot_settings ADD COLUMN IF NOT EXISTS gem_referral_signup int NOT NULL DEFAULT 50;
ALTER TABLE telegram_bot_settings ADD COLUMN IF NOT EXISTS gem_referral_purchase_pct int NOT NULL DEFAULT 20;
ALTER TABLE telegram_bot_settings ADD COLUMN IF NOT EXISTS gem_milestone_every int NOT NULL DEFAULT 10;
ALTER TABLE telegram_bot_settings ADD COLUMN IF NOT EXISTS gem_milestone_bonus int NOT NULL DEFAULT 300;

-- 5. Allow telegram_users.language to be NULL (docs §5/§13: null = "not chosen
--    yet, show the language picker"). v2 must persist a per-user row BEFORE the
--    language is picked, to hold a /start deep-link referral code captured on the
--    very first contact. The CHECK still forbids any value other than en/fa/NULL.
ALTER TABLE telegram_users ALTER COLUMN language DROP DEFAULT;
ALTER TABLE telegram_users ALTER COLUMN language DROP NOT NULL;

ALTER TABLE telegram_bot_settings
  DROP CONSTRAINT IF EXISTS telegram_bot_settings_gem_economy_bounds;
ALTER TABLE telegram_bot_settings
  ADD CONSTRAINT telegram_bot_settings_gem_economy_bounds
    CHECK (
      gem_redeem_per_gb >= 1
      AND gem_referral_signup >= 0
      AND gem_referral_purchase_pct >= 0 AND gem_referral_purchase_pct <= 100
      AND gem_milestone_every >= 1
      AND gem_milestone_bonus >= 0
    );
