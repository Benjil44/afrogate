ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS server_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL,
  encrypted_payload text NOT NULL,
  key_id text NOT NULL,
  fingerprint text,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  last_rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS server_credentials_server_idx ON server_credentials (server_id);
CREATE INDEX IF NOT EXISTS server_credentials_status_idx ON server_credentials (status);

CREATE TABLE IF NOT EXISTS server_access_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  address text NOT NULL,
  ssh_port integer NOT NULL DEFAULT 22,
  username text NOT NULL DEFAULT 'afrogate',
  access_method text NOT NULL DEFAULT 'ssh_key',
  credential_ref text,
  bootstrap_state text NOT NULL DEFAULT 'not_started',
  last_tested_at timestamptz,
  last_test_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS server_access_profiles_server_idx ON server_access_profiles (server_id);
CREATE INDEX IF NOT EXISTS server_access_profiles_bootstrap_state_idx ON server_access_profiles (bootstrap_state);

CREATE TABLE IF NOT EXISTS outbounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  route_group text NOT NULL DEFAULT 'default',
  priority integer NOT NULL DEFAULT 1000,
  enabled boolean NOT NULL DEFAULT true,
  maintenance_mode boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref text,
  health_status text NOT NULL DEFAULT 'unknown',
  health_interval_seconds integer NOT NULL DEFAULT 60,
  fail_threshold integer NOT NULL DEFAULT 3,
  recovery_threshold integer NOT NULL DEFAULT 3,
  cooldown_seconds integer NOT NULL DEFAULT 120,
  weight integer NOT NULL DEFAULT 100,
  max_users integer,
  last_checked_at timestamptz,
  last_healthy_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbounds_server_idx ON outbounds (server_id);
CREATE INDEX IF NOT EXISTS outbounds_route_priority_idx ON outbounds (route_group, priority);
CREATE INDEX IF NOT EXISTS outbounds_enabled_idx ON outbounds (enabled);
CREATE INDEX IF NOT EXISTS outbounds_health_status_idx ON outbounds (health_status);

CREATE TABLE IF NOT EXISTS outbound_health_checks (
  id bigserial PRIMARY KEY,
  outbound_id uuid NOT NULL REFERENCES outbounds(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  latency_ms real,
  jitter_ms real,
  packet_loss_percent real,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS outbound_health_checks_outbound_checked_idx
  ON outbound_health_checks (outbound_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS outbound_health_checks_status_checked_idx
  ON outbound_health_checks (status, checked_at DESC);

CREATE TABLE IF NOT EXISTS route_failover_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_group text NOT NULL,
  from_outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  to_outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  reason text NOT NULL,
  trigger_metric jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS route_failover_events_route_created_idx
  ON route_failover_events (route_group, created_at DESC);
CREATE INDEX IF NOT EXISTS route_failover_events_to_outbound_idx
  ON route_failover_events (to_outbound_id);
