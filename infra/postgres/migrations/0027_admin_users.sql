CREATE TABLE IF NOT EXISTS admin_users (
  id text PRIMARY KEY,
  username text NOT NULL,
  username_normalized text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'database',
  created_by text,
  updated_by text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_role_check
    CHECK (role IN ('owner', 'admin', 'supervisor', 'support', 'auditor')),
  CONSTRAINT admin_users_status_check
    CHECK (status IN ('active', 'disabled')),
  CONSTRAINT admin_users_source_check
    CHECK (source = 'database'),
  CONSTRAINT admin_users_no_superadmin_id_check
    CHECK (id <> 'superadmin' AND role <> 'superadmin')
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_normalized_idx
  ON admin_users (username_normalized);

CREATE INDEX IF NOT EXISTS admin_users_role_status_idx
  ON admin_users (role, status);

CREATE INDEX IF NOT EXISTS admin_users_created_at_idx
  ON admin_users (created_at DESC);
