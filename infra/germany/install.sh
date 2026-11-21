#!/usr/bin/env bash
# Install / update the Afrows Germany edge agent ON the Germany box.
#
# Afrows-scoped ONLY. This does NOT touch any Hexogate service, container,
# port, firewall rule, or file. It installs one Python script, one systemd
# unit, and one root-only env file, all under Afrows-owned paths.
#
# Usage (run as root on the Germany box, from a checkout of the repo):
#   bash infra/germany/install.sh
# Then edit /etc/afrows/afrows-de-agent.env to set AFROWS_EDGE_TOKEN (same value
# as the backend's AFROWS_EDGE_TOKEN) and AFROWS_EDGE_URL, and the agent starts.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
AGENT_SRC="$REPO/scripts/afrows-de-edge-agent.py"
AGENT_DST="/usr/local/bin/afrows-de-edge-agent.py"
UNIT_DST="/etc/systemd/system/afrows-de-edge-agent.service"
ENV_DST="/etc/afrows/afrows-de-agent.env"

[ -f "$AGENT_SRC" ] || { echo "missing $AGENT_SRC"; exit 1; }

install -m 0755 "$AGENT_SRC" "$AGENT_DST"
python3 -m py_compile "$AGENT_DST"            # fail fast on a syntax error
install -D -m 0644 "$HERE/afrows-de-edge-agent.service" "$UNIT_DST"

if [ ! -f "$ENV_DST" ]; then
  install -D -m 0600 "$HERE/afrows-de-agent.env.sample" "$ENV_DST"
  echo ">> Created $ENV_DST — set AFROWS_EDGE_TOKEN (and AFROWS_EDGE_URL) before it will leave idle."
fi

systemctl daemon-reload
systemctl enable --now afrows-de-edge-agent.service
sleep 2
systemctl --no-pager --full status afrows-de-edge-agent.service | head -15
echo ">> journalctl -u afrows-de-edge-agent -f   # to watch it reconcile"
