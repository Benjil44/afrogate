# Device / IP visibility — F1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Show, per customer, active device count (≈ distinct source IPs, 10-min window) + the IP list, by enabling real client IPs on the WS path (PROXY protocol) and parsing xray's access log into a sightings table. Visibility only — no enforcement.

**Architecture:** logrotate the xray logs; enable PROXY protocol nginx↔xray so xray logs real WS client IPs (test-and-revert); a backend service tails the access log → upserts `client_device_sightings`; an admin endpoint + dashboard section surface it.

**Tech Stack:** NestJS, Postgres, `node --test`, nginx + xray on the VPS, React dashboard.

**Spec:** `docs/superpowers/specs/2026-06-26-device-ip-visibility-f1-design.md`

**Risk note:** Task 2 (PROXY protocol) can drop all VLESS-WS users if mismatched — follow its test-and-revert exactly. Tasks 1, 3–6 are safe/standard.

---

### Task 1: F1.0 — logrotate for xray logs (safe)

**Files:** Create `scripts/afrows-xray-logrotate` (repo copy) + install to `/etc/logrotate.d/afrows-xray` on the VPS.

- [ ] **Step 1: Create the repo file** `scripts/afrows-xray-logrotate`:
```
/var/log/afrows-xray/*.log {
  daily
  rotate 7
  missingok
  notifempty
  compress
  delaycompress
  copytruncate
}
```
(`copytruncate` = xray keeps writing the same path; the parser tolerates the truncate via offset-reset in Task 4.)

- [ ] **Step 2: Install on the VPS + force a first rotation**

Run (operator/agent shell):
```bash
scp -i ~/.ssh/afrogate_deploy scripts/afrows-xray-logrotate root@94.74.145.199:/etc/logrotate.d/afrows-xray
ssh -i ~/.ssh/afrogate_deploy root@94.74.145.199 'sed -i "s/\r$//" /etc/logrotate.d/afrows-xray; logrotate -f /etc/logrotate.d/afrows-xray; ls -la /var/log/afrows-xray/'
```
Expected: `access.log` truncated/rotated; `access.log.1` (or `.gz`) present; xray still writing `access.log`.

- [ ] **Step 3: Commit**
```bash
git add scripts/afrows-xray-logrotate
git commit -m "ops(xray): logrotate for afrows-xray access/error logs (copytruncate)"
```

---

### Task 2: F1.1 — PROXY protocol nginx ↔ xray (RISKY; test-and-revert)

**Files:** VPS configs only — `/etc/nginx/sites-enabled/afrows` and `/usr/local/etc/afrows-xray/config.json`. No repo change (these are box-managed).

- [ ] **Step 1: Back up both configs**
```bash
ssh -i ~/.ssh/afrogate_deploy root@94.74.145.199 'cp -a /etc/nginx/sites-enabled/afrows /root/afrows-nginx.bak.$(date +%s); cp -a /usr/local/etc/afrows-xray/config.json /root/afrows-xray.bak.$(date +%s); echo backed-up'
```

- [ ] **Step 2: Add `acceptProxyProtocol` to the xray afrows-in inbound**

The inbound currently has `streamSettings: { network: ws, security: none, wsSettings: { path: /afrowsws } }` and no `sockopt`. Add `sockopt.acceptProxyProtocol: true` to `afrows-in` only. Run on the VPS:
```bash
ssh -i ~/.ssh/afrogate_deploy root@94.74.145.199 'python3 - <<PY
import json
p="/usr/local/etc/afrows-xray/config.json"
c=json.load(open(p))
for ib in c["inbounds"]:
    if ib.get("tag")=="afrows-in":
        ss=ib.setdefault("streamSettings",{})
        ss.setdefault("sockopt",{})["acceptProxyProtocol"]=True
json.dump(c,open(p,"w"),indent=2)
print("set acceptProxyProtocol on afrows-in")
PY'
```
> NOTE: confirm `sockopt.acceptProxyProtocol` is the correct location for xray 26.3.x (it is in current Xray-core). If a newer schema moved it, adjust before restart.

- [ ] **Step 3: Add `proxy_protocol on;` to the nginx /afrowsws upstream**

In `/etc/nginx/sites-enabled/afrows`, inside `location /afrowsws { … }`, add `proxy_protocol on;` next to the `proxy_pass http://127.0.0.1:8447;` line. Run:
```bash
ssh -i ~/.ssh/afrogate_deploy root@94.74.145.199 'sed -i "/location \/afrowsws/,/}/ s|proxy_pass http://127.0.0.1:8447;|proxy_pass http://127.0.0.1:8447;\n        proxy_protocol on;|" /etc/nginx/sites-enabled/afrows; nginx -t'
```
Expected: `nginx -t` → "syntax is ok / test is successful". If not, **stop and revert** (Step 6).

