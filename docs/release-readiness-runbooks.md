# AfroGate Release-Readiness Runbooks

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
   `npm --workspace @afrogate/backend run db:migrate`.
5. Put secrets in `/etc/afrogate/afrogate.env` (set `CORS_ORIGIN`,
   `ADMIN_SESSION_SECRET`, `AFROGATE_SUPERADMIN_PASSWORD(_HASH)`,
   `AFROGATE_SECRETS_KEY`, `AFROGATE_RATE_LIMIT_TRUST_PROXY_HEADERS=true`).
6. Install the systemd unit (`infra/ubuntu/afrogate-backend.service.sample`) and
   the Nginx site (`infra/ubuntu/nginx.conf.sample`); reload both.
7. **Verify:**
   - `curl -fsS https://<host>/api/health` returns ok.
   - Dashboard loads over HTTPS; login works with the superadmin account.
   - Security headers present: `curl -sI https://<host>/ | grep -iE 'content-security-policy|strict-transport|x-frame-options'`.
   - Internal ports closed: `ss -ltnp` shows 7000/5432 bound to 127.0.0.1 only; UFW denies them externally.
   - Data-plane/protocol-apply live flags are **off** by default.

Exit criteria: all verify checks pass from a second machine.

---

## 2. Encrypted backup + restore drill  [needs live environment]

Goal: prove a backup can be restored into a fresh database. (The in-app restore
engine is intentionally a read-only stub; backup/restore is operator-run.)

1. Take an encrypted dump:
   `pg_dump "$DATABASE_URL" | gpg --symmetric --cipher-algo AES256 > afrogate-$(date +%F).sql.gpg`.
2. Store off-host; record the backup-status JSON the dashboard reads.
3. Restore into a scratch database:
   `gpg -d afrogate-*.sql.gpg | psql "$SCRATCH_DATABASE_URL"`.
4. **Verify:** row counts for `admin_users`, `customer_accounts`, `client_configs`,
   `payment_orders`, `reseller_wallet_ledger` match the source; app boots against
   the scratch DB and login + a guarded read work.
5. Confirm the dump file is unreadable without the key (`gpg -d` fails without passphrase).

Exit criteria: restored DB is functionally identical and the artifact is encrypted at rest.

---

## 3. Load / scale test toward 10,000 users  [needs live environment]

Goal: confirm the control plane holds under target load (≈150 now → 10k future).
A starter [k6](https://k6.io) script lives at `scripts/loadtest/afrogate-smoke.js`.

```
BASE_URL=https://<host> SESSION_TOKEN=<token> k6 run scripts/loadtest/afrogate-smoke.js
```

Watch: p95 latency on `/api/admin/*` reads, error rate, DB connections, CPU/RAM on
the 4-core/4 GB baseline. Scale virtual users from 50 → 500 → target.

Exit criteria: p95 < 500 ms and error rate < 0.5 % at the intended concurrency,
with DB pool not exhausted.

---

## 4. Independent penetration test  [needs external party]

Goal: third-party validation before paid rollout. AfroGate cannot self-certify.

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

- **Agent tokens:** call the guarded rotate endpoint (revokes active tokens for a
  server, issues one new one-time plaintext token stored only as a SHA-256 hash),
  update the agent's `AFROGATE_AGENT_TOKEN`, confirm metrics ingest resumes and
  the old token is rejected.
- **Session secret (`ADMIN_SESSION_SECRET`):** rotating invalidates existing
  sessions (all admins must re-login) — schedule in a maintenance window.
- **Secrets key (`AFROGATE_SECRETS_KEY`):** re-encrypt `secret_records`/
  `server_credentials` with the new key id; keep the old key id available until
  re-encryption completes. Never remove an old key while ciphertext references it.
- **Provider/webhook secrets:** update env, replay a signed test webhook, confirm
  old signatures are rejected.

Exit criteria: each rotation rehearsed in staging with no data loss and old
credentials confirmed rejected.
