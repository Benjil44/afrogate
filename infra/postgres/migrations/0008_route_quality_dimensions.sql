ALTER TABLE route_quality_hourly
  ADD COLUMN IF NOT EXISTS outbound_id uuid REFERENCES outbounds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outbound_key text NOT NULL DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS outbound_name text,
  ADD COLUMN IF NOT EXISTS operator text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS score_profile text NOT NULL DEFAULT 'balanced';

UPDATE route_quality_hourly
SET
  outbound_key = COALESCE(NULLIF(outbound_key, ''), outbound_id::text, NULLIF(outbound_name, ''), 'unassigned'),
  operator = COALESCE(NULLIF(operator, ''), 'unknown'),
  score_profile = COALESCE(NULLIF(score_profile, ''), 'balanced');

DROP INDEX IF EXISTS route_quality_hourly_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS route_quality_hourly_unique_idx
  ON route_quality_hourly (
    route_group,
    server_id,
    outbound_key,
    operator,
    protocol,
    score_profile,
    bucket_start
  );

CREATE INDEX IF NOT EXISTS route_quality_hourly_profile_pattern_idx
  ON route_quality_hourly (route_group, score_profile, day_of_week, hour_of_day);

CREATE INDEX IF NOT EXISTS route_quality_hourly_outbound_pattern_idx
  ON route_quality_hourly (route_group, outbound_key, operator, day_of_week, hour_of_day);
