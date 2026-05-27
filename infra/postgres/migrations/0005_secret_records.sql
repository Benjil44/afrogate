CREATE TABLE IF NOT EXISTS secret_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_ref text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  scope text NOT NULL DEFAULT 'settings',
  route_group text,
  protocol text,
  encrypted_payload text NOT NULL,
  key_id text NOT NULL,
  fingerprint text,
  status text NOT NULL DEFAULT 'active',
  created_by text,
  last_used_at timestamptz,
  last_rotated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS secret_records_ref_idx
  ON secret_records (secret_ref);
CREATE INDEX IF NOT EXISTS secret_records_scope_idx
  ON secret_records (scope, route_group);
CREATE INDEX IF NOT EXISTS secret_records_status_idx
  ON secret_records (status);
CREATE INDEX IF NOT EXISTS secret_records_protocol_idx
  ON secret_records (protocol);
