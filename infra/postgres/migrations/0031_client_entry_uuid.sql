-- Per-user entry identity for the native Afrows xray inbound (afrows-in).
-- Distinct from the egress credentials in client_subscription_credentials.
ALTER TABLE client_configs
  ADD COLUMN IF NOT EXISTS entry_uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS entry_provisioned_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS client_configs_entry_uuid_key ON client_configs (entry_uuid);
