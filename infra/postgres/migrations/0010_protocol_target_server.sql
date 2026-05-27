ALTER TABLE protocol_setups
  ADD COLUMN IF NOT EXISTS target_server_id uuid REFERENCES servers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS protocol_setups_target_server_idx
  ON protocol_setups (target_server_id);
