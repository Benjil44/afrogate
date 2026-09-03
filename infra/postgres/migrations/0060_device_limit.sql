-- 0060_device_limit.sql
-- Per-VLESS concurrent-device (source-IP) limiting.
--
-- Xray already tracks online source-IPs per user (policy.statsUserOnline=true).
-- The DeviceLimitService polls that; when a client_config's live distinct-IP
-- count exceeds its limit, it sets client_configs.blocked_until and kicks the
-- user from xray. The provisioning reconcile is taught to skip still-blocked
-- users (see xray-provisioning.service.ts) so the block holds until the cooldown
-- elapses, after which the normal reconcile auto-reconnects them.

-- Per-customer limit. NULL = use the global default (AFROWS_DEVICE_LIMIT_DEFAULT,
-- itself defaulting to 1). 0 = exempt / unlimited (for a legitimate multi-device
-- customer). Applies to EACH of the customer's VLESS configs independently.
ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS max_concurrent_ips integer;

-- Temporary device-limit block on a single VLESS config. While blocked_until is
-- in the future the reconcile/sweep queries will not re-add the user to xray.
ALTER TABLE client_configs
  ADD COLUMN IF NOT EXISTS blocked_until timestamptz;
ALTER TABLE client_configs
  ADD COLUMN IF NOT EXISTS block_reason text;

CREATE INDEX IF NOT EXISTS idx_client_configs_blocked_until
  ON client_configs (blocked_until)
  WHERE blocked_until IS NOT NULL;

-- Audit log of detected concurrent-IP violations (both observe and enforce modes).
CREATE TABLE IF NOT EXISTS client_ip_violations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid REFERENCES customer_accounts (id) ON DELETE CASCADE,
  client_config_id    uuid,
  email               text,
  ip_count            integer NOT NULL,
  limit_value         integer NOT NULL,
  ips                 jsonb,
  mode                text NOT NULL,          -- 'observe' | 'enforce'
  action              text NOT NULL,          -- 'logged' | 'blocked'
  detected_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_ip_violations_ca_time
  ON client_ip_violations (customer_account_id, detected_at DESC);
