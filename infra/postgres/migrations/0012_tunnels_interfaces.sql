CREATE TABLE IF NOT EXISTS server_interfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  operator text,
  kind text NOT NULL DEFAULT 'ethernet',
  status text NOT NULL DEFAULT 'unknown',
  mac_address text,
  address_cidr text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_interfaces_server_name_unique UNIQUE (server_id, name)
);

CREATE INDEX IF NOT EXISTS server_interfaces_server_idx
  ON server_interfaces (server_id);
CREATE INDEX IF NOT EXISTS server_interfaces_operator_idx
  ON server_interfaces (operator);
CREATE INDEX IF NOT EXISTS server_interfaces_status_idx
  ON server_interfaces (status);

CREATE TABLE IF NOT EXISTS tunnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'wireguard',
  remote_endpoint text,
  interface_name text,
  local_interface_id uuid REFERENCES server_interfaces(id) ON DELETE SET NULL,
  route_group text NOT NULL DEFAULT 'main',
  status text NOT NULL DEFAULT 'unknown',
  lockable boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tunnels_server_name_unique UNIQUE (server_id, name)
);

CREATE INDEX IF NOT EXISTS tunnels_server_idx
  ON tunnels (server_id);
CREATE INDEX IF NOT EXISTS tunnels_route_status_idx
  ON tunnels (route_group, status);
CREATE INDEX IF NOT EXISTS tunnels_local_interface_idx
  ON tunnels (local_interface_id);
