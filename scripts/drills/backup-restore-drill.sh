#!/usr/bin/env bash
# Encrypted backup + restore drill (release-readiness runbook §2).
# Dumps + encrypts $DATABASE_URL, restores into $SCRATCH_DATABASE_URL, then verifies
# row-count parity and that the artifact is unreadable without the passphrase.
#
# DESTRUCTIVE to the SCRATCH database only. The source is used read-only.
# Requires: pg_dump, psql, gpg.
#
# Usage:
#   DATABASE_URL=postgres://... \
#   SCRATCH_DATABASE_URL=postgres://...   # WILL BE OVERWRITTEN \
#   BACKUP_PASSPHRASE=...                  \
#     scripts/drills/backup-restore-drill.sh
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL (source, used read-only)}"
: "${SCRATCH_DATABASE_URL:?set SCRATCH_DATABASE_URL (WILL BE OVERWRITTEN)}"
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE for gpg symmetric encryption}"

for bin in pg_dump psql gpg; do
  command -v "$bin" >/dev/null 2>&1 || { echo "missing required tool: $bin" >&2; exit 2; }
done

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
dump="$work/afrogate-$(date +%F).sql.gpg"

echo "==> dump + encrypt (AES256)"
pg_dump "$DATABASE_URL" \
  | gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 -o "$dump"
echo "     wrote $(wc -c <"$dump") bytes"

echo "==> confirm the artifact is encrypted at rest"
if gpg --batch --yes --passphrase "wrong-${BACKUP_PASSPHRASE}-x" -d "$dump" >/dev/null 2>&1; then
  echo "FAIL artifact decrypted with the WRONG passphrase" >&2
  exit 1
fi
echo "PASS artifact is not readable without the key"

echo "==> restore into the scratch database"
gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" -d "$dump" | psql "$SCRATCH_DATABASE_URL" >/dev/null
echo "     restore complete"

echo "==> compare row counts"
tables="admin_users customer_accounts client_configs payment_orders reseller_wallet_ledger"
fail=0
for t in $tables; do
  src="$(psql "$DATABASE_URL" -tAc "select count(*) from $t" 2>/dev/null || echo NA)"
  dst="$(psql "$SCRATCH_DATABASE_URL" -tAc "select count(*) from $t" 2>/dev/null || echo NA)"
  if [ "$src" != "NA" ] && [ "$src" = "$dst" ]; then
    printf 'PASS %-26s %s == %s\n' "$t" "$src" "$dst"
  else
    printf 'FAIL %-26s src=%s dst=%s\n' "$t" "$src" "$dst"
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "BACKUP/RESTORE DRILL: row counts match and artifact is encrypted"
else
  echo "BACKUP/RESTORE DRILL: mismatch — investigate" >&2
  exit 1
fi
