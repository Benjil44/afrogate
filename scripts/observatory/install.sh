#!/usr/bin/env bash
# Install / update the Afrows path observatory on this host (additive, idempotent).
#   usage:  sudo bash install.sh iran|usa
# Run from a directory holding afrows-observatory-probe.py + the .service/.timer.
# Stop:   systemctl disable --now afrows-observatory.timer
# Remove: also rm -rf /usr/local/lib/afrows-observatory /etc/systemd/system/afrows-observatory.* \
#         /etc/default/afrows-observatory  (data stays in /var/log/afrows-observatory)
set -euo pipefail
VANTAGE="${1:-}"
case "$VANTAGE" in iran|usa) ;; *) echo "usage: $0 iran|usa" >&2; exit 2 ;; esac
HERE="$(cd "$(dirname "$0")" && pwd)"
for f in afrows-observatory-probe.py afrows-observatory.service afrows-observatory.timer; do
  [ -f "$HERE/$f" ] || { echo "missing $HERE/$f" >&2; exit 1; }
done
command -v curl >/dev/null && command -v ping >/dev/null && command -v python3 >/dev/null \
  || { echo "need python3, curl, ping" >&2; exit 1; }

install -d -m 0755 /usr/local/lib/afrows-observatory
install -d -m 0750 /var/log/afrows-observatory
install -m 0755 "$HERE/afrows-observatory-probe.py" /usr/local/lib/afrows-observatory/
install -m 0644 "$HERE/afrows-observatory.service" "$HERE/afrows-observatory.timer" /etc/systemd/system/
# Keep operator overrides (OBS_*) if the file already exists; only (re)set the vantage.
touch /etc/default/afrows-observatory
chmod 0644 /etc/default/afrows-observatory
if grep -q '^OBS_VANTAGE=' /etc/default/afrows-observatory; then
  sed -i "s/^OBS_VANTAGE=.*/OBS_VANTAGE=$VANTAGE/" /etc/default/afrows-observatory
else
  echo "OBS_VANTAGE=$VANTAGE" >> /etc/default/afrows-observatory
fi
systemctl daemon-reload
systemctl enable --now afrows-observatory.timer
systemctl start afrows-observatory.service   # one immediate cycle as a smoke test
tail -n 20 /var/log/afrows-observatory/probe.jsonl
systemctl list-timers afrows-observatory.timer --no-pager