- [ ] **Step 4: Apply both together**
```bash
ssh -i ~/.ssh/afrogate_deploy root@94.74.145.199 'systemctl restart afrows-xray && sleep 2 && systemctl reload nginx && echo applied'
```

- [ ] **Step 5: Validate the real WS path immediately**

Run a temp xray client through 443 (TLS+WS) with a known UUID and confirm browsing works AND the access log now shows a real IP:
```bash
ssh -i ~/.ssh/afrogate_deploy root@94.74.145.199 'bash -s' <<'EOF'
XR=$(command -v xray || echo /usr/local/bin/xray)
cat >/tmp/pp-test.json <<JSON
{ "inbounds":[{"tag":"s","port":10889,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],
  "outbounds":[{"tag":"o","protocol":"vless",
    "settings":{"vnext":[{"address":"app.afrows.com","port":443,"users":[{"id":"64dc4f30-06c8-40ab-a980-59e2764dedb3","encryption":"none"}]}]},
    "streamSettings":{"network":"ws","security":"tls","tlsSettings":{"serverName":"app.afrows.com"},"wsSettings":{"path":"/afrowsws","headers":{"Host":"app.afrows.com"}}}}] }
JSON
$XR run -c /tmp/pp-test.json >/tmp/pp-test.log 2>&1 & P=$!; sleep 3
curl -s -o /dev/null -w "WS-through-443 google: %{http_code}\n" --max-time 15 --socks5-hostname 127.0.0.1:10889 https://www.google.com/generate_204
kill $P 2>/dev/null; rm -f /tmp/pp-test.json /tmp/pp-test.log
echo "--- newest afrows-in access lines (expect a NON-127.0.0.1 source) ---"
grep "afrows-in ->" /var/log/afrows-xray/access.log | tail -3
EOF
```
Expected: `google: 204` AND the access lines show a real public IP in `from <ip>` (not 127.0.0.1).

- [ ] **Step 6: If validation FAILS — revert immediately**
```bash
ssh -i ~/.ssh/afrogate_deploy root@94.74.145.199 'cp -a $(ls -t /root/afrows-xray.bak.* | head -1) /usr/local/etc/afrows-xray/config.json; cp -a $(ls -t /root/afrows-nginx.bak.* | head -1) /etc/nginx/sites-enabled/afrows; systemctl restart afrows-xray; nginx -t && systemctl reload nginx; echo REVERTED'
```
Then re-run the Step 5 curl (without proxy-protocol it must pass again) and STOP — escalate.

- [ ] **Step 7: Record success** — note in the session that F1.1 is live (real WS IPs now logged). No repo commit (box config).

---

### Task 3: F1.2a — sightings table + pure parser (TDD)

**Files:**
- Create: `infra/postgres/migrations/0047_client_device_sightings.sql`
- Create: `apps/backend/src/client/access-log-parse.ts`
- Test: `apps/backend/test/access-log-parse.test.ts`

- [ ] **Step 1: Migration**
```sql
-- Per-(config, source IP) device sightings, stamped by the access-log parser.
-- Drives F1 device/IP visibility. Pruned to a short retention by the parser.
CREATE TABLE IF NOT EXISTS client_device_sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id uuid NOT NULL REFERENCES client_configs(id) ON DELETE CASCADE,
  source_ip text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  hits bigint NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS client_device_sightings_uniq
  ON client_device_sightings (client_config_id, source_ip);
CREATE INDEX IF NOT EXISTS client_device_sightings_last_seen_idx
  ON client_device_sightings (last_seen_at);
```

