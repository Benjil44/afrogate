-- 0070_monetization_levers.sql
-- Three approved revenue levers for the Afrows Telegram bot, as one coherent batch:
--   (A) capped renewal grace + early-renewal window (quota carried, not forfeited),
--   (B) a 5-min renewal-ladder notice + cycle-anchored usage receipt,
--   (C) approval bonuses: first-purchase / early-renewal / win-back (buyer %), and a
--       fixed invitee referral bonus (buyer), all once-ever / mutually-exclusive per
--       the owner decisions. The inviter DATA reward (0069) is untouched.
--
-- Units: all bytes are DECIMAL (1 GB = 1e9). quota_limit_bytes NULL = UNLIMITED
-- (never cut, never bonus). Nothing here fires outreach at deploy — the mask +
-- lapsed_at backfills pre-arm every already-crossed rung so no notice/campaign
-- blasts when the new code goes live.

-- FIRST-RUN GUARD. infra runner re-applies EVERY .sql file on every deploy (no ledger), so the
-- one-time backfills below (grace cap, cycle anchor, lapsed_at, notice mask) must NOT re-run once
-- the live ladder owns those columns (re-running would overwrite real anchors/masks and silently
-- suppress notices). The flag is computed BEFORE the ALTERs: '1' only when renewal_notice_mask
-- does not exist yet. The whole file is one implicit transaction, so a failed first run leaves the
-- column absent and the next run is again a first run.
SELECT set_config('afrows.m0070_first_run',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'customer_accounts'
                      AND column_name = 'renewal_notice_mask')
       THEN '0' ELSE '1' END, false);

-- =====================================================================
-- 1. customer_accounts: capped grace, cycle anchor, notice mask, lapse mark
-- =====================================================================
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS grace_cap_bytes bigint;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS grace_blocked_until timestamptz;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS cycle_start_used_bytes bigint;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS renewal_notice_mask smallint NOT NULL DEFAULT 0;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS lapsed_at timestamptz;

-- HARD GATE (must run BEFORE the new fail-closed grace enforcement goes live):
-- the enforcement fragment only allows overage while
--   used_bytes < quota_limit_bytes + COALESCE(grace_cap_bytes, 0)
-- so a NULL cap means grace grants ZERO extra bytes. Backfill a cap for every
-- account currently in grace (grace_until > now) so deploy does not cut them.
-- Cap = min(10% of plan, 3 GB), matching decideGrace in src/billing/grace.ts.
UPDATE customer_accounts
SET grace_cap_bytes = LEAST(floor(quota_limit_bytes::numeric * 10 / 100)::bigint, 3000000000)
WHERE grace_until IS NOT NULL
  AND grace_until > now()
  AND quota_limit_bytes IS NOT NULL
  AND grace_cap_bytes IS NULL
  AND current_setting('afrows.m0070_first_run', true) = '1';

-- cycle_start_used_bytes: the used-byte anchor at the start of the current cycle.
-- Estimate from the most recent approved PAID top-up volume:
--   LEAST(used, GREATEST(0, quota - latest_paid_volume)); else 0 / unlimited -> 0.
UPDATE customer_accounts SET cycle_start_used_bytes = 0 WHERE cycle_start_used_bytes IS NULL;
UPDATE customer_accounts ca
SET cycle_start_used_bytes = LEAST(ca.used_bytes, GREATEST(0, ca.quota_limit_bytes - latest.volume_bytes))
FROM (
  SELECT DISTINCT ON (t.customer_account_id)
         t.customer_account_id AS account_id,
         vp.volume_bytes
  FROM telegram_topup_requests t
  JOIN volume_packages vp ON vp.id = t.volume_package_id
  WHERE t.status = 'approved'
    AND t.amount_minor IS NOT NULL
    AND t.amount_minor > 0
  ORDER BY t.customer_account_id, t.created_at DESC
) latest
WHERE ca.id = latest.account_id
  AND ca.quota_limit_bytes IS NOT NULL
  AND current_setting('afrows.m0070_first_run', true) = '1';

-- lapsed_at: when the account last fell out of good standing (expired or exhausted),
-- NOT while it is in grace (C3 guard). expires_at when the month is past, else the
-- last-activity timestamp for an exhausted account.
UPDATE customer_accounts
SET lapsed_at = CASE
      WHEN expires_at IS NOT NULL AND expires_at <= now() THEN expires_at
      ELSE updated_at
    END
