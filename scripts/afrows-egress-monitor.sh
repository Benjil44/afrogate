#!/usr/bin/env bash
# Afrows egress/pool health monitor + alerter (run on the Afrows VPS via a timer).
#
# Each run: checks foreign egress reachability (through the relay pool) + the pool
# size, logs a status line (journald), and on a STATE TRANSITION sends a Telegram
# alert — IF AFROWS_ALERT_BOT_TOKEN + AFROWS_ALERT_CHAT_ID are set (in env or
# /etc/afrows/afrows.env). Without them it just logs (alerting is dormant).
#
# Note: alerts go OUT through the egress proxy (Telegram is filtered in Ireland), so
# the "recovered"/"thin" alerts fire fine; a full egress-DOWN can't self-report
# from this box — true down-alerting needs an external vantage (Tier 4 / a probe
# on the Germany box or a relay). The status is always in journald regardless.
set -uo pipefail
ENV="${AFROWS_ENV:-/etc/afrows/afrows.env}"
STATE="${AFROWS_MON_STATE:-/var/lib/afrows/egress-monitor-state}"
CFG="${AFROWS_UPLINK_CFG:-/usr/local/etc/xray/config.json}"
SOCKS="${AFROWS_SOCKS:-127.0.0.1:10808}"
MIN_HEALTHY="${POOL_MIN_HEALTHY:-3}"

getenv() { grep -E "^$1=" "$ENV" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"\r'; }
TOKEN="${AFROWS_ALERT_BOT_TOKEN:-$(getenv AFROWS_ALERT_BOT_TOKEN)}"
CHAT="${AFROWS_ALERT_CHAT_ID:-$(getenv AFROWS_ALERT_CHAT_ID)}"

# 1) egress reachability (2 tries through the pool)
exit_ip=""
for _ in 1 2; do
  exit_ip="$(curl -s -m 10 -x "socks5h://$SOCKS" https://icanhazip.com | tr -d '\r\n')"
  [ -n "$exit_ip" ] && break
done
[ -n "$exit_ip" ] && egress="up" || egress="down"

# 2) pool size (relay-N members in the uplink config)
pool="$(python3 -c "import json;print(len([o for o in json.load(open('$CFG'))['outbounds'] if str(o.get('tag','')).startswith('relay-')]))" 2>/dev/null || echo 0)"

# 3) level
if [ "$egress" = "down" ]; then level="critical"
elif [ "$pool" -lt "$MIN_HEALTHY" ]; then level="warn"
else level="ok"; fi
echo "[egress-monitor] egress=$egress exit=${exit_ip:-none} pool=$pool level=$level"

# 4) alert on transition only (avoid spam)
mkdir -p "$(dirname "$STATE")" 2>/dev/null || true
prev="$(cat "$STATE" 2>/dev/null || echo "")"
echo "$level" > "$STATE" 2>/dev/null || true
[ "$level" = "$prev" ] && exit 0

case "$level" in
  critical) msg="🔴 Afrows egress DOWN — no relay reachable (pool=$pool)";;
  warn)     msg="🟡 Afrows egress thin — only $pool relay(s) healthy (exit ${exit_ip:-?})";;
  ok)       [ -n "$prev" ] && msg="🟢 Afrows egress recovered — exit $exit_ip, pool=$pool" || msg="";;
  *)        msg="";;
esac
[ -z "$msg" ] && exit 0

if [ -n "$TOKEN" ] && [ -n "$CHAT" ]; then
  if curl -s -m 12 -x "socks5h://$SOCKS" "https://api.telegram.org/bot$TOKEN/sendMessage" \
       --data-urlencode "chat_id=$CHAT" --data-urlencode "text=$msg" >/dev/null; then
    echo "[egress-monitor] alerted: $msg"
  else
    echo "[egress-monitor] alert send FAILED (egress likely down): $msg"
  fi
else
  echo "[egress-monitor] $msg (AFROWS_ALERT_* not configured — alert not sent)"
fi
