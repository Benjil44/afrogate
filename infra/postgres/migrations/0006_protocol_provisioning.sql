ALTER TABLE protocol_setups
  ADD COLUMN IF NOT EXISTS provisioned_outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz;

CREATE INDEX IF NOT EXISTS protocol_setups_provisioned_outbound_idx
  ON protocol_setups (provisioned_outbound_id);
