CREATE TABLE IF NOT EXISTS route_quality_hourly (
  id bigserial PRIMARY KEY,
  route_group text NOT NULL DEFAULT 'main',
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  protocol text NOT NULL,
  bucket_start timestamptz NOT NULL,
  hour_of_day integer NOT NULL,
  day_of_week integer NOT NULL,
  sample_count integer NOT NULL,
  average_score real NOT NULL,
  average_latency_ms real,
  average_jitter_ms real,
  average_packet_loss_percent real,
  degraded_sample_percent real NOT NULL DEFAULT 0,
  critical_sample_percent real NOT NULL DEFAULT 0,
  first_observed_at timestamptz NOT NULL,
  last_observed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS route_quality_hourly_unique_idx
  ON route_quality_hourly (route_group, server_id, protocol, bucket_start);

CREATE INDEX IF NOT EXISTS route_quality_hourly_route_bucket_idx
  ON route_quality_hourly (route_group, bucket_start DESC);

CREATE INDEX IF NOT EXISTS route_quality_hourly_server_protocol_idx
  ON route_quality_hourly (server_id, protocol, bucket_start DESC);

CREATE INDEX IF NOT EXISTS route_quality_hourly_pattern_idx
  ON route_quality_hourly (route_group, protocol, day_of_week, hour_of_day);