WHERE deleted_at IS NULL
  AND lapsed_at IS NULL
  AND quota_limit_bytes IS NOT NULL
  AND (
    (expires_at IS NOT NULL AND expires_at <= now())
    OR used_bytes >= quota_limit_bytes
  )
  AND NOT (grace_until IS NOT NULL AND grace_until > now())
  AND current_setting('afrows.m0070_first_run', true) = '1';

-- renewal_notice_mask: pre-arm EVERY rung already crossed so no notice blasts at
-- deploy, and pre-arm the win-back bits (64|128|256 = 448) for every lapsed account
-- so no dormant campaign fires. Bits: 1=80% 2=95% 4=exhausted 8=T-3d 16=T-1d
-- 32=grace-cap 64/128/256=win-back d14/d30/d60. cyclePct = (used-cycleStart) /
-- (quota-cycleStart); guarded against a zero/negative denominator.
UPDATE customer_accounts ca
SET renewal_notice_mask =
    (CASE WHEN ca.quota_limit_bytes IS NOT NULL
            AND (ca.quota_limit_bytes - ca.cycle_start_used_bytes) > 0
            AND (ca.used_bytes - ca.cycle_start_used_bytes) * 100
                >= (ca.quota_limit_bytes - ca.cycle_start_used_bytes) * 80
          THEN 1 ELSE 0 END)
  | (CASE WHEN ca.quota_limit_bytes IS NOT NULL
            AND (ca.quota_limit_bytes - ca.cycle_start_used_bytes) > 0
            AND (ca.used_bytes - ca.cycle_start_used_bytes) * 100
                >= (ca.quota_limit_bytes - ca.cycle_start_used_bytes) * 95
          THEN 2 ELSE 0 END)
  | (CASE WHEN ca.quota_limit_bytes IS NOT NULL AND ca.used_bytes >= ca.quota_limit_bytes
          THEN 4 ELSE 0 END)
  | (CASE WHEN ca.expires_at IS NOT NULL AND ca.expires_at <= now() + interval '3 days'
          THEN 8 ELSE 0 END)
  | (CASE WHEN ca.expires_at IS NOT NULL AND ca.expires_at <= now() + interval '1 day'
          THEN 16 ELSE 0 END)
  | (CASE WHEN ca.grace_until IS NOT NULL AND ca.grace_until > now()
          THEN 32 ELSE 0 END)
  | (CASE WHEN ca.lapsed_at IS NOT NULL THEN 448 ELSE 0 END)
WHERE ca.deleted_at IS NULL
  AND current_setting('afrows.m0070_first_run', true) = '1';

-- =====================================================================
-- 2. telegram_topup_requests: decision snapshot frozen at receipt upload (C4)
-- =====================================================================
ALTER TABLE telegram_topup_requests ADD COLUMN IF NOT EXISTS snap_used_bytes bigint;
ALTER TABLE telegram_topup_requests ADD COLUMN IF NOT EXISTS snap_quota_limit_bytes bigint;
ALTER TABLE telegram_topup_requests ADD COLUMN IF NOT EXISTS snap_cycle_start_used_bytes bigint;
ALTER TABLE telegram_topup_requests ADD COLUMN IF NOT EXISTS snap_expires_at timestamptz;
ALTER TABLE telegram_topup_requests ADD COLUMN IF NOT EXISTS snap_lapsed_at timestamptz;

-- =====================================================================
-- 3. bonus_grants: once-ever / per-request ledger for the buyer bonuses (C5)
-- =====================================================================
CREATE TABLE IF NOT EXISTS bonus_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('first_purchase', 'winback', 'early_renewal', 'invitee_referral')),
  topup_request_id uuid REFERENCES telegram_topup_requests(id) ON DELETE SET NULL,
  base_bytes bigint NOT NULL,
  pct smallint,
  bonus_bytes bigint NOT NULL,
  status text NOT NULL DEFAULT 'granted' CHECK (status IN ('granted', 'pending_review', 'reversed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- At most one grant of a kind per top-up request (idempotent re-approval).
CREATE UNIQUE INDEX IF NOT EXISTS bonus_grants_request_kind_unique
  ON bonus_grants (topup_request_id, kind)
  WHERE topup_request_id IS NOT NULL;

-- Once-EVER per account for the first-purchase and invitee-referral kinds.
CREATE UNIQUE INDEX IF NOT EXISTS bonus_grants_account_once_ever_unique
  ON bonus_grants (customer_account_id, kind)
  WHERE kind IN ('first_purchase', 'invitee_referral');

-- Rolling-window lookups (win-back once-per-90-days, audit).
CREATE INDEX IF NOT EXISTS bonus_grants_account_kind_created_idx
  ON bonus_grants (customer_account_id, kind, created_at);
