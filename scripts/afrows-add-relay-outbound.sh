#!/usr/bin/env bash
# Add a dedicated relay (output of afrows-relay-bootstrap.sh) to the Afrows egress
# pool. Run as root ON THE AFROWS VPS. Pass the bootstrap's emitted params via env:
#
#   RELAY_IP=1.2.3.4 RELAY_PORT=443 RELAY_UUID=... RELAY_PBK=... RELAY_SID=... \
#   RELAY_SNI=www.microsoft.com RELAY_NAME="Afrows Relay TR" \
#   bash afrows-add-relay-outbound.sh
#
# Inserts a vless+reality outbound into the `outbounds` table (idempotent by
# address:port) and queues a speed test. The pool-sync reconciler then folds it
# into the live balancer automatically (or run afrows-uplink-pool-sync.py now).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root on the Afrows VPS"; exit 1; }
: "${RELAY_IP:?set RELAY_IP}"; : "${RELAY_UUID:?set RELAY_UUID}"; : "${RELAY_PBK:?set RELAY_PBK}"; : "${RELAY_SID:?set RELAY_SID}"
RELAY_PORT="${RELAY_PORT:-443}"; RELAY_SNI="${RELAY_SNI:-www.microsoft.com}"; RELAY_NAME="${RELAY_NAME:-Afrows Relay (own)}"

DBURL="$(grep -E '^DATABASE_URL=' /etc/afrows/afrows.env | cut -d= -f2- | tr -d '"\r')"
CONF="$(printf '{"address":"%s","port":%s,"uuid":"%s","security":"reality","publicKey":"%s","shortId":"%s","serverName":"%s","fingerprint":"chrome","network":"tcp","encryption":"none"}' \
  "$RELAY_IP" "$RELAY_PORT" "$RELAY_UUID" "$RELAY_PBK" "$RELAY_SID" "$RELAY_SNI")"

psql "$DBURL" -v conf="$CONF" -v nm="$RELAY_NAME" <<'SQL'
INSERT INTO outbounds (name, type, route_group, config)
SELECT :'nm', 'vless-local-proxy', 'default', :'conf'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM outbounds
  WHERE config->>'address' = (:'conf'::jsonb)->>'address'
    AND config->>'port'    = (:'conf'::jsonb)->>'port'
);
UPDATE outbounds SET speed_test_requested_at = now()
WHERE config->>'address' = (:'conf'::jsonb)->>'address'
  AND config->>'port'    = (:'conf'::jsonb)->>'port';
SQL

echo "==> relay added + speed test queued."
echo "    pool-sync folds it in within ~10min, or run now: /usr/bin/python3 /usr/local/bin/afrows-uplink-pool-sync.py"
