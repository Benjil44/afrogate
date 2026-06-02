#!/usr/bin/env bash
# Agent-token rotation verifier (release-readiness runbook §5).
# After rotating a server's agent token, confirms the OLD token is rejected and
# the NEW token is accepted by the bearer-guarded heartbeat endpoint.
# Read-only: sends two heartbeat probes and inspects the HTTP status only.
#
# Usage:
#   BASE_URL=https://<host> OLD_AGENT_TOKEN=... NEW_AGENT_TOKEN=... \
#     scripts/drills/verify-rotation.sh
set -euo pipefail

BASE_URL="${BASE_URL:?set BASE_URL=https://<host>}"
: "${OLD_AGENT_TOKEN:?set OLD_AGENT_TOKEN (expected to be rejected)}"
: "${NEW_AGENT_TOKEN:?set NEW_AGENT_TOKEN (expected to be accepted)}"
INGEST_PATH="${INGEST_PATH:-/api/agents/heartbeat}"
url="${BASE_URL%/}$INGEST_PATH"

probe() {
  curl -s -o /dev/null -w '%{http_code}' -X POST "$url" \
    -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' \
    -d '{}' || echo 000
}

old_code="$(probe "$OLD_AGENT_TOKEN")"
new_code="$(probe "$NEW_AGENT_TOKEN")"
fail=0

case "$old_code" in
  401|403) echo "PASS old token rejected (HTTP $old_code)" ;;
  *)       echo "FAIL old token NOT rejected (HTTP $old_code)"; fail=1 ;;
esac

case "$new_code" in
  401|403|000) echo "FAIL new token rejected/unreachable (HTTP $new_code)"; fail=1 ;;
  *)           echo "PASS new token accepted by auth (HTTP $new_code; 4xx other than 401/403 still means the token authenticated)" ;;
esac

if [ "$fail" -eq 0 ]; then
  echo "ROTATION VERIFY: passed"
else
  echo "ROTATION VERIFY: failed" >&2
  exit 1
fi
