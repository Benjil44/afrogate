CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL,
  hostname text,
  platform text,
  status text NOT NULL DEFAULT 'unknown',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS servers_external_id_idx ON servers (external_id);
CREATE INDEX IF NOT EXISTS servers_status_idx ON servers (status);

CREATE TABLE IF NOT EXISTS server_metrics (
  id bigserial PRIMARY KEY,
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL DEFAULT now(),
  cpu_percent real,
  ram_percent real,
  disk_free_percent real,
  ping_ms real,
  jitter_ms real,
  packet_loss_percent real,
  health_score integer NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS server_metrics_server_observed_idx ON server_metrics (server_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS server_metrics_observed_idx ON server_metrics (observed_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  source_type text NOT NULL,
  source_id text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS alerts_status_severity_idx ON alerts (status, severity);
CREATE INDEX IF NOT EXISTS alerts_source_idx ON alerts (source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS alerts_open_source_title_idx
  ON alerts (source_type, source_id, title)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id text,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_target_idx ON audit_logs (target_type, target_id);

CREATE TABLE IF NOT EXISTS agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '["metrics:write"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_tokens_token_hash_idx ON agent_tokens (token_hash);
CREATE INDEX IF NOT EXISTS agent_tokens_server_idx ON agent_tokens (server_id);
