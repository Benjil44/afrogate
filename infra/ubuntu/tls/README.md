# Afrows TLS (afrows.com, www, app) — Let's Encrypt with auto-renewal

nginx on the Afrows server serves `afrows.com`, `www.afrows.com` and
`app.afrows.com` with `/etc/afrows/tls/afrows.{crt,key}`. The **Shatel link**
(`94.74.145.199:443`, SNI `app.afrows.com`, WS `/afrowsws`) connects to this nginx
directly, not through Cloudflare, so clients verify this certificate. If it expires,
every Shatel link with `allowInsecure=0` stops working. That happened on
2026-09-03: a hand-issued wildcard cert expired with no renewal set up. (New xray
cores also dropped `allowInsecure`, so "just allow insecure" is not a fix.)

## How renewal works

- `certbot` (Ubuntu package) with `certbot.timer` (twice a day; renews at 30 days left).
- HTTP-01 webroot `/var/www/acme`. Let's Encrypt fetches
  `http://<name>/.well-known/acme-challenge/...` → Cloudflare → `afrows-cf` tunnel
  on the USA → reverse tunnel `afrows-web-tunnel` → this nginx. Every
  `afrows.com` server block includes `snippets/afrows-acme.conf`
  (`afrows-acme.conf` here). No Cloudflare API token needed.
- Deploy hook `afrows-tls-deploy-hook` copies the renewed cert to
  `/etc/afrows/tls/afrows.{crt,key}` and reloads nginx (nginx config unchanged).
- `afrows-tls-check.timer` (daily): if fewer than 21 days are left (renewal has been
  failing for over a week) it sends a Telegram alert to the ops chat
  (`AFROWS_TELEGRAM_ALERT_CHAT_ID`, via the Telegram socks `AFROWS_OUTBOUND_PROXY_URL`).

The cert is for exactly `afrows.com`, `www.afrows.com`, `app.afrows.com` (no
wildcard: `de.` and `us.` terminate TLS at Cloudflare and never use this file).

## Install / repair

```
sudo bash /opt/afrows/infra/ubuntu/tls/install-tls-autorenew.sh
```

Idempotent. It backs up nginx + `/etc/afrows/tls` to `/root/tls-autorenew-<time>/`,
checks the challenge path through Cloudflare for all three names before asking
Let's Encrypt, issues the cert, runs `certbot renew --dry-run`, and prints the served
certificate.

## Health

```
echo | openssl s_client -connect 94.74.145.199:443 -servername app.afrows.com 2>/dev/null | openssl x509 -noout -enddate
systemctl list-timers certbot.timer afrows-tls-check.timer
journalctl -u certbot -n 20
```

The website tunnel must be up for renewal (it is also what serves the site), so
an outage of `afrows-web-tunnel` / `afrows-cf` longer than ~3 weeks would surface
through the expiry alert.
