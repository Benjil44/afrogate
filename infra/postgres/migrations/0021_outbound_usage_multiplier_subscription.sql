ALTER TABLE outbounds
  ADD COLUMN IF NOT EXISTS usage_multiplier integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'outbounds_usage_multiplier_check'
  ) THEN
    ALTER TABLE outbounds
      ADD CONSTRAINT outbounds_usage_multiplier_check
      CHECK (usage_multiplier >= 1 AND usage_multiplier <= 100);
  END IF;
END $$;

ALTER TABLE client_usage_events
  ADD COLUMN IF NOT EXISTS raw_used_bytes_delta bigint,
  ADD COLUMN IF NOT EXISTS usage_multiplier integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rated_outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL;

UPDATE client_usage_events
SET raw_used_bytes_delta = used_bytes_delta
WHERE raw_used_bytes_delta IS NULL;

ALTER TABLE client_usage_events
  ALTER COLUMN raw_used_bytes_delta SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_usage_events_raw_delta_nonnegative'
  ) THEN
    ALTER TABLE client_usage_events
      ADD CONSTRAINT client_usage_events_raw_delta_nonnegative
      CHECK (raw_used_bytes_delta >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_usage_events_usage_multiplier_check'
  ) THEN
    ALTER TABLE client_usage_events
      ADD CONSTRAINT client_usage_events_usage_multiplier_check
      CHECK (usage_multiplier >= 1 AND usage_multiplier <= 100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS client_usage_events_rated_outbound_idx
  ON client_usage_events (rated_outbound_id, observed_at DESC);
