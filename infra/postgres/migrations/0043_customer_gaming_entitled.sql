-- Admin-controlled entitlement: whether a customer account is ALLOWED to use the
-- gaming egress tier (billed feature). The active on/off is customer_accounts.egress_tier
-- ('gaming'|'normal'); the mobile app only shows the Game-mode toggle when entitled.
ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS gaming_entitled boolean NOT NULL DEFAULT false;
