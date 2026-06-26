-- Per-config last-seen, stamped by the metering loops (xray + WireGuard) when a
-- positive usage delta is observed. Drives the "Last connected" column without a
-- usage-event row per tick. NULL = never seen since this column landed.
ALTER TABLE client_configs
  ADD COLUMN IF NOT EXISTS last_connected_at timestamptz;
