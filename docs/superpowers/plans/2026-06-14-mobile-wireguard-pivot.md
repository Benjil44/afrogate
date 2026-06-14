# Mobile WireGuard Pivot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Phases 1–2 run on the VPS (ship mode); Phase 3 needs the Android device on adb.

**Goal:** Replace the unreliable xray-in-Flutter engine with **native Android WireGuard**, where each customer gets a per-customer WireGuard config that connects to the Afrows VPS (a domestic Iran→Iran hop, no DPI problem) and exits through the existing obfuscated Germany egress.

**Architecture:** Reuse the *proven* MikroTik pattern: an **xray WireGuard inbound** decapsulates each customer's WG peer in userspace and routes it straight to the `proxy` outbound (Germany) — no kernel WG, no server-side tun2socks, no extra routing. Per-customer peers live on a **dedicated `afrows-wg` xray service** so peer-change restarts never disrupt the VLESS inbounds. The server generates each customer's WG keypair (managed-WG model, like wg-easy), stores the public key as a peer + the private key (encrypted) to render the `.conf`, and assigns a tunnel IP. The Flutter app uses the official WireGuard Android backend to bring up the tunnel from that `.conf`.

**Tech Stack:** xray-core WireGuard inbound (already on the box), PostgreSQL, NestJS backend, `xray wg` (key generation), WireGuard Android (`com.wireguard.android:tunnel` GoBackend, via a Flutter plugin or thin native wrapper), Flutter.

---

## Key decisions (settled)

- **Server WG = KERNEL WireGuard (`wg0`)** — REVISED 2026-06-14 after testing. The xray WireGuard inbound (the interim `afrows-wg` service, port 51821) **proved the end-to-end works** (phone → WG → Afrows → Germany, validated with the official WireGuard Android app), BUT xray's WG inbound only reports **aggregate** inbound traffic — `user>>>`/online are empty `{}`, so it **cannot meter per customer**. Since Afrows sells per-customer with quotas + active-users, switch to **kernel WireGuard**, which gives **per-peer transfer + last-handshake** (exact per-customer usage, quota enforcement, active = recent handshake) and **dynamic peers** via `wg set` (no restart). Egress (kernel can't speak SOCKS): **iptables TPROXY → an xray `dokodemo-door` (tproxy) inbound → `proxy` outbound → Germany** (reuses xray; no external tun2socks binary — GitHub release assets are blocked from the box). Feasibility confirmed on the box: kernel `wireguard` module present, `wireguard-tools` installable via apt, `xt_TPROXY` loadable, iptables mangle OK. The interim `afrows-wg` xray service is kept only as the working proof and will be retired once kernel WG is live.
- **Managed keypairs.** The server generates each WG config's keypair via `xray wg` (standard base64), stores the **public key** (peer) and **private key** (to render the downloadable `.conf`, encrypted at rest via `SecretVaultService`), and assigns a `/32` tunnel IP from a pool (e.g. `10.8.0.0/16`). The private key is delivered once in the `.conf`/QR and never shown again in lists.
- **Domestic hop.** Phone (Iran mobile) → Afrows VPS (Iran) over WG UDP. No national-firewall crossing, so plain WG is fine for this hop; Afrows does the obfuscated international exit. Risk: some mobile carriers throttle UDP — mitigate by choosing the WG port and testing on-device (Phase 3 spike).
- **Per-customer WG belongs to `client_configs`** with `protocol='wireguard'` — same model as VLESS configs, surfaced in the existing Customers → Configs panel and Connections view.

## File / component map

