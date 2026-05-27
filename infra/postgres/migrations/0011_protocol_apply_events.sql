CREATE TABLE IF NOT EXISTS protocol_apply_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_setup_id uuid NOT NULL REFERENCES protocol_setups(id) ON DELETE CASCADE,
  outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  target_server_id uuid REFERENCES servers(id) ON DELETE SET NULL,
  apply_mode text NOT NULL DEFAULT 'dryRun',
  apply_status text NOT NULL DEFAULT 'recorded',
  feature_flag_enabled boolean NOT NULL DEFAULT false,
  adapter_implemented boolean NOT NULL DEFAULT false,
  can_execute boolean NOT NULL DEFAULT false,
  command_count integer NOT NULL DEFAULT 0,
  config_change_count integer NOT NULL DEFAULT 0,
  secret_safe boolean NOT NULL DEFAULT true,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  dry_run_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS protocol_apply_events_setup_created_idx
  ON protocol_apply_events (protocol_setup_id, created_at DESC);
CREATE INDEX IF NOT EXISTS protocol_apply_events_target_created_idx
  ON protocol_apply_events (target_server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS protocol_apply_events_outbound_idx
  ON protocol_apply_events (outbound_id);
