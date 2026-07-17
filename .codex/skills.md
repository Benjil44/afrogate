# Afrows Skills and Workflows

## Required Agent Skills

### Product Analysis

- Convert operational notes into clear requirements.
- Keep MVP scope separate from enterprise roadmap.
- Re-check `.codex/memory.md` before changing assumptions.

### Infrastructure Monitoring

- Model server health: CPU, RAM, disk, network throughput, service status.
- Model tunnel health: ping, jitter, packet loss, rx/tx, up/down, health score.
- Treat storage below 10% as a critical alert.
- Measure outbound throughput backend-on-box: spawn a throwaway xray SOCKS proxy bound to the outbound (`outbound-xray-config.ts` + `outbound-speed-test.service.ts`) and transfer through it; probe `config.address` for latency, not the SNI/camouflage `config.host`. Reachability is vantage-dependent (an outbound healthy from one network can be dead from another).

### Native VPN engine (xray) — operating notes

- Afrows runs its own user-facing xray (`afrows-xray`, separate from the uplink client). User inbound = **VLESS+Reality on 443**, sharing the port with the panel via Reality `dest`→ local nginx (nginx moved to `127.0.0.1:8444`). High ports (8443) are filtered in Ireland — use 443 + a domain (`app.afrows.com`).
- **Reality clients REQUIRE** `publicKey` (pbk), `shortId` (sid), `fingerprint` (fp=chrome), and the matching `flow` — an empty fingerprint/pbk/sid makes the core fail ("empty fingerprint") or fall back silently (looks connected, 0 traffic). Always **import** the link, never hand-type.
- Per-user provisioning: `xray api adu/rmu` against the local API (`127.0.0.1:10085`), reconciled from Postgres by `XrayProvisioningService`. Subscription emits the entry link from `AFROWS_INBOUND_*` env + the client's `entry_uuid`.
- **Diagnosis:** to isolate server vs client, run a Reality client ON the box against the public IP; check `journalctl -u afrows-xray` for `afrows-in -> proxy` accepts (Reality fallback to nginx is NOT logged). Ship a visible **app version** so the operator can confirm the installed APK (an old APK on a dead config also shows 0 traffic).

### Inbound Reachability / Anti-Filtering

- Keep the site reachable from any network: the raw Ireland VPS IP is filtered, so universal access (users → landing + panel) needs a CDN/front (ArvanCloud preferred for sanction-safety; Cloudflare+ECH as an alternative), with origin-IP hiding and the cross-subdomain login flow preserved.
- Diagnose access failures client-vs-server first: ping bypasses browser proxies, caches mask failures; confirm via hard reload + check for a client-side (v2ray) proxy before assuming a server/DPI fault.

### Network Routing

- Build route scoring with hysteresis and cooldown.
- Support auto route and route lock.
- Record route decision reasons for audit and debugging.

### Privacy and Safety

- Minimize user data collection.
- Store Telegram identity and paid number only when needed.
- Avoid long-term IP history unless justified by security needs and retention rules.
- Encrypt sensitive fields and backups.
- Keep admin-user management privacy-safe: never commit admin passwords, runtime admin-user files, or real account data; store only password hashes in the configured runtime store.
- Preserve the immutable `superadmin` account rule when building role, user, or settings workflows.

### Telegram Operations

- Send admin alerts through Telegram.
- Let users check volume, subscription state, and charge status through Telegram bot.
- Use webhook secrets and do not commit bot tokens.

### Implementation Hygiene

- Add tests around shared logic, billing math, route scoring, and alert thresholds.
- Update docs as architecture stabilizes.
- Keep `.env.example` current once apps are scaffolded.
- Avoid committing generated files, logs, local databases, or backups.
- Use the local `afrows-versioning` plugin/skill after meaningful implementation sections so versions, `CHANGELOG.md`, and sidebar display stay aligned.

## Future App Skills

- Dashboard frontend.
- Backend API.
- Server agent.
- Telegram bot.
- Billing and usage accounting.
- Backup and restore.
- Marzban/X-UI integration.