- [ ] **Step 2: Failing test** `apps/backend/test/access-log-parse.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAccessLogLine } from '../src/client/access-log-parse.ts';

test('extracts {configId, ip} from a real afrows-in line', () => {
  const line = '2026/06/26 15:21:55.200222 from 203.0.113.7:42744 accepted tcp:34.120.33.51:443 [afrows-in -> via-germany] email: cc_fc78481a-d9fe-4d17-a89b-3c493f1152e0@afrows';
  assert.deepEqual(parseAccessLogLine(line), { configId: 'fc78481a-d9fe-4d17-a89b-3c493f1152e0', ip: '203.0.113.7' });
});

test('ignores localhost + non-matching lines', () => {
  assert.equal(parseAccessLogLine('... from 127.0.0.1:5 accepted tcp:x [afrows-in -> y] email: cc_abc@afrows'), null);
  assert.equal(parseAccessLogLine('random log line'), null);
  assert.equal(parseAccessLogLine('... from [::1]:5 accepted ... email: cc_abc@afrows'), null);
});

test('handles IPv6 source', () => {
  const line = '2026/.. from [2a01:4f8:1:2::3]:51000 accepted tcp:y:443 [afrows-in -> z] email: cc_dead-beef@afrows';
  assert.deepEqual(parseAccessLogLine(line), { configId: 'dead-beef', ip: '2a01:4f8:1:2::3' });
});
```

- [ ] **Step 3: Run → fail** `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/backend/test/access-log-parse.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement** `apps/backend/src/client/access-log-parse.ts`:
```ts
const LINE = / from (\[[0-9a-fA-F:]+\]|\d+\.\d+\.\d+\.\d+):\d+ accepted .* email: cc_([0-9a-zA-Z-]+)@afrows/;
const LOCAL = new Set(['127.0.0.1', '::1']);

export function parseAccessLogLine(line: string): { configId: string; ip: string } | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const ip = m[1].startsWith('[') ? m[1].slice(1, -1) : m[1];
  if (LOCAL.has(ip)) return null;
  return { configId: m[2], ip };
}
```

- [ ] **Step 5: Run → pass** (same command) → `# pass 3`.

- [ ] **Step 6: Commit**
```bash
git add infra/postgres/migrations/0047_client_device_sightings.sql apps/backend/src/client/access-log-parse.ts apps/backend/test/access-log-parse.test.ts
git commit -m "feat(backend): device-sightings table + access-log line parser (F1.2a)"
```

---

### Task 4: F1.2b — access-log parser service

**Files:** Create `apps/backend/src/client/xray-access-log.service.ts`; modify `apps/backend/src/app.module.ts` (import + providers ~line 104).

