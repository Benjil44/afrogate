-- Per-tier pricing (super-admin editable in the panel). The tier itself lives on
-- customer_accounts.egress_tier (migration 0036); this holds the price for each tier.
CREATE TABLE IF NOT EXISTS egress_tier_prices (
  tier       text PRIMARY KEY,
  price      numeric(14,2) NOT NULL DEFAULT 0,
  currency   text NOT NULL DEFAULT 'IRT',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT egress_tier_prices_tier_chk CHECK (tier IN ('normal', 'gaming'))
);

INSERT INTO egress_tier_prices (tier, price) VALUES ('normal', 0), ('gaming', 0)
ON CONFLICT (tier) DO NOTHING;
