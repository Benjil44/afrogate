-- D2: per-client-config fixed egress path (NULL = auto/failover). 'village' is
-- the Starlink path (same target as the gaming tier). Enforced by the egress
-- reconciler, which routes the config's VLESS user / WG source to the path tag.
ALTER TABLE client_route_preferences
  ADD COLUMN IF NOT EXISTS preferred_egress_path text;

DO $$ BEGIN
  ALTER TABLE client_route_preferences
    ADD CONSTRAINT client_route_preferences_egress_path_check
    CHECK (preferred_egress_path IS NULL OR preferred_egress_path IN ('germany','village','direct'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
