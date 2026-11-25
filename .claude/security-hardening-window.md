# Afrows prod hardening — maintenance-window runbook

Target: `afrows-vps-new` (185.252.30.123). Prepared 2026-11-25. All steps human-gated.
Read-only recon basis: network-infra-engineer report + follow-up checks this session.

## Already done this session (no window needed, customer-invisible)
- ✅ **OpenSSH patched** → `1:9.6p1-3ubuntu13.20` (regreSSHion / CVE-2024-6387 closed). sshd re-exec did not drop sessions.
- ✅ **apt pipeline repaired** — `apt update` works again (mirror.arvancloud.ir, ~15s). The Oct-20 freeze is cleared.
- ✅ **npm dependency CVEs** — 0.133.2 (1 critical + 5 high + 2 moderate) fixed in-repo and deployed.

## Confirmed NOT a problem (reassurance)
- nginx `1.24.0-2ubuntu7.18` is the current patched Noble build (TLS1.2/1.3 only, HSTS, security headers, `server_tokens off`, rate limits). Nothing to do.
- Backend (7000) + Postgres (5432) bound to `127.0.0.1` only.
- TLS cert healthy (Let's Encrypt, auto-renew via certbot).

## Pre-reboot service-autostart checklist — VERIFIED ✅
All critical units are `enabled` (will auto-start on boot). Re-confirm right before the window:
```
for u in afrows-backend afrows-xray xray afrows-wg nginx postgresql \
         afrows-de-relay afrows-exit-mss afrows-tg-socks afrows-udp-echo; do
  printf "%-24s %s / %s\n" "$u" "$(systemctl is-enabled $u)" "$(systemctl is-active $u)"
done
```
Expected: all `enabled`. Egress reconciler timers (uplink-pool-sync, wg-reconcile, egress-mode-sync, egress-monitor, hexo-egress-sync, router-wg-sync, clock-guard, tls-check, backup) are all `enabled` too, so egress re-establishes unattended after boot.

---

## STEP A — Firewall (H2). Medium risk: SSH-lockout / egress-break if mis-ordered.
There is a scaffolded `afrows-firewall.service` (oneshot: `iptables-restore < /etc/iptables/rules.v4`), currently **disabled**, and `/etc/iptables/rules.v4` is **missing** — so the allowlist must be authored first. The repo does not manage it.

### Allowlist to stage (default INPUT DROP, allow only what we need)
- loopback; established/related; ICMP (ping) — keep
- `22/tcp` (SSH), `80/tcp`, `443/tcp` (nginx) — keep
- `51820/udp`, `51821/udp` (WireGuard) — keep
- `8080/tcp` — **KEEP OPEN**: owner confirmed it's an intentional customer fallback VLESS entry. (Separate follow-up: it's plaintext/DPI-fingerprintable — consider fronting with TLS/REALITY later. NOT a firewall action.)
- all WireGuard interfaces (`wg0`, `wg-cust`, `wg-home`, `wg-village-de`): accept on `-i wg+`
- `12345/tcp+udp` (TPROXY dokodemo): **NOT allowed externally** → default-dropped. It only ever needs locally-TPROXY'd packets, which arrive via the mangle path, not INPUT.

### SSH-safe rollout (never lock yourself out)
1. Write `/etc/iptables/rules.v4` (and an empty-ish v6) with the allowlist above and `-P INPUT DROP` as the LAST policy line.
2. **Arm a dead-man's switch BEFORE applying**: `sudo sh -c 'sleep 600 && iptables -P INPUT ACCEPT && iptables -F' &` — auto-reverts in 10 min if you get locked out.
3. Apply in the SAME session: `sudo iptables-restore < /etc/iptables/rules.v4`.
4. From a SECOND terminal, confirm a NEW SSH connection succeeds, nginx (443) answers, and a customer WG handshake still works (`sudo wg show` peer latest-handshake advancing). Check egress health: `curl -fsS http://127.0.0.1:7000/api/health`.
5. If all good within 10 min: `kill` the dead-man's-switch job, then persist + enable:
   `sudo systemctl enable afrows-firewall.service` (restores rules.v4 on every boot).
6. If anything breaks: do nothing — the switch reverts at 10 min; or `sudo iptables -P INPUT ACCEPT && sudo iptables -F` immediately.

Rollback after enable: `sudo systemctl disable --now afrows-firewall.service; sudo iptables -P INPUT ACCEPT; sudo iptables -F`.

---

## STEP B — OS packages + kernel reboot (H1 + C2 remainder). Disruptive: customer egress drops during reboot.
openssl/libssl3t64 (`3.0.13-0ubuntu3` → `.16`), libc6 (`2.39-0ubuntu8` → `.12`), and kernel (`6.8.0-31` → `6.8.0-147`) are behind. A reboot applies all three cleanly (avoids mid-flight libc/openssl service bounces).

1. Announce/opt a low-traffic window. Egress WILL drop for ~1–3 min.
2. Apply security updates (new libc/openssl/kernel staged, applied on boot):
   `sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l apt-get -y upgrade` (or targeted: `openssl libssl3t64 libc6 linux-generic`).
3. Re-run the **pre-reboot checklist** above — every unit `enabled`.
4. `sudo reboot`.
5. After boot, verify in order: `uname -r` (new kernel) → `systemctl is-active afrows-backend afrows-xray xray afrows-wg nginx postgresql` (all active) → `curl -fsS http://127.0.0.1:7000/api/health` → `sudo wg show` (peers re-handshaking) → egress health file updating (`/var/lib/afrows/egress-health.json`) → a real client connects through each entry (DE / USA / Hexo).
6. Rollback: GRUB → previous kernel (`6.8.0-31`) if the new kernel misbehaves; libc/openssl downgrades are not recommended — prefer forward-fix.

## Optional (low-risk, can do outside a window on owner go)
- SSH: `PermitRootLogin without-password` → `prohibit-password`/`no` AFTER creating a sudo user (verify that user can sudo + the egress chain's `ssh` forwarding still works). `X11Forwarding no`. **Keep** `AllowTcpForwarding yes` (the egress chain uses it).
- Install `fail2ban` (minor value given key-only auth; throttles pre-auth floods).
