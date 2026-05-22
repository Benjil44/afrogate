ALTER TABLE server_metrics
  ADD COLUMN IF NOT EXISTS inbound_bps real,
  ADD COLUMN IF NOT EXISTS outbound_bps real;