- **DB (migration 0033):** `wireguard_peers` table — `id`, `client_config_id` FK, `public_key`, `private_key_encrypted`, `private_key_key_id`, `address` (tunnel IP), `created_at`. (Keypair + IP per WG client_config.)
- **Server service:** `apps/backend/src/client/wireguard-provisioning.service.ts` — allocate keypair+IP on WG client_config create; reconcile active WG peers → `/usr/local/etc/afrows-wg/config.json` → restart `afrows-wg`; build the `.conf` text.
- **Box config/ops:** `/usr/local/etc/afrows-wg/config.json` (xray: WG inbound `wg-cust` on UDP `:51821`, routing `wg-cust → proxy`), `/etc/systemd/system/afrows-wg.service`, `scripts/afrows-setup-wg-service.sh`.
- **Backend API:** `GET /api/admin/client-configs/:id/wireguard-conf` → `{ conf, qr }` (admin); include WG in `/api/client/subscription`.
- **Dashboard:** Customers → Configs panel renders the WireGuard `.conf` (copy + QR) when `protocol==='wireguard'` (replaces today's "provisioning pending").
- **Mobile:** `apps/native-client` — add a WireGuard backend (Flutter plugin or native wrapper), an engine bridge `wireguard_vpn.dart` mirroring `xray_vpn.dart`'s interface, and wire `connect_screen` to it.

---

## Phase 1 — Server: kernel WireGuard + per-customer metering → egress (VPS)

> Outcome: a hand-made WG `.conf` connects, exits Germany, AND `wg show` reports that peer's per-byte usage + handshake. PROVEN already (interim xray `afrows-wg`) that phone→WG→Germany works; this phase swaps to kernel WG for per-peer metering. **High-risk: touches production packet routing — do in a focused session, snapshot iptables/ip-rule first, keep VLESS + MikroTik unaffected.**

### Task 1.1: Kernel `wg0` interface
**Files:** Create `scripts/afrows-setup-kernel-wg.sh` (ops; keys generated on-box, not committed).
- [ ] `apt-get install -y wireguard-tools` (Ubuntu noble mirror is reachable).
- [ ] Generate server keys: `wg genkey | tee /etc/wireguard/server.key | wg pubkey > /etc/wireguard/server.pub` (chmod 600).
- [ ] `/etc/wireguard/wg0.conf`: `[Interface] Address=10.8.0.1/24, ListenPort=51820 (or 443/udp if carrier-throttled), PrivateKey=<server.key>, Table=off` (we route manually). No peers yet.
- [ ] `sysctl -w net.ipv4.ip_forward=1` + persist in `/etc/sysctl.d/99-afrows-wg.conf`.
- [ ] `wg-quick up wg0`; `systemctl enable wg-quick@wg0`. Verify `wg show wg0` + `ss -ulnp | grep 51820`.
- [ ] Retire the interim xray `afrows-wg` (port 51821) once kernel WG is proven: `systemctl disable --now afrows-wg`.

### Task 1.2: Egress — wg0 traffic → xray (TPROXY) → Germany
**Files:** Modify `/usr/local/etc/afrows-xray/config.json` (add a `dokodemo-door` tproxy inbound + route to `proxy`); `scripts/afrows-setup-kernel-wg.sh` (iptables/ip-rule).
- [ ] Add xray inbound `{tag:"wg-tproxy", listen:"127.0.0.1"|"0.0.0.0", port:12345, protocol:"dokodemo-door", settings:{network:"tcp,udp", followRedirect:true}, sniffing:{enabled:true,destOverride:["http","tls"]}, streamSettings:{sockopt:{tproxy:"tproxy"}}}` + routing `wg-tproxy → proxy`. `xray -test`, restart afrows-xray (brief; schedule with VLESS users in mind).
- [ ] `modprobe xt_TPROXY`; mark + route wg0 traffic to the tproxy port via iptables mangle TPROXY + `ip rule add fwmark 1 lookup 100` + `ip route add local 0.0.0.0/0 dev lo table 100` (standard xray-tproxy gateway recipe, scoped to `-i wg0` / `from 10.8.0.0/24`). Snapshot `iptables-save` + `ip rule`/`ip route` BEFORE.
- [ ] Generate a test peer (`wg genkey`), `wg set wg0 peer <pub> allowed-ips 10.8.0.2/32`, build `.conf` (Endpoint=94.74.145.199:51820, AllowedIPs=0.0.0.0/0, DNS=1.1.1.1), connect from laptop/phone → verify `curl https://icanhazip.com` exits Germany (85.234.69.185 / 92.223.62.134) AND `wg show wg0` shows that peer's rx/tx + handshake.
- [ ] If carrier blocks UDP 51820, switch ListenPort to 443/udp and re-test.

### Task 1.3: DB + provisioning service (dynamic peers, no restart)
**Files:** Create `infra/postgres/migrations/0033_wireguard_peers.sql`, `apps/backend/src/client/wireguard-provisioning.service.ts`; Modify `apps/backend/src/app.module.ts`.
- [ ] Migration 0033 (idempotent): `wireguard_peers(id, client_config_id FK, public_key, private_key_encrypted, private_key_key_id, address, created_at)` + unique index on `address` and `client_config_id`.
- [ ] `ensurePeer(clientConfigId)`: if none, generate keypair (`wg genkey`/`wg pubkey` via execFile), store pubkey + encrypted privkey (SecretVaultService) + next free IP from `10.8.0.0/24`.
- [ ] `reconcile()` (60s): diff active `client_configs[protocol=wireguard]` peers vs `wg show wg0 dump` → `wg set wg0 peer <pub> allowed-ips <ip>/32` to add, `wg set wg0 peer <pub> remove` to drop. **No service restart** (dynamic). Persist via `wg-quick save wg0` periodically. No-op in dev.
- [ ] `buildConf(clientConfigId)`: render `.conf` from stored privkey + server pubkey + `AFROWS_WG_ENDPOINT`/`AFROWS_WG_SERVER_PUBKEY` env. Unit-test the pure renderer.
- [ ] Register service in `app.module.ts`.

### Task 1.4: Per-customer metering + active users from `wg show`
**Files:** Modify `apps/backend/src/client/wireguard-provisioning.service.ts` (or a `wireguard-metering.service.ts`); `operations-overview.service.ts`.
- [ ] Parse `wg show wg0 dump` (per-peer: pubkey, last-handshake epoch, rx, tx). Map pubkey → client_config → customer_account.
- [ ] Meter: delta rx+tx since last sample → add to `client_configs.used_bytes` + `customer_accounts.used_bytes` (like `XrayUsageMeteringService`); enforce quota (remove peer when over).
- [ ] Active users: count peers with `last-handshake` within ~180s. Fold WG active users + WG total traffic into the dashboard overview (alongside the xray `user>>>` set). This is what makes WG customers show on the dashboard (the gap found 2026-06-14).

---

## Phase 2 — Config delivery (dashboard + app)

> Outcome: creating a WireGuard config for a customer yields a downloadable `.conf` + QR.

### Task 2.1: Backend endpoint
**Files:** Modify `apps/backend/src/billing/billing.controller.ts` + `billing.service.ts`; Shared `AdminWireguardConfResponse { conf: string; qr: string }`.
- [ ] On `createClientConfig` with `protocol='wireguard'`, call `WireguardProvisioningService.ensurePeer`.
- [ ] `GET /api/admin/client-configs/:id/wireguard-conf` → `{ conf, qr(dataURL) }` (admin-only). QR via a small lib or returned as text for the client to render.
- [ ] Include WG configs in `/api/client/subscription` (the app login flow), alongside the VLESS entry link.

### Task 2.2: Dashboard Configs panel
**Files:** Modify `apps/dashboard/src/pages/CustomersPage.tsx`, `api/admin.ts`, i18n.
- [ ] In the Configs panel, for `protocol==='wireguard'` rows: fetch + show the `.conf` (copy) + QR (replaces "provisioning pending").
- [ ] Verify locally against the VPS backend (dev proxy) that a WG config renders a real `.conf`.

---

## Phase 3 — Native WireGuard in the Flutter app (needs device on adb)

> Outcome: the Afrows app connects via WireGuard and actually forwards (Active users > 0).

### Task 3.1: Spike — validate a WG backend on the device
- [ ] Evaluate `wireguard_flutter` (or equivalent) vs a thin native wrapper over `com.wireguard.android:tunnel`. Build a throwaway screen that starts a tunnel from the **Task 1.2 hand-made `.conf`** on the real device.
- [ ] Capture logcat; confirm handshake + real traffic (server `afrows-wg` peer shows rx/tx; `curl` via phone exits Germany). Decide plugin vs native based on what actually forwards.

### Task 3.2: Engine bridge + wiring
**Files:** Create `apps/native-client/lib/wireguard_vpn.dart` (mirror `xray_vpn.dart`'s `start/stop/status` interface); Modify `connect_screen.dart` to use it; remove `flutter_v2ray`/`libv2ray.aar`.
- [ ] `wireguard_vpn.dart`: fetch the customer's `.conf` from `/api/client/subscription`, start/stop the WG tunnel via the chosen backend, expose status (connected, up/down bytes).
- [ ] Wire `connect_screen` to `WireguardVpn` (same UI). Remove the dead flutter_v2ray engine + aar.
- [ ] Build, install, connect with a real customer account; verify forwarding + that **Active users** on the dashboard increments.

---

## Risks & mitigations
- **Mobile-carrier UDP/WG throttling** → test port 51821, fall back to 443/UDP (Task 1.2/3.1). If domestic UDP is blocked entirely, reconsider (but the MikroTik proves domestic WG works on at least one ISP).
- **`afrows-wg` restart on peer changes drops active WG users briefly** → isolated service + batched reconcile; acceptable at current scale. Revisit kernel-WG if churn grows.
- **Private-key handling** → generated on-box, encrypted at rest (SecretVault), delivered once in the `.conf`; never returned in list endpoints.
- **Two engines already failed (sing-box, flutter_v2ray)** → this avoids the failure class entirely (official WG backend, no tun2socks/xray-in-app).

---

## Status (2026-06-15) — Phases 1–3 DONE; multi-protocol dashboard DONE

- **Phase 1 (server)**: kernel `wg0` on **51822** + TPROXY → xray → Germany, proven (per-peer metering + Germany exit). Migration `0033_wireguard_peers`. **Difference from the original plan**: the backend runs **unprivileged** (`afrows` user), so provisioning + metering moved to a **root reconciler** (`scripts/afrows-wg-reconcile.sh` + systemd timer) — the backend only writes desired peer state to `wireguard_peers`; the reconciler applies `wg set` and writes back `wg show … dump` usage. Keys are generated **in-process** (Node X25519, no `wg` binary needed) and the private key is stored encrypted (SecretVault).
- **Phase 2 (delivery)**: `GET /client/subscription` returns a native `afrows-wg` link with a rendered `.conf` (account-scoped via `buildNativeWireguardConfigLink`/`ensureAccountWireguardPeer`). Creating a WireGuard config in the dashboard provisions its peer eagerly (`provisionWireguardPeerForConfig`), so app + dashboard share one peer. Still TODO: surface the `.conf` + QR in the Configs panel (admin endpoint) for non-app users.
- **Phase 3 (app)**: `wireguard_flutter` engine (`wireguard_vpn.dart`), account login auto-connects over WireGuard (`configText`), app `v2.2.0`.
- **Dashboard multi-protocol**: Customers table shows a **Protocols** column with per-protocol usage; the Edit dialog adds/lists protocols (VLESS + WireGuard); L2TP is hidden pending Phase 4.

---

## Phase 4 — L2TP/IPsec (per-customer) — NOT STARTED

**Goal:** offer L2TP/IPsec as a third per-customer protocol (built-in VPN client on iOS/Android/Windows, no app needed), metered + quota-enforced like VLESS/WireGuard.

**Architecture:** strongSwan (IKEv1/IPsec, PSK) + xl2tpd (L2TP/PPP) on the VPS; PPP hands each user a `10.9.0.x`; route that pool through the same xray TPROXY → Germany egress (mirror the wg0 recipe, scoped to `ppp+`/`10.9.0.0/24`). Per-user credentials in CHAP secrets; usage from PPP/ip accounting.

### Task 4.1: Server install + egress (VPS)
- [ ] `apt-get install -y strongswan xl2tpd ppp` (Ubuntu noble mirror reachable).
- [ ] `/etc/ipsec.conf` + `/etc/ipsec.secrets`: PSK transport for L2TP (`conn L2TP-PSK-NAT`, `type=transport`, `rightprotoport=17/%any`), `AFROWS_L2TP_PSK` from env/secret.
- [ ] `/etc/xl2tpd/xl2tpd.conf` (`ip range = 10.9.0.10-10.9.0.250`, `local ip = 10.9.0.1`) + `/etc/ppp/options.xl2tpd` (ms-dns 1.1.1.1, `require-mschap-v2`, `mtu/mru 1400`).
- [ ] Open UDP **500 + 4500** (+ESP) in ufw; `sysctl` already has ip_forward.
- [ ] Egress: TPROXY-mark `ppp+` / `10.9.0.0/24` → xray `tproxy-in` (reuse the wg0 mangle recipe, scoped). Snapshot iptables/ip rule/route first. Verify a test user exits **Germany** (`162.19.253.235`).
- [ ] `systemctl enable --now strongswan xl2tpd`; verify `ipsec statusall` + an L2TP dial from a phone.

### Task 4.2: Per-user provisioning (root reconciler, mirror wg)
- [ ] Migration `0034_l2tp_accounts`: `l2tp_accounts(id, client_config_id FK unique, username unique, encrypted_password, assigned_ip, rx_bytes, tx_bytes, last_seen_at, desired_state, …)`.
- [ ] Backend (unprivileged): on `createClientConfig protocol='l2tp'`, generate username/password, store encrypted, write desired_state — mirror `provisionWireguardPeerForConfig`.
- [ ] Extend the root reconciler (or a sibling `afrows-l2tp-reconcile`): render `/etc/ppp/chap-secrets` from `l2tp_accounts` (present), reload xl2tpd; meter via `/proc/net/dev` per `ppp` iface or pppd ip-up/ip-down accounting → write `client_configs.used_bytes`.
- [ ] Quota enforcement: disconnect + set desired_state='absent' when over quota.

### Task 4.3: Delivery (backend + dashboard + app)
- [ ] `renderL2tpClientProfile` already exists in `subscription-sanitizers.ts` — wire an `afrows-l2tp` link into `getClientSubscription` (server address + username + password + PSK), gated on `AFROWS_L2TP_*` env.
- [ ] Dashboard: un-hide L2TP in the Add checkboxes / Edit dialog / Configs dropdown (re-add the `'l2tp'` option removed in the v0.114.42 multi-protocol work); show the L2TP profile (server/user/pass/PSK) + setup steps in the Configs panel.
- [ ] App: L2TP uses the OS VPN (no in-app tunnel) — show the profile + a "copy" / platform deep-link rather than connecting in-app (the WireGuard engine can't speak L2TP).

### Task 4.4: Metering + dashboard parity
- [ ] Fold L2TP active users + usage into the Protocols column + dashboard overview (same as wg/vless), so all three protocols meter uniformly.

### Risks (L2TP)
- **IPsec + double-NAT / carrier-grade NAT** in Iran can break IKE; NAT-T (4500) helps but some ISPs block ESP — keep WireGuard as the primary, L2TP as fallback.
- **MSCHAPv2 secrets at rest** → encrypt like WG private keys (SecretVault); never return in list endpoints.
- **MTU/MSS** → clamp (1400/1360) as we already do on the MikroTik path.
