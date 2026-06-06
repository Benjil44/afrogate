-- Outbound throughput metrics + on-demand speed-test request flag + auto-test setting.

ALTER TABLE outbounds
  ADD COLUMN IF NOT EXISTS latest_down_mbps double precision,
  ADD COLUMN IF NOT EXISTS latest_up_mbps double precision,
  ADD COLUMN IF NOT EXISTS last_speed_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS speed_test_requested_at timestamptz;

-- Single-row settings for the Outbounds page auto-test toggle.
CREATE TABLE IF NOT EXISTS outbound_test_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  auto_enabled boolean NOT NULL DEFAULT false,
  interval_seconds integer NOT NULL DEFAULT 600,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO outbound_test_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
