-- Per-tunnel billing rates for MikroTik WireGuard peers (e.g. price a friend pays
-- per GB on the village). Keyed by (router, peer); cost = usage_GB * price_per_gb,
-- computed live from mikrotik_wg_samples in getWgUsage.
CREATE TABLE IF NOT EXISTS mikrotik_wg_rates (
  router_id     text NOT NULL,
  peer_key      text NOT NULL,
  label         text,
  price_per_gb  numeric(14,4) NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'IRT',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (router_id, peer_key)
);
