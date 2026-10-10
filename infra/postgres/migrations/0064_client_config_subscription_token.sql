-- Public refreshable subscription URL per client config (GET /sub/:token).
-- The token itself is never stored: it is HMAC(AFROWS_SUBSCRIPTION_SECRET,
-- "<client_config_id>:<subscription_token_version>") computed in the backend.
-- Only sha256(token) is kept here for lookup; it is filled lazily by the backend
-- (no data mutation in this file, so re-running it on every deploy is a no-op).
-- Rotation bumps subscription_token_version and rewrites the hash in one UPDATE.
ALTER TABLE client_configs
  ADD COLUMN IF NOT EXISTS subscription_token_version integer NOT NULL DEFAULT 1;

ALTER TABLE client_configs
  ADD COLUMN IF NOT EXISTS subscription_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS client_configs_subscription_token_hash_key
  ON client_configs (subscription_token_hash)
  WHERE subscription_token_hash IS NOT NULL;
