CREATE TABLE IF NOT EXISTS protocol_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  protocol text NOT NULL,
  profile text NOT NULL DEFAULT 'balanced',
  route_group text NOT NULL DEFAULT 'main',
  port integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS protocol_setups_route_name_idx
  ON protocol_setups (route_group, name);
CREATE INDEX IF NOT EXISTS protocol_setups_protocol_idx
  ON protocol_setups (protocol);
CREATE INDEX IF NOT EXISTS protocol_setups_status_idx
  ON protocol_setups (status);

CREATE TABLE IF NOT EXISTS route_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_group text NOT NULL,
  mode text NOT NULL DEFAULT 'automatic',
  selected_outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  load_balance_strategy text NOT NULL DEFAULT 'balanced',
  protocol_profile text NOT NULL DEFAULT 'balanced',
  speed_profile text NOT NULL DEFAULT 'balanced',
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS route_settings_route_group_idx
  ON route_settings (route_group);
CREATE INDEX IF NOT EXISTS route_settings_mode_idx
  ON route_settings (mode);
CREATE INDEX IF NOT EXISTS route_settings_selected_outbound_idx
  ON route_settings (selected_outbound_id);
