-- Default the outbound AUTO speed-test ON.
--
-- The uplink relay pool (afrows-uplink-pool-sync) is the village-INDEPENDENT egress
-- reserve: it renders the operator's bought foreign VLESS subscription exits into the
-- uplink xray so a village power loss fails egress over to them. But pool-sync only
-- ADMITS an exit that has a speed test within ~90 min (>=3 Mbps). With auto-testing OFF
-- (the old default) nothing kept those exits fresh, so the reserve silently stayed
-- empty and the failover never fired. Turning auto ON keeps the reserve populated.
-- (maxPerTick + interval throttling still bound the load on a low-resource VPS.)
ALTER TABLE outbound_test_settings ALTER COLUMN auto_enabled SET DEFAULT true;
UPDATE outbound_test_settings SET auto_enabled = true, updated_at = now() WHERE id = true;
