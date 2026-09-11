-- trial_quota_bytes was plumbed through the settings API/dashboard but never
-- consumed anywhere: v2 self-serve registration (telegram-self-service.ts)
-- replaced the old "instant 1 GB trial" with the gems/referral economy and
-- always creates new accounts at quota_limit_bytes = 0. Dead column, dead UI.
ALTER TABLE telegram_bot_settings
  DROP CONSTRAINT IF EXISTS telegram_bot_settings_trial_quota_nonnegative;

ALTER TABLE telegram_bot_settings
  DROP COLUMN IF EXISTS trial_quota_bytes;
