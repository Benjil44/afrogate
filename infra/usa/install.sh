#!/bin/bash
# Afrows USA exit installer (idempotent). Run as root ON the USA VPS from a staging dir
# that holds the files of infra/usa/ plus scripts/afrows-de-usage-recorder.py:
#   bash install.sh [stage_dir]
# Installs the official Xray-core release (sha256-verified against the release .dgst),
# a loopback-only config (rendered once with a fresh chain UUID; an existing config is
# NEVER overwritten), the forced-command wrapper and the usage recorder. Opens no ports
# and touches nothing else on the box (cloudflared, wg-home, sshd config are left alone).
set -euo pipefail
STAGE="${1:-$(cd "$(dirname "$0")" && pwd)}"
XRAY_VERSION="${XRAY_VERSION:-v26.3.27}"
CFG_DIR=/usr/local/etc/xray
CFG="$CFG_DIR/config.json"
TS=$(date +%Y%m%d-%H%M%S)

backup() { [ -e "$1" ] && cp -a "$1" "$1.bak-afrows-$TS" && echo "backup: $1.bak-afrows-$TS"; return 0; }
install_if_changed() { # src dst mode
  if [ -e "$2" ] && cmp -s "$1" "$2"; then return 0; fi
  backup "$2"; install -m "$3" -o root -g root "$1" "$2"; echo "installed: $2"
}

for f in xray-config.template.json xray.service afrows-us-mgmt-cmd afrows-us-usage-recorder.service afrows-de-usage-recorder.py; do
  [ -f "$STAGE/$f" ] || { echo "missing $STAGE/$f"; exit 1; }
done

# 1) Xray-core binary + geo data (skip when the wanted version is already installed)
if ! /usr/local/bin/xray version 2>/dev/null | grep -q "^Xray ${XRAY_VERSION#v} "; then
  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
  base="https://github.com/XTLS/Xray-core/releases/download/$XRAY_VERSION"
  curl -fsSL --retry 3 -o "$tmp/x.zip" "$base/Xray-linux-64.zip"
  curl -fsSL --retry 3 -o "$tmp/x.dgst" "$base/Xray-linux-64.zip.dgst"
  want=$(awk -F'= ' '/^SHA2-256/{print $2}' "$tmp/x.dgst")
  have=$(sha256sum "$tmp/x.zip" | awk '{print $1}')
  [ -n "$want" ] && [ "$want" = "$have" ] || { echo "sha256 mismatch ($have != $want)"; exit 1; }
  python3 -I -m zipfile -e "$tmp/x.zip" "$tmp/x"
  backup /usr/local/bin/xray
  install -m 755 -o root -g root "$tmp/x/xray" /usr/local/bin/xray
  install -d -m 755 /usr/local/share/xray
  install -m 644 "$tmp/x/geoip.dat" "$tmp/x/geosite.dat" /usr/local/share/xray/
  echo "installed: xray $XRAY_VERSION (sha256 $have)"
fi

# 2) Config: render ONCE with a fresh chain UUID. Never overwrite a live config (it holds
#    the chain UUID + the mirrored customers). Readable by xray (nogroup), not world.
install -d -m 755 "$CFG_DIR"
if [ ! -f "$CFG" ]; then
  uuid=$(/usr/local/bin/xray uuid)
  sed "s/__AFROWS_US_CHAIN_UUID__/$uuid/" "$STAGE/xray-config.template.json" > "$CFG.new"
  chown root:nogroup "$CFG.new"; chmod 640 "$CFG.new"
  mv "$CFG.new" "$CFG"
  echo "rendered: $CFG (new chain uuid; read it with: jq -r '.inbounds[0].settings.clients[]|select(.email==\"afrows-chain@afrows\").id' $CFG)"
else
  chown root:nogroup "$CFG"; chmod 640 "$CFG"
  echo "kept existing: $CFG"
fi
XRAY_LOCATION_ASSET=/usr/local/share/xray /usr/local/bin/xray run -test -config "$CFG" | tail -1

# 3) Wrapper, recorder, units, state dir
install_if_changed "$STAGE/afrows-us-mgmt-cmd" /usr/local/sbin/afrows-us-mgmt-cmd 755
install -d -m 755 /usr/local/lib/afrows
install_if_changed "$STAGE/afrows-de-usage-recorder.py" /usr/local/lib/afrows/afrows-usage-recorder.py 644
install_if_changed "$STAGE/xray.service" /etc/systemd/system/xray.service 644
install_if_changed "$STAGE/afrows-us-usage-recorder.service" /etc/systemd/system/afrows-us-usage-recorder.service 644
install -d -m 700 -o root -g root /var/lib/afrows
# seed an empty buffer so read-usage works before the first metered byte (the recorder
# only writes once a tick sees traffic)
[ -f /var/lib/afrows/us-usage.json ] || echo '{"updated_at": null, "users": {}}' > /var/lib/afrows/us-usage.json
systemctl daemon-reload
systemctl enable --now xray.service afrows-us-usage-recorder.service
systemctl restart xray.service afrows-us-usage-recorder.service
sleep 2
systemctl is-active xray.service afrows-us-usage-recorder.service
ss -ltnp | grep -E ':1008[56] ' || true
