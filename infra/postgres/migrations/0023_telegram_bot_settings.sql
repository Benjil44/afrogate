CREATE TABLE IF NOT EXISTS telegram_bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL DEFAULT 'default',
  bot_token_secret_ref text,
  webhook_secret_ref text,
  alert_chat_id text,
  allowed_admin_chat_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  alerts_enabled boolean NOT NULL DEFAULT false,
  commands_enabled boolean NOT NULL DEFAULT false,
  bot_id text,
  bot_username text,
  bot_first_name text,
  last_test_status text,
  last_tested_at timestamptz,
  last_test_error_code text,
  last_test_duration_ms integer,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_bot_settings_key_idx
  ON telegram_bot_settings (setting_key);
CREATE INDEX IF NOT EXISTS telegram_bot_settings_token_ref_idx
  ON telegram_bot_settings (bot_token_secret_ref);
CREATE INDEX IF NOT EXISTS telegram_bot_settings_webhook_ref_idx
  ON telegram_bot_settings (webhook_secret_ref);
