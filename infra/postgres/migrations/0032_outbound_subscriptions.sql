-- Outbound subscriptions: one subscription URL expands into many child outbounds.
-- Each fetched config is stored as a normal `outbounds` row linked via
-- subscription_id, so it reuses test/health/enable/edit/routing. subscription_key
-- is a stable per-config identity (address|port|uuid|...) used to upsert on refresh.

CREATE TABLE IF NOT EXISTS outbound_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  route_group text NOT NULL DEFAULT 'default',
  profile_title text,
  update_interval_hours integer,
  userinfo jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  config_count integer NOT NULL DEFAULT 0,
  last_fetched_at timestamptz,
  last_status text NOT NULL DEFAULT 'unknown',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outbounds
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES outbound_subscriptions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subscription_key text;

CREATE INDEX IF NOT EXISTS outbounds_subscription_idx ON outbounds (subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS outbounds_subscription_key_uidx
  ON outbounds (subscription_id, subscription_key)
  WHERE subscription_id IS NOT NULL;
