CREATE TABLE IF NOT EXISTS client_subscription_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id uuid NOT NULL REFERENCES client_configs(id) ON DELETE CASCADE,
  outbound_id uuid NOT NULL REFERENCES outbounds(id) ON DELETE CASCADE,
  name text,
  protocol text NOT NULL,
  encrypted_payload text NOT NULL,
  key_id text NOT NULL,
  fingerprint text,
  public_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_by text,
  last_used_at timestamptz,
  last_rotated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_subscription_credentials_protocol_check
    CHECK (protocol IN ('wireguard', 'vless', 'l2tp', 'ikev2')),
  CONSTRAINT client_subscription_credentials_status_check
    CHECK (status IN ('active', 'revoked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS client_subscription_credentials_active_unique
  ON client_subscription_credentials (client_config_id, outbound_id, protocol)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS client_subscription_credentials_client_idx
  ON client_subscription_credentials (client_config_id, created_at DESC);

CREATE INDEX IF NOT EXISTS client_subscription_credentials_outbound_idx
  ON client_subscription_credentials (outbound_id);

CREATE INDEX IF NOT EXISTS client_subscription_credentials_status_idx
  ON client_subscription_credentials (status, revoked_at);
