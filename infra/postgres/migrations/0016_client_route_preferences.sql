CREATE TABLE IF NOT EXISTS client_route_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id uuid NOT NULL REFERENCES client_configs(id) ON DELETE CASCADE,
  route_group text NOT NULL DEFAULT 'main',
  mode text NOT NULL DEFAULT 'auto',
  detected_country_code text,
  detected_country_source text,
  preferred_exit_country_code text,
  preferred_outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  score_profile text NOT NULL DEFAULT 'balanced',
  auto_detect_country boolean NOT NULL DEFAULT true,
  allow_client_override boolean NOT NULL DEFAULT true,
  route_locked boolean NOT NULL DEFAULT false,
  sticky_session_protection boolean NOT NULL DEFAULT true,
  last_detected_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_route_preferences_mode_check
    CHECK (mode IN ('auto', 'country', 'outbound')),
  CONSTRAINT client_route_preferences_detection_source_check
    CHECK (
      detected_country_source IS NULL
      OR detected_country_source IN ('client_app', 'edge_ip', 'admin', 'unknown')
    ),
  CONSTRAINT client_route_preferences_score_profile_check
    CHECK (score_profile IN ('balanced', 'stability', 'throughput', 'gaming', 'tcp', 'udp', 'quic', 'dns', 'wireguard')),
  CONSTRAINT client_route_preferences_detected_country_check
    CHECK (detected_country_code IS NULL OR detected_country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT client_route_preferences_preferred_country_check
    CHECK (preferred_exit_country_code IS NULL OR preferred_exit_country_code ~ '^[A-Z]{2}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS client_route_preferences_client_route_unique
  ON client_route_preferences (client_config_id, route_group);

CREATE INDEX IF NOT EXISTS client_route_preferences_preferred_country_idx
  ON client_route_preferences (route_group, preferred_exit_country_code);

CREATE INDEX IF NOT EXISTS client_route_preferences_detected_country_idx
  ON client_route_preferences (route_group, detected_country_code);

CREATE INDEX IF NOT EXISTS client_route_preferences_preferred_outbound_idx
  ON client_route_preferences (preferred_outbound_id);
