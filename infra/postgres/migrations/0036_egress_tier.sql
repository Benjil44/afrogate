-- Per-account egress tier. Drives both routing and pricing:
--   normal (default) -> foreign egress via Germany/relay pool
--   gaming           -> foreign egress via the village Starlink (via-village), low ping/jitter
-- The egress-mode reconciler routes gaming accounts' WireGuard source IPs to the
-- via-village outbound; the dashboard lets the super-admin set the tier + price.
ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS egress_tier text NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_accounts_egress_tier_chk'
  ) THEN
    ALTER TABLE customer_accounts
      ADD CONSTRAINT customer_accounts_egress_tier_chk
      CHECK (egress_tier IN ('normal', 'gaming'));
  END IF;
END $$;
