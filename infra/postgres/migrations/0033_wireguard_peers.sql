-- WireGuard peers: one row per client_config that is delivered over kernel
-- WireGuard (wg0). The backend (unprivileged) owns this table — it generates
-- the keypair, allocates the client address, and stores the encrypted private
-- key so it can re-render the .conf on each subscription fetch. A separate root
-- reconciler reads `desired_state` to apply peers to wg0 (`wg set`) and writes
-- back live usage (`wg show wg0 dump`).

CREATE TABLE IF NOT EXISTS wireguard_peers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id uuid NOT NULL REFERENCES client_configs(id) ON DELETE CASCADE,
  interface text NOT NULL DEFAULT 'wg0',
  client_public_key text NOT NULL,
  -- AES-256-GCM envelope (SecretVaultService) of { clientPrivateKey }
  encrypted_private_key text NOT NULL,
  client_address text NOT NULL,            -- e.g. 10.8.0.16/32
  preshared_key text,                      -- optional, plaintext psk (null = none)
  rx_bytes bigint NOT NULL DEFAULT 0,      -- last metered receive (server->client downlink)
  tx_bytes bigint NOT NULL DEFAULT 0,      -- last metered transmit (client->server uplink)
  last_handshake_at timestamptz,           -- most recent handshake (NULL = never)
  desired_state text NOT NULL DEFAULT 'present',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wireguard_peers_desired_state_check
    CHECK (desired_state IN ('present', 'absent')),
  CONSTRAINT wireguard_peers_rx_nonnegative CHECK (rx_bytes >= 0),
  CONSTRAINT wireguard_peers_tx_nonnegative CHECK (tx_bytes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS wireguard_peers_client_config_unique
  ON wireguard_peers (client_config_id);

CREATE UNIQUE INDEX IF NOT EXISTS wireguard_peers_pubkey_unique
  ON wireguard_peers (interface, client_public_key);

CREATE UNIQUE INDEX IF NOT EXISTS wireguard_peers_address_unique
  ON wireguard_peers (interface, client_address);

CREATE INDEX IF NOT EXISTS wireguard_peers_desired_state_idx
  ON wireguard_peers (interface, desired_state);
