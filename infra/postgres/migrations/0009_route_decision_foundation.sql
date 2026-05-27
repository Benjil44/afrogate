CREATE TABLE IF NOT EXISTS route_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_group text NOT NULL DEFAULT 'main',
  assignment_key text NOT NULL DEFAULT 'default',
  assignment_label text,
  current_outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  locked_outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  auto_route_enabled boolean NOT NULL DEFAULT true,
  route_locked boolean NOT NULL DEFAULT false,
  protocol_profile text NOT NULL DEFAULT 'balanced',
  speed_profile text NOT NULL DEFAULT 'balanced',
  hysteresis_score_delta integer NOT NULL DEFAULT 15,
  cooldown_seconds integer NOT NULL DEFAULT 180,
  cooldown_until timestamptz,
  last_decision_event_id uuid,
  last_decision_at timestamptz,
  decision_state text NOT NULL DEFAULT 'monitoring',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS route_assignments_route_key_idx
  ON route_assignments (route_group, assignment_key);
CREATE INDEX IF NOT EXISTS route_assignments_current_outbound_idx
  ON route_assignments (current_outbound_id);
CREATE INDEX IF NOT EXISTS route_assignments_locked_outbound_idx
  ON route_assignments (locked_outbound_id);
CREATE INDEX IF NOT EXISTS route_assignments_cooldown_idx
  ON route_assignments (route_group, cooldown_until);

CREATE TABLE IF NOT EXISTS route_decision_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_group text NOT NULL,
  assignment_key text NOT NULL DEFAULT 'default',
  decision_kind text NOT NULL,
  decision_state text NOT NULL,
  score_profile text,
  from_outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  to_outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  from_score integer,
  to_score integer,
  score_delta integer,
  hysteresis_score_delta integer,
  cooldown_until timestamptz,
  route_locked boolean NOT NULL DEFAULT false,
  auto_route_enabled boolean NOT NULL DEFAULT true,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS route_decision_events_route_created_idx
  ON route_decision_events (route_group, created_at DESC);
CREATE INDEX IF NOT EXISTS route_decision_events_assignment_created_idx
  ON route_decision_events (route_group, assignment_key, created_at DESC);
CREATE INDEX IF NOT EXISTS route_decision_events_to_outbound_idx
  ON route_decision_events (to_outbound_id);
