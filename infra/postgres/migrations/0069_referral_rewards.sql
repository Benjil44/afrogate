-- 0069_referral_rewards.sql
-- Referral reward paid in DATA (default 1.5 GB decimal). The inviter
-- (customer_accounts.referred_by) is rewarded ONCE, on the invited user's FIRST
-- approved PAID Telegram top-up, credited in the SAME transaction as the approval
-- (see apps/backend/src/telegram/telegram-topup.ts approveTopupInTransaction).
--
-- This DATA reward REPLACES the gem referral paths while active (reward bytes > 0);
-- gems remain for all non-referral uses. The ledger below is the one-per-invitee
-- idempotency + audit record. We store the RESOLVED inviter_account_id at credit
-- time and NEVER re-derive referred_by later (account merge re-points referred_by,
-- see apps/backend/src/billing/customer-account-merge.ts), so a merge can't move an
-- already-paid reward to a different inviter.
--
-- status: 'granted'        — quota credited to the inviter.
--         'pending_review' — per-inviter rolling-30-day cap exceeded; row recorded,
--                            NO quota credited (an operator can grant it later).
--         'reversed'       — reserved for future use; Telegram top-ups have no
--                            reversal path in v1 (no auto-clawback).

CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One reward per invited account, ever (idempotency). The credit path inserts
  -- ON CONFLICT (invited_account_id) DO NOTHING, so only the first approved paid
  -- top-up for this invitee ever credits the inviter.
  invited_account_id uuid NOT NULL UNIQUE REFERENCES customer_accounts(id) ON DELETE CASCADE,
  -- The inviter resolved at credit time (NOT re-derived from referred_by later).
  inviter_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  reward_bytes bigint NOT NULL,
  topup_request_id uuid REFERENCES telegram_topup_requests(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'granted',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Per-inviter rolling-window cap count (GRANTED rewards in the last 30 days).
CREATE INDEX IF NOT EXISTS referral_rewards_inviter_created_idx
  ON referral_rewards (inviter_account_id, created_at);

-- Admin-configurable reward size on the singleton settings row. Decimal bytes:
-- 1,500,000,000 = 1.5 GB (NOT GiB). 0 disables the data reward (gems resume).
ALTER TABLE telegram_bot_settings
  ADD COLUMN IF NOT EXISTS referral_reward_bytes bigint NOT NULL DEFAULT 1500000000;