- [ ] **Step 1: Create the service** (mirrors `XrayUsageMeteringService`: flag-gated, timer, no-op in dev):
```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import { DatabaseService } from '../database/database.service';
import { parseAccessLogLine } from './access-log-parse';

@Injectable()
export class XrayAccessLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XrayAccessLogService.name);
  private timer: NodeJS.Timeout | undefined;
  private offset = 0;
  private running = false;

  constructor(private readonly config: ConfigService, private readonly database: DatabaseService) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.flag('AFROWS_ACCESS_LOG_PARSER_ENABLED', true)) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs());
    this.timer.unref?.();
  }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  private path(): string { return this.config.get<string>('AFROWS_XRAY_ACCESS_LOG')?.trim() || '/var/log/afrows-xray/access.log'; }
  private intervalMs(): number { const n = Number(this.config.get('AFROWS_ACCESS_LOG_INTERVAL_SECONDS')); return (Number.isInteger(n) ? Math.min(Math.max(n, 15), 600) : 30) * 1000; }
  private retentionDays(): number { const n = Number(this.config.get('AFROWS_DEVICE_SIGHTING_RETENTION_DAYS')); return Number.isInteger(n) ? Math.min(Math.max(n, 1), 90) : 7; }
  private flag(name: string, fb: boolean): boolean { const v = this.config.get<string>(name)?.trim().toLowerCase(); return v ? ['1','true','yes','on'].includes(v) : fb; }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const file = this.path();
      let size: number;
      try { size = (await fsp.stat(file)).size; } catch { return; }
      if (size < this.offset) this.offset = 0; // rotation / copytruncate
      if (size === this.offset) { await this.prune(); return; }
      const chunk = await this.readFrom(file, this.offset, size);
      this.offset = size;
      // dedupe (configId,ip) within this batch to one upsert each
      const seen = new Map<string, { configId: string; ip: string }>();
      for (const line of chunk.split('\n')) {
        const r = parseAccessLogLine(line);
        if (r) seen.set(`${r.configId}|${r.ip}`, r);
      }
      for (const { configId, ip } of seen.values()) {
        await this.database.query(
          `INSERT INTO client_device_sightings (client_config_id, source_ip)
             VALUES ($1, $2)
           ON CONFLICT (client_config_id, source_ip)
             DO UPDATE SET last_seen_at = now(), hits = client_device_sightings.hits + 1`,
          [configId, ip],
        ).catch(() => undefined); // unknown config id (FK) — ignore
      }
      if (seen.size) this.logger.log(`Device sightings: upserted ${seen.size}`);
      await this.prune();
    } catch (e) {
      this.logger.warn(`Access-log tick failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
  }

  private async prune(): Promise<void> {
    await this.database.query(
      `DELETE FROM client_device_sightings WHERE last_seen_at < now() - ($1 || ' days')::interval`,
      [String(this.retentionDays())],
    ).catch(() => undefined);
  }

  private readFrom(file: string, start: number, end: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      fs.createReadStream(file, { start, end: end - 1 })
        .on('data', (d) => chunks.push(d as Buffer))
        .on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        .on('error', reject);
    });
  }
}
```

- [ ] **Step 2: Register in `app.module.ts`** — add the import near the other client services and add `XrayAccessLogService,` to the `providers` array (after `WireguardMeteringService,`).

- [ ] **Step 3: Backend build** `npm --workspace @afrows/backend run build` → clean.

- [ ] **Step 4: Commit**
```bash
git add apps/backend/src/client/xray-access-log.service.ts apps/backend/src/app.module.ts
git commit -m "feat(backend): access-log parser service -> client_device_sightings (F1.2b)"
```

---

### Task 5: F1.3a — devices API

**Files:** `apps/backend/src/billing/billing.service.ts` (new method), `apps/backend/src/billing/billing.controller.ts` (~after :511), `packages/shared/src/index.ts` (response type), `apps/dashboard/src/api/admin.ts` (wrapper).

- [ ] **Step 1: Shared type** in `packages/shared/src/index.ts`:
```ts
export interface AdminCustomerDeviceSighting {
  clientConfigId: string;
  protocol: string;
  sourceIp: string;
  firstSeenAt: string;
  lastSeenAt: string;
  hits: number;
  active: boolean;
}
export interface AdminCustomerDevicesResponse {
  customerAccountId: string;
  activeCount: number;
  devices: AdminCustomerDeviceSighting[];
}
```

- [ ] **Step 2: Service method** in `billing.service.ts`:
```ts
async getCustomerDevices(customerAccountId: string): Promise<{ customerAccountId: string; activeCount: number; devices: Array<{ clientConfigId: string; protocol: string; sourceIp: string; firstSeenAt: Date; lastSeenAt: Date; hits: number; active: boolean }> }> {
  const res = await this.database.query<{ clientConfigId: string; protocol: string; sourceIp: string; firstSeenAt: Date; lastSeenAt: Date; hits: number; active: boolean }>(
    `SELECT s.client_config_id AS "clientConfigId", cc.protocol AS "protocol",
            s.source_ip AS "sourceIp", s.first_seen_at AS "firstSeenAt",
            s.last_seen_at AS "lastSeenAt", s.hits AS "hits",
            (s.last_seen_at > now() - interval '10 minutes') AS "active"
       FROM client_device_sightings s
       JOIN client_configs cc ON cc.id = s.client_config_id
      WHERE cc.customer_account_id = $1
      ORDER BY s.last_seen_at DESC`,
    [customerAccountId],
  );
  return { customerAccountId, activeCount: res.rows.filter((r) => r.active).length, devices: res.rows };
}
```

- [ ] **Step 3: Controller route** after `getCustomerAccount` (~:516):
```ts
  @Get('customer-accounts/:id/devices')
  getCustomerDevices(@Param('id') id: string) {
    return this.billingService.getCustomerDevices(id);
  }
```
(Match the auth guards/decorators on the neighboring `getCustomerAccount`.)

- [ ] **Step 4: Dashboard API wrapper** in `apps/dashboard/src/api/admin.ts`:
```ts
export async function fetchAdminCustomerDevices(sessionToken: string, accountId: string, signal?: AbortSignal): Promise<AdminCustomerDevicesResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(accountId)}/devices`, { headers: createSessionHeaders(sessionToken), signal });
  return response.json() as Promise<AdminCustomerDevicesResponse>;
}
```
(Import `AdminCustomerDevicesResponse` from `@afrows/shared`.)

- [ ] **Step 5: Build** `npm --workspace @afrows/backend run build` + `npm --workspace @afrows/dashboard run typecheck` → clean.

- [ ] **Step 6: Commit**
```bash
git add packages/shared/src/index.ts apps/backend/src/billing/billing.service.ts apps/backend/src/billing/billing.controller.ts apps/dashboard/src/api/admin.ts
git commit -m "feat(backend): GET customer-accounts/:id/devices + dashboard wrapper (F1.3a)"
```

---

