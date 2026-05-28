CREATE TABLE IF NOT EXISTS rewarded_ad_settings (
  setting_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  reward_bytes bigint NOT NULL DEFAULT 104857600,
  daily_limit integer NOT NULL DEFAULT 20,
  provider text NOT NULL DEFAULT 'mvp_rewarded_ad',
  verification_mode text NOT NULL DEFAULT 'client_callback_mvp',
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rewarded_ad_settings_reward_positive
    CHECK (reward_bytes > 0),
  CONSTRAINT rewarded_ad_settings_daily_limit_nonnegative
    CHECK (daily_limit >= 0),
  CONSTRAINT rewarded_ad_settings_provider_not_empty
    CHECK (provider <> ''),
  CONSTRAINT rewarded_ad_settings_verification_mode_not_empty
    CHECK (verification_mode <> '')
);

INSERT INTO rewarded_ad_settings (setting_key)
VALUES ('default')
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS rewarded_ad_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
  client_config_id uuid NOT NULL REFERENCES client_configs(id) ON DELETE RESTRICT,
  grant_day date NOT NULL,
  daily_grant_number integer NOT NULL,
  provider text NOT NULL DEFAULT 'mvp_rewarded_ad',
  ad_session_id text,
  idempotency_key text NOT NULL,
  reward_bytes bigint NOT NULL,
  account_quota_before_bytes bigint,
  account_quota_after_bytes bigint NOT NULL,
  client_quota_before_bytes bigint,
  client_quota_after_bytes bigint,
  verification_mode text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rewarded_ad_grants_daily_number_positive
    CHECK (daily_grant_number > 0),
  CONSTRAINT rewarded_ad_grants_reward_positive
    CHECK (reward_bytes > 0),
  CONSTRAINT rewarded_ad_grants_account_before_nonnegative
    CHECK (account_quota_before_bytes IS NULL OR account_quota_before_bytes >= 0),
  CONSTRAINT rewarded_ad_grants_account_after_nonnegative
    CHECK (account_quota_after_bytes >= 0),
  CONSTRAINT rewarded_ad_grants_client_before_nonnegative
    CHECK (client_quota_before_bytes IS NULL OR client_quota_before_bytes >= 0),
  CONSTRAINT rewarded_ad_grants_client_after_nonnegative
    CHECK (client_quota_after_bytes IS NULL OR client_quota_after_bytes >= 0),
  CONSTRAINT rewarded_ad_grants_provider_not_empty
    CHECK (provider <> ''),
  CONSTRAINT rewarded_ad_grants_idempotency_not_empty
    CHECK (idempotency_key <> ''),
  CONSTRAINT rewarded_ad_grants_verification_mode_not_empty
    CHECK (verification_mode <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS rewarded_ad_grants_client_provider_idempotency_unique
  ON rewarded_ad_grants (client_config_id, provider, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS rewarded_ad_grants_provider_session_unique
  ON rewarded_ad_grants (provider, ad_session_id)
  WHERE ad_session_id IS NOT NULL AND ad_session_id <> '';

CREATE INDEX IF NOT EXISTS rewarded_ad_grants_client_day_created_idx
  ON rewarded_ad_grants (client_config_id, grant_day, created_at DESC);

CREATE INDEX IF NOT EXISTS rewarded_ad_grants_account_created_idx
  ON rewarded_ad_grants (customer_account_id, created_at DESC);

UPDATE client_access_tokens
SET scopes = scopes || '["reward:claim"]'::jsonb
WHERE NOT scopes ? 'reward:claim';
