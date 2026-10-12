#!/bin/bash
# Afrows TLS auto-renewal (Let's Encrypt, certbot webroot through the Cloudflare tunnel).
# Idempotent. Run as root on the Afrows server from a checkout of this repo:
#   bash infra/ubuntu/tls/install-tls-autorenew.sh
# See infra/ubuntu/tls/README.md.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
B=/root/tls-autorenew-$(date +%Y%m%d-%H%M%S); mkdir -p "$B"; chmod 700 "$B"
cp -a /etc/nginx/sites-available/afrows /etc/afrows/tls "$B"/

echo "== certbot"
DEBIAN_FRONTEND=noninteractive apt-get install -y -q certbot >/dev/null

echo "== nginx acme snippet"
mkdir -p /var/www/acme/.well-known/acme-challenge /etc/nginx/snippets
install -m 644 "$HERE/afrows-acme.conf" /etc/nginx/snippets/afrows-acme.conf
python3 - <<'AFROWS_PY'
import re
p = "/etc/nginx/sites-available/afrows"
s = open(p).read()
inc = "    include /etc/nginx/snippets/afrows-acme.conf;\n"
if inc in s:
    print("  include already present")
else:
    out, n = [], 0
    for line in s.splitlines(keepends=True):
        out.append(line)
        if re.match(r"\s*server_name\s+[^;]*afrows\.com[^;]*;", line):
            out.append(inc)
            n += 1
    open(p, "w").write("".join(out))
    print(f"  include added to {n} server block(s)")
AFROWS_PY
nginx -t -q && systemctl reload nginx

echo "== challenge path reachable through Cloudflare?"
tok=afrows-probe-$RANDOM
echo "$tok" > /var/www/acme/.well-known/acme-challenge/$tok
for h in afrows.com www.afrows.com app.afrows.com; do
  got=$(curl -s -m 20 "http://$h/.well-known/acme-challenge/$tok" || true)
  if [ "$got" = "$tok" ]; then echo "  $h ok"; else
    echo "  $h FAILED (got: ${got:0:60})"; rm -f /var/www/acme/.well-known/acme-challenge/$tok; exit 1
  fi
done
rm -f /var/www/acme/.well-known/acme-challenge/$tok

echo "== hook + daily expiry check"
install -m 755 "$HERE/afrows-tls-deploy-hook" /usr/local/sbin/afrows-tls-deploy-hook
install -m 755 "$HERE/afrows-tls-check" /usr/local/sbin/afrows-tls-check
install -m 644 "$HERE/afrows-tls-check.service" "$HERE/afrows-tls-check.timer" /etc/systemd/system/

echo "== issue (or keep) the certificate"
certbot certonly --webroot -w /var/www/acme --cert-name afrows \
  -d afrows.com -d www.afrows.com -d app.afrows.com \
  --agree-tos --register-unsafely-without-email --non-interactive --keep-until-expiring \
  --deploy-hook /usr/local/sbin/afrows-tls-deploy-hook
# When certbot kept a still-valid cert the hook did not fire; make sure nginx serves it.
/usr/local/sbin/afrows-tls-deploy-hook

systemctl daemon-reload
systemctl enable --now certbot.timer afrows-tls-check.timer >/dev/null
certbot renew --dry-run -q && echo "== renewal dry-run: OK"

echo "== result"
echo | openssl s_client -connect 127.0.0.1:443 -servername app.afrows.com 2>/dev/null | openssl x509 -noout -subject -issuer -enddate
/usr/local/sbin/afrows-tls-check || true
systemctl list-timers --no-pager | grep -E "certbot|afrows-tls" || true
echo "backup: $B"
