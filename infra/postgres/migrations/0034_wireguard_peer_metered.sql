-- Track the last-metered absolute counters per WireGuard peer so the backend can
-- account usage as DELTAS (matching the VLESS metering model) and roll them into
-- client_configs + customer_accounts used_bytes for quota enforcement.
ALTER TABLE wireguard_peers
  ADD COLUMN IF NOT EXISTS metered_rx_bytes bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metered_tx_bytes bigint NOT NULL DEFAULT 0;

-- Seed last-metered = current for peers that already have usage, so the first
-- metering tick doesn't retroactively bill historical bytes. Guarded so this is
-- safe to re-run every deploy (the runner re-applies all migrations): it only
-- touches rows still at the default 0 that already have counters.
UPDATE wireguard_peers
SET metered_rx_bytes = rx_bytes, metered_tx_bytes = tx_bytes
WHERE metered_rx_bytes = 0 AND metered_tx_bytes = 0 AND (rx_bytes > 0 OR tx_bytes > 0);
