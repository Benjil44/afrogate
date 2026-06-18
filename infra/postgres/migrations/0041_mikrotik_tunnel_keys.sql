-- Afrows-generated WireGuard keys for managed MikroTiks, so onboarding is one paste:
-- Afrows allocates the tunnel IP (host), generates the keypair, registers the peer on
-- wg-routers (via afrows-router-wg-sync), and embeds the private key in the connect-config.
ALTER TABLE mikrotik_routers ADD COLUMN IF NOT EXISTS tunnel_public_key text;
ALTER TABLE mikrotik_routers ADD COLUMN IF NOT EXISTS tunnel_private_key_enc text;

-- Office was onboarded manually (it generated its own key); record its public key so the
-- reconciler keeps its wg-routers peer instead of pruning it. (Private key stays on the device.)
UPDATE mikrotik_routers
   SET tunnel_public_key = 'noPsvCPX/Dr78rMkXVEd0wLCDPGd+T3pt7HttL6u2yM='
 WHERE id = 'office' AND tunnel_public_key IS NULL;
