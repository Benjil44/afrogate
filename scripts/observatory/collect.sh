#!/usr/bin/env bash
# Pull observatory data + the renderer journal + the home router afr-watch log into DIR,
# then run analyze.py on it. Read-only on every host. Key-based SSH aliases assumed:
#   afrows-vps-new (Iran), usa-vps (USA), home-ac3-iran (router, optional).
#   usage: bash collect.sh DIR [--since 2026-10-26]   (extra args go to analyze.py)
set -uo pipefail
DIR="${1:?usage: collect.sh DIR [analyze args]}"; shift
SINCE_RENDERER="${RENDERER_SINCE:-2026-10-26}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DIR"
SSH="ssh -o BatchMode=yes -o ConnectTimeout=15"
$SSH afrows-vps-new 'cat /var/log/afrows-observatory/probe.jsonl.1 2>/dev/null; cat /var/log/afrows-observatory/probe.jsonl' > "$DIR/iran.jsonl"
$SSH usa-vps 'cat /var/log/afrows-observatory/probe.jsonl.1 2>/dev/null; cat /var/log/afrows-observatory/probe.jsonl' > "$DIR/usa.jsonl"
$SSH afrows-vps-new "journalctl -u afrows-egress-mode-sync --since $SINCE_RENDERER -o short-iso --no-pager | grep -F '] failover:'" > "$DIR/renderer.txt"
ROUTER=()
if $SSH home-ac3-iran '/log print where message~"afr-watch"' > "$DIR/router.txt" 2>/dev/null; then
  ROUTER=(--router-log "$DIR/router.txt" --router-date "$(TZ=Asia/Tehran date +%F)")
fi
wc -l "$DIR"/*.jsonl "$DIR"/*.txt
"${PY:-python3}" "$HERE/analyze.py" "$DIR/iran.jsonl" "$DIR/usa.jsonl" --renderer-log "$DIR/renderer.txt" "${ROUTER[@]}" "$@"
