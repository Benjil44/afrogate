-- Global egress mode for the foreign-egress split.
--   smart = geoip:ir/private -> direct (VPS local), everything else -> the relay pool (default)
--   full  = everything -> the relay pool (use when Iran filters the domestic internet too)
-- A VPS-side reconciler (afrows-egress-mode-sync.py) reads this and rewrites the
-- afrows-wg / afrows-xray routing accordingly. Single-row table (singleton).
CREATE TABLE IF NOT EXISTS egress_settings (
  id         boolean PRIMARY KEY DEFAULT true,
  mode       text NOT NULL DEFAULT 'smart',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT egress_settings_singleton CHECK (id),
  CONSTRAINT egress_settings_mode_chk CHECK (mode IN ('smart', 'full'))
);

INSERT INTO egress_settings (id, mode) VALUES (true, 'smart')
ON CONFLICT (id) DO NOTHING;
