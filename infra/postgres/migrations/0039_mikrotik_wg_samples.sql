-- Periodic snapshots of each MikroTik's WireGuard peer byte counters, so the
-- operator can see per-tunnel data usage over time (e.g. bill the friends' usage
-- on the village). The sampler (RouterUsageSamplerService) inserts one row per
-- peer per tick; usage over a window = reset-aware sum of consecutive deltas.
CREATE TABLE IF NOT EXISTS mikrotik_wg_samples (
  id         bigserial PRIMARY KEY,
  router_id  text NOT NULL,
  peer_key   text NOT NULL,
  iface      text,
  comment    text,
  rx_bytes   bigint NOT NULL DEFAULT 0,
  tx_bytes   bigint NOT NULL DEFAULT 0,
  sampled_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mikrotik_wg_samples_lookup
  ON mikrotik_wg_samples (router_id, peer_key, sampled_at);
