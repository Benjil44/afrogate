#!/usr/bin/env bash
# Afrows multi-path deploy engine.
#
# Ships the current committed tree to the VPS and runs the on-box update
# (build -> migrations -> restart -> reconciler copy), trying each configured
# access path in order until one connects — so a deploy still works when the
# DIRECT path is down by falling back to a MikroTik-mediated / jump path.
#
#   bash scripts/deploy/afrows-deploy.sh            # deploy HEAD
#   bash scripts/deploy/afrows-deploy.sh --check     # only test which paths are reachable
#
# SECURITY / BOUNDARIES:
#   * No secrets, IPs, or credentials live in this file. Targets are SSH
#     destinations (aliases or user@host) you define in scripts/deploy/deploy.env
#     (gitignored) and/or your ~/.ssh/config. Authentication is KEY-BASED only —
#     this script never handles a password.
#   * "MikroTik path" = an SSH destination that reaches the VPS via a router /
#     jump you control (e.g. an alias whose ~/.ssh/config entry sets ProxyJump,
#     or the VPS's tunnel-side IP reachable through the router). You define what
#     that path is; the engine just tries it.
#   * Read-only until a reachable path is found; it never force-pushes or edits code.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
ENV_FILE="$HERE/deploy.env"

# ---- config (from deploy.env; see deploy.env.example) --------------------------
# AFROWS_DEPLOY_TARGETS : space-separated ordered SSH destinations to try.
# AFROWS_REMOTE_DIR     : repo dir on the VPS (default /opt/afrows).
# AFROWS_SRC_REMOTE     : where update-afrows.sh expects the tarball (default /root/afrows-src.tar.gz).
# AFROWS_HEALTH_URL     : health URL to verify after deploy (default https://127.0.0.1:7000/api/health, checked on-box).
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
TARGETS="${AFROWS_DEPLOY_TARGETS:-}"
REMOTE_DIR="${AFROWS_REMOTE_DIR:-/opt/afrows}"
SRC_REMOTE="${AFROWS_SRC_REMOTE:-/root/afrows-src.tar.gz}"

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)

say() { printf '\n=== %s ===\n' "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

[ -n "$TARGETS" ] || die "No AFROWS_DEPLOY_TARGETS set. Copy scripts/deploy/deploy.env.example -> scripts/deploy/deploy.env and fill it in."

# ---- find the first reachable path (KEY-BASED; no password prompt) --------------
find_path() {
  for t in $TARGETS; do
    printf '  probing %-28s ... ' "$t" >&2
    if timeout 15 ssh "${SSH_OPTS[@]}" "$t" 'echo ok' >/dev/null 2>&1; then
      echo "REACHABLE" >&2; echo "$t"; return 0
    fi
    echo "no" >&2
  done
  return 1
}

say "Reachability (trying paths in order: direct first, then fallbacks)"
if ! CHOSEN="$(find_path)"; then
  cat >&2 <<EOF

No configured path to the VPS is reachable right now.
  * If the DIRECT path is down (village/uplink degraded), add a MikroTik/jump path
    to AFROWS_DEPLOY_TARGETS (an ~/.ssh/config alias with ProxyJump through a router
    you can reach, or the VPS tunnel-side IP).
  * Verify a path by hand:  ssh <target> 'echo ok'
This engine never uses passwords, so a target that needs one will just fail here.
EOF
  exit 2
fi
echo "  -> using: $CHOSEN"

if [ "${1:-}" = "--check" ]; then
  echo "Reachability check only (--check); not deploying."
  exit 0
fi

# ---- package the committed tree (clean, reproducible) --------------------------
say "Packaging source ($(git -C "$REPO_ROOT" rev-parse --short HEAD))"
TARBALL="$(mktemp -t afrows-src.XXXXXX.tar.gz)"
trap 'rm -f "$TARBALL"' EXIT
git -C "$REPO_ROOT" archive --format=tar.gz -o "$TARBALL" HEAD
echo "  $(du -h "$TARBALL" | cut -f1) -> $CHOSEN:$SRC_REMOTE"

# ---- ship + run the on-box update ---------------------------------------------
say "Uploading to VPS"
scp "${SSH_OPTS[@]}" "$TARBALL" "$CHOSEN:$SRC_REMOTE"

say "Running remote update (build -> migrations -> restart -> reconcilers)"
# update-afrows.sh is the operator-local on-box script; it extracts $SRC_REMOTE
# into $REMOTE_DIR, rebuilds, runs migrations, restarts, and copies the reconcilers.
ssh "${SSH_OPTS[@]}" "$CHOSEN" "cd $REMOTE_DIR && bash update-afrows.sh"

# ---- verify -------------------------------------------------------------------
say "Verify backend health (on-box)"
ssh "${SSH_OPTS[@]}" "$CHOSEN" 'curl -fsS http://127.0.0.1:7000/api/health || echo "HEALTH FAILED"'

say "Deploy complete via $CHOSEN. Run the checks in scripts/deploy/DEPLOY-VERIFY.md"