### Task 6: F1.3b — Devices section in the customer view

**Files:** `apps/dashboard/src/pages/CustomersPage.tsx`; i18n `customersPage` (en+fa).

- [ ] **Step 1: i18n** — add to `customersPage` (en) + fa:
```ts
      devicesSection: 'Devices',
      devicesActive: 'active now',
      devicesNone: 'No device activity recorded yet.',
      devicesCaveat: 'IP ≈ device; mobile networks rotate IPs.',
      devicesColIp: 'IP',
      devicesColLastSeen: 'Last seen',
      devicesColHits: 'Hits',
```
(fa: «دستگاه‌ها» / «اکنون فعال» / «هنوز فعالیتی ثبت نشده» / «IP ≈ دستگاه؛ شبکه موبایل IP را می‌چرخاند.» / «IP» / «آخرین اتصال» / «دفعات».)

- [ ] **Step 2: State + load** — in the edit view (gated on `editId`), add state `const [devices, setDevices] = useState<AdminCustomerDeviceSighting[]>([]); const [devicesActive, setDevicesActive] = useState(0);` and, in `openEdit`'s loader (added in D1), also call `fetchAdminCustomerDevices(sessionToken, a.id)` → set both. Import the fn + type.

- [ ] **Step 3: Render the section** after the gateway section in the edit view:
```tsx
            {editId ? (
              <div className="grid gap-2 md:col-span-2">
                <span className="text-[13px] font-bold text-afro-muted">{s.devicesSection} · {devicesActive} {s.devicesActive}</span>
                {devices.length === 0 ? (
                  <span className="text-[12px] text-afro-muted">{s.devicesNone}</span>
                ) : (
                  <div className="grid gap-1">
                    {devices.map((d) => (
                      <div key={`${d.clientConfigId}-${d.sourceIp}`} className={`flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] ${d.active ? 'border-afro-teal' : 'border-afro-line'}`}>
                        <span className="font-bold uppercase tracking-wide text-afro-ink">{d.protocol}</span>
                        <span className="font-mono" dir="ltr">{d.sourceIp}</span>
                        <span className="text-afro-muted">{s.devicesColLastSeen}: {format.time(new Date(d.lastSeenAt), false)}</span>
                        <span className="text-afro-muted">{s.devicesColHits}: {d.hits}</span>
                        {d.active ? <span className="inline-flex h-2 w-2 rounded-full bg-afro-teal" /> : null}
                      </div>
                    ))}
                  </div>
                )}
                <span className="text-[11px] text-afro-muted">{s.devicesCaveat}</span>
              </div>
            ) : null}
```

- [ ] **Step 4: typecheck + build** → clean.

- [ ] **Step 5: Commit**
```bash
git add apps/dashboard/src/pages/CustomersPage.tsx apps/dashboard/src/i18n.en.ts apps/dashboard/src/i18n.fa.ts
git commit -m "feat(dashboard): per-customer Devices (IP/last-seen) section (F1.3b)"
```

---

### Task 7: Deploy + manual verification

- [ ] **Step 1:** Merge to `main`, push, deploy via `sync.ps1` (runs migration 0047). Confirm backend health + `0047` applied.
- [ ] **Step 2:** Confirm the parser is running: `journalctl -u afrows-backend --since -3min | grep "Device sightings"` shows upserts.
- [ ] **Step 3:** Open a customer who's actively connected → **Devices** section shows their real IP(s), last-seen, hits; active dot for recent ones.
- [ ] **Step 4:** A customer on two devices/networks shows two IPs; entries age out of "active" after 10 min; sightings still listed until 7-day prune.
- [ ] **Step 5:** FA strings render.

---

## Self-Review

**1. Spec coverage:** logrotate (T1), PROXY protocol + test/revert (T2), table+parser (T3/T4), API (T5), dashboard (T6), deploy/verify (T7). WireGuard-IP coverage is noted in the spec as "if cheap" — deferred here to keep F1 focused on the access-log path (VLESS); add as a follow-up. ✓
**2. Placeholders:** Every step has concrete commands/code; the one NOTE (verify `acceptProxyProtocol` location for xray 26.3.x) is a verification action. ✓
**3. Type consistency:** `parseAccessLogLine` → `{configId, ip}` used by the service; `client_device_sightings` columns match the INSERT/SELECT; `AdminCustomerDevicesResponse`/`AdminCustomerDeviceSighting` defined T5, consumed T5 wrapper + T6; `fetchAdminCustomerDevices` defined T5, used T6. ✓
