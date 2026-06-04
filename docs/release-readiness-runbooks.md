# Afrows Release-Readiness Runbooks

Operational runbooks for the Phase 6 release-validation items. These are the
executable procedures; the steps that mutate a real server or require an
external party are marked **[needs live environment]** / **[needs external party]**
and must be run by an operator — they cannot be completed in CI or by an agent.

---

## 1. Ubuntu install drill  [needs live environment]

Goal: prove `docs/enterprise-deployment-guide.md` produces a working control plane
on a clean Ubuntu host.

1. Provision a clean Ubuntu 22.04/24.04 VM. Snapshot it so the drill is repeatable.
2. Install Node ≥ 22, PostgreSQL, and Nginx.
3. Create the least-privilege DB roles:
   `psql -f infra/postgres/least-privilege-roles.sql` then verify with
   `infra/postgres/verify-least-privilege.sql`.
4. Apply migrations with `DATABASE_MIGRATION_URL` (migrator role):
   `npm --workspace @afrows/backend run db:migrate`.
5. Put secrets in `/etc/afrows/afrows.env` (set `CORS_ORIGIN`,
   `ADMIN_SESSION_SECRET`, `AFROWS_SUPERADMIN_PASSWORD(_HASH)`,
   `AFROWS_SECRETS_KEY`, `AFROWS_RATE_LIMIT_TRUST_PROXY_HEADERS=true`).
6. Install the systemd unit (`infra/ubuntu/afrows-backend.service.sample`) and
   the Nginx site (`infra/ubuntu/nginx.conf.sample`); reload both.
7. **Verify** — run the bundled verifier (health + security headers + loopback-only ports):
   ```
   BASE_URL=https://<host> scripts/drills/verify-install.sh             # from a second machine
   BASE_URL=https://<host> HOST_LOCAL=1 scripts/drills/verify-install.sh # on the host (adds port checks)
   ```
   Then confirm manually:
   - Dashboard loads over HTTPS; login works with the superadmin account.
   - Data-plane/protocol-apply live flags are **off** by default.

Exit criteria: `verify-install.sh` exits 0 from a second machine and the manual checks pass.

---

## 2. Encrypted backup + restore drill  [needs live environment]

Goal: prove a backup can be restored into a fresh database. (The in-app restore
engine is intentionally a read-only stub; backup/restore is operator-run.)

Run the bundled drill (dump+encrypt → restore to scratch → row-count parity +
encryption check). **Destructive to the scratch DB only; the source is read-only.**
```
DATABASE_URL=postgres://...source... \
SCRATCH_DATABASE_URL=postgres://...scratch-OVERWRITTEN... \
BACKUP_PASSPHRASE=... \
  scripts/drills/backup-restore-drill.sh
```
It verifies row counts for `admin_users`, `customer_accounts`, `client_configs`,
`payment_orders`, `reseller_wallet_ledger` and that the artifact cannot be decrypted
with a wrong passphrase. Then confirm manually that the app boots against the scratch
DB and that login + a guarded read work.

Exit criteria: `backup-restore-drill.sh` exits 0 and the restored DB serves the app.

---

## 3. Load / scale test toward 10,000 users  [needs live environment]

Goal: confirm the control plane holds under target load (≈150 now → 10k future).

**Capacity model — read this first.** This backend is the *control plane*, not the
data path. VPN client traffic flows through the WireGuard/data-plane servers, so
10,000 users does **not** mean 10,000 concurrent requests here. The three real
traffic classes are: client subscription/quota polls (the 10k-user driver, but
low frequency per client), agent heartbeats (one per managed server), and admin
dashboard reads (a few operators). The [k6](https://k6.io) script
`scripts/loadtest/afrows-smoke.js` models all three as weighted scenarios:

```
BASE_URL=https://<host> \
CLIENT_TOKEN=<client bearer> AGENT_TOKEN=<agent bearer> SESSION_TOKEN=<admin bearer> \
PEAK_CLIENTS=500 PEAK_AGENTS=50 PEAK_ADMINS=10 \
  k6 run scripts/loadtest/afrows-smoke.js
```

Each class is skipped if its token is omitted. Scale `PEAK_*` toward the target.

Watch: p95 latency per class, error rate, DB pool wait/exhaustion, CPU/RAM on the
4-core/4 GB baseline.

**Tuning levers (apply as load testing reveals limits):**
- **Run multiple backend processes** behind Nginx — Node is single-threaded, so one
  process uses one core. On a 4-core box run ~3–4 instances (systemd templated unit
  or a process manager) load-balanced by Nginx. This is the biggest single lever.
- **`DATABASE_POOL_MAX`** — default 5 per process; raise to ~10–20 under load, but keep
  `pool_max × processes < PostgreSQL max_connections`. For many processes, front
  PostgreSQL with **PgBouncer** (transaction pooling).
- **Multi-instance state** — rate limiting and any in-memory cache are per-process.
  Single host with Nginx sticky routing is fine; true horizontal scale-out needs a
  shared store (e.g. Redis) for rate limits.
- **Hot read caching** — add a short TTL on subscription/quota reads if they dominate.

Exit criteria: p95 < 500 ms and error rate < 0.5 % at the intended concurrency,
with the DB pool not exhausted.

---

## 4. Independent penetration test  [needs external party]

Goal: third-party validation before paid rollout. Afrows cannot self-certify.

Scope to hand the auditor:
- Auth/session: login brute force + rate limits, session token forgery/expiry, role escalation across `owner/admin/supervisor/support/auditor/reseller`.
- Multi-tenant isolation: reseller IDOR (own customers/wallet only), client-token scoping.
- Billing integrity: wallet/quota math, payment-order allocation idempotency, webhook forgery (PayPal/rewarded-ad/Telegram).
- Injection: SQLi, command injection in the protocol-apply path, SSRF via outbound targets, XSS in the dashboard.
- Infra: TLS config, security headers/CSP, exposed ports, secret handling.

Provide the auditor: this repo's threat models (`docs/security-threat-model.md`,
`docs/privacy-threat-model.md`), a staging deploy, and non-prod test accounts.

Exit criteria: report received; criticals/highs remediated and re-tested.

---

## 5. Agent-token & secret rotation rehearsal  [partly live]

Goal: rehearse rotation without downtime.

- **Agent tokens:** call the guarded rotate endpoint
  (`POST /api/agents/:serverId/tokens/rotate` — revokes active tokens for a server,
  issues one new one-time plaintext token stored only as a SHA-256 hash), update the
  agent's `AFROWS_AGENT_TOKEN`, then verify with the bundled checker:
  ```
  BASE_URL=https://<host> OLD_AGENT_TOKEN=... NEW_AGENT_TOKEN=... \
    scripts/drills/verify-rotation.sh
  ```
  (confirms the old token is rejected and the new one authenticates at the
  heartbeat endpoint).
- **Session secret (`ADMIN_SESSION_SECRET`):** rotating invalidates existing
  sessions (all admins must re-login) — schedule in a maintenance window.
- **Secrets key (`AFROWS_SECRETS_KEY`):** re-encrypt `secret_records`/
  `server_credentials` with the new key id; keep the old key id available until
  re-encryption completes. Never remove an old key while ciphertext references it.
- **Provider/webhook secrets:** update env, replay a signed test webhook, confirm
  old signatures are rejected.

Exit criteria: each rotation rehearsed in staging with no data loss and old
credentials confirmed rejected.
