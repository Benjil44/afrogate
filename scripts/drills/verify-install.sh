#!/usr/bin/env bash
# Install-drill verifier (release-readiness runbook §1).
# Read-only: makes HTTP requests to a deployed host and, when run ON that host
# with HOST_LOCAL=1, also checks that internal ports are loopback-only.
#
# Usage:
#   BASE_URL=https://<host> scripts/drills/verify-install.sh
#   BASE_URL=https://<host> HOST_LOCAL=1 scripts/drills/verify-install.sh   # on the host
set -euo pipefail

BASE_URL="${BASE_URL:?set BASE_URL=https://<host>}"
base="${BASE_URL%/}"
fail=0
note() { printf '     %s\n' "$*"; }
pass() { printf 'PASS %s\n' "$*"; }
bad()  { printf 'FAIL %s\n' "$*"; fail=1; }

echo "==> health"
if curl -fsS "$base/api/health" | grep -q '"status":"ok"'; then
  pass "health endpoint returns ok"
else
  bad "health endpoint did not return status ok"
fi

echo "==> security headers"
headers="$(curl -sI "$base/" || true)"
for h in content-security-policy x-frame-options; do
  if printf '%s' "$headers" | grep -iq "^$h:"; then pass "header present: $h"; else bad "missing header: $h"; fi
done
if printf '%s' "$headers" | grep -iq '^strict-transport-security:'; then
  pass "header present: strict-transport-security"
else
  note "strict-transport-security not seen (expected when TLS terminates upstream; verify at the edge)"
fi

echo "==> internal ports"
if [ "${HOST_LOCAL:-0}" = "1" ]; then
  if command -v ss >/dev/null 2>&1; then
    for port in 7000 5432; do
      listen="$(ss -ltnH "( sport = :$port )" 2>/dev/null || true)"
      if [ -z "$listen" ]; then
        note "port $port not listening (ok if that service is not co-located)"
      elif printf '%s' "$listen" | grep -qvE '127\.0\.0\.1:|\[::1\]:'; then
        bad "port $port is NOT loopback-only:"; printf '%s\n' "$listen"
      else
        pass "port $port bound to loopback only"
      fi
    done
  else
    note "ss not available; skipping port check"
  fi
else
  note "HOST_LOCAL!=1; skipping local port check (run on the host with HOST_LOCAL=1)"
fi

if [ "$fail" -eq 0 ]; then
  echo "INSTALL VERIFY: all checks passed"
else
  echo "INSTALL VERIFY: FAILURES present" >&2
  exit 1
fi
