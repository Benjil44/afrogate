-- Per-(config, source IP) device sightings for F1 device/IP visibility.
-- Fed by the access-log parser (VLESS direct-TCP) and the WireGuard reconciler
-- (peer endpoint). Pruned to a short retention by the parser service.
CREATE TABLE IF NOT EXISTS client_device_sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id uuid NOT NULL REFERENCES client_configs(id) ON DELETE CASCADE,
  source_ip text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  hits bigint NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS client_device_sightings_uniq
  ON client_device_sightings (client_config_id, source_ip);
CREATE INDEX IF NOT EXISTS client_device_sightings_last_seen_idx
  ON client_device_sightings (last_seen_at);

-- WireGuard peer's last-seen endpoint IP (captured by the root reconciler from
-- `wg show dump`), so WG users' device IPs feed the sightings table.
ALTER TABLE wireguard_peers
  ADD COLUMN IF NOT EXISTS endpoint_ip text;
