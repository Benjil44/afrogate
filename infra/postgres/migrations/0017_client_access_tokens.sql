CREATE TABLE IF NOT EXISTS client_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id uuid NOT NULL REFERENCES client_configs(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '["client:read", "route:write"]'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS client_access_tokens_hash_unique
  ON client_access_tokens (token_hash);

CREATE INDEX IF NOT EXISTS client_access_tokens_client_idx
  ON client_access_tokens (client_config_id, created_at);

CREATE INDEX IF NOT EXISTS client_access_tokens_active_idx
  ON client_access_tokens (client_config_id)
  WHERE revoked_at IS NULL;
