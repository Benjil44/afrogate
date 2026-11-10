# Afrows -> Hexogate per-country egress: inbound / subscription CONTRACT

The operator owns both Afrows and Hexogate. This chains a customer through Afrows's own
metered Iran inbound into Hexogate's exit capacity, per country:

```
customer --TLS+WS--> nginx :443 --WS /afrowsws-<cc>--> Afrows Iran inbound  hexo-in-<cc>
         (bytes metered at hexo-in-<cc>, as today)
         ------------------------------------------->   outbound             hexo-<cc>   (a Hexogate .ir front)
         ------------------------------------------->   Hexogate exit in <cc>
```

Customers receive **Afrows** entries (kind `hexo`, remark `Hexo <CC>`). The operator's
Hexogate UUID/subscription token never appears in any customer-facing output or in the
repo — the entry authenticates with the customer's **own** Afrows uuid; the Hexogate
credential lives only inside the `hexo-<cc>` outbound, which is built at runtime from
`AFROWS_HEXO_SUB_URL` and never logged.

## Customer entry transport: WS behind nginx TLS (NOT REALITY)

The LIVE Afrows Iran box has **no REALITY inbound**. Customers enter over nginx TLS on
`:443` and are proxied to a loopback xray WS inbound. Verified on the box: the main
customer inbound `afrows-in` is `network=ws, security=none, listen=127.0.0.1:8447,
wsSettings.path=/afrowsws`, with nginx `location /afrowsws { proxy_pass
http://127.0.0.1:8447; }`. The hexo entries MUST follow the same model — WS-behind-nginx,
not raw REALITY ports — so each `hexo-in-<cc>` is cloned from `afrows-in` and kept on
`127.0.0.1` with its own ws path `/afrowsws-<cc>`; nginx terminates TLS on `:443` and
proxies each path to the matching loopback port.

## Inbound topology decision: N small per-country WS inbounds (chosen)

One lightweight WS inbound per country (`hexo-in-<cc>`), each on its own loopback port
and its own ws path, each routed to its country's outbound. Chosen over a single inbound
with per-country routing, for concrete reasons:

- **xray cannot split one inbound to N outbounds without a per-country signal.** Routing
  matchers are `inboundTag` / `user` / `source` / `port` / sniffed `domain`. A single
  shared inbound carries no per-country signal except the port, so "one inbound, many
  countries" collapses back to either N ports (N inbounds) or N user-emails per customer
  (which would fork the per-user metering email and break accounting). N inbounds is the
  honest form of the only thing that actually works.
- A WS path is a clean per-country selector: one nginx `location = /afrowsws-<cc>` maps to
  one loopback port maps to one inbound tag. No fake SNI, no domain sniffing on an
  encrypted hello.
- A customer needs a **distinct entry link per country anyway** (distinct remark, distinct
  target the app shows), so N inbounds costs nothing extra on the subscription side.

**Footprint:** each `hexo-in-<cc>` clones the source ws inbound's identity (same transport,
no new key material) and starts with an EMPTY client list. Memory is ~`N × clients` entries
(150 users × 7 ≈ 1 050 — negligible; 10 000 × 7 ≈ 70 000 — acceptable, flagged for scale).
CPU/listeners: 7 extra loopback TCP listeners + 7 nginx location blocks, no extra process,
no extra TLS certs (the existing `app.afrows.com` cert already covers `:443`). This stays
within the low-resource-VPS budget.

**Metering is unchanged.** The hexo inbounds reuse the **same customer uuid and the same
per-user email** (`cc_<id>@afrows`) as the main `afrows-in` inbound. xray aggregates
`user>>><email>>>>traffic` across every inbound, so bytes a customer sends through
`hexo-in-nl` are counted exactly as if they went through `afrows-in`. Billing reads the
same per-user stats on the same xray instance; no accounting path changes. No customer is
ever routed directly to a raw Hexogate link.

## Per-country table

| Country | Inbound tag  | Loopback port | WS path          | Transport (customer side)      | Outbound tag | Entry kind | Remark   |
|---------|--------------|---------------|------------------|--------------------------------|--------------|------------|----------|
| DE      | `hexo-in-de` | 8460          | `/afrowsws-de`   | VLESS WS behind nginx TLS :443 | `hexo-de`    | `hexo`     | `Hexo DE`|
| NL      | `hexo-in-nl` | 8461          | `/afrowsws-nl`   | VLESS WS behind nginx TLS :443 | `hexo-nl`    | `hexo`     | `Hexo NL`|
| SE      | `hexo-in-se` | 8462          | `/afrowsws-se`   | VLESS WS behind nginx TLS :443 | `hexo-se`    | `hexo`     | `Hexo SE`|
| TR      | `hexo-in-tr` | 8463          | `/afrowsws-tr`   | VLESS WS behind nginx TLS :443 | `hexo-tr`    | `hexo`     | `Hexo TR`|
| US      | `hexo-in-us` | 8464          | `/afrowsws-us`   | VLESS WS behind nginx TLS :443 | `hexo-us`    | `hexo`     | `Hexo US`|
| AM      | `hexo-in-am` | 8465          | `/afrowsws-am`   | VLESS WS behind nginx TLS :443 | `hexo-am`    | `hexo`     | `Hexo AM`|
| RO      | `hexo-in-ro` | 8466          | `/afrowsws-ro`   | VLESS WS behind nginx TLS :443 | `hexo-ro`    | `hexo`     | `Hexo RO`|

- **Ports 8460–8466 are free** (verified against the repo + `afrows-egress-mode-sync.py`:
  used ports are 443, 8080, 8443, 8447, 8448, 10085/10086, 10808/10812/10813; Hexogate
  front ports 2053/2086/2087/… are the *outbound* side, not Afrows listeners). They bind
  `127.0.0.1` only — they are NOT public listeners. The only public surface is nginx `:443`
  TLS, exactly like the existing `/afrowsws` customer entry.
- The **customer side is always VLESS over WS behind nginx TLS**, regardless of which
  transport the chosen Hexogate front uses. The inbound is cloned from
  `AFROWS_HEXO_CLONE_INBOUND_TAG` (default `afrows-in`, the live ws inbound): same
  `network=ws`, `security=none` and base `wsSettings` as the Iran `:443`/`/afrowsws` entry,
  only the path is swapped to `/afrowsws-<cc>`. Clients that already connect to Afrows over
  WS+TLS need no new transport or fingerprinting. The front's transport (REALITY / TLS / SS)
  is an **Afrows → Hexogate** detail hidden inside the `hexo-<cc>` outbound.

## nginx snippet (customer-facing INBOUND side)

The reconciler creates the loopback xray inbounds; nginx must expose one TLS+WS location
per country on the `app.afrows.com` `:443` server block, the per-country twin of the
existing `location /afrowsws { proxy_pass http://127.0.0.1:8447; }`. The snippet lives at
`infra/ubuntu/nginx/afrows-hexo-ws.conf` (7 static `location = /afrowsws-<cc>` blocks,
each proxying the WS upgrade to `127.0.0.1:<port>` per the port map above). It is
**included into** the `app.afrows.com` server block and applied additively with:

```
nginx -t && systemctl reload nginx     # reload, NOT restart; no downtime for existing links
```

The snippet is static (ports are fixed by `AFROWS_HEXO_ENTRY_PORTS`), so it is applied once
and does not change when the reconciler re-resolves countries.

## Entry kind mapping (backend)

- `ClientEntryLinkKind` gains `hexo`. All seven countries map to the **single** kind
  `hexo` (the per-country distinction is the remark `Hexo <CC>`), so the server-access
  type space is not forked seven ways.
- The subscription label base is `PUBLIC_ENTRY_LINK_REMARKS.hexo = "Hexo"`; the builder
  appends the country code (`Hexo DE`). Customer-facing remark: `<name> · Hexo <CC>`.
- **Per-customer gating:** `hexo` is a foreign exit, so a customer sees Hexo entries only
  when they are allowed at least one existing foreign server (`germany || usa`). This
  reuses the existing `customer_accounts` server-access flags with **no new column /
  migration** and keeps the 3-key `CustomerServerAccess` shape intact (all existing tests
  stay green). Recommended future upgrade: a dedicated `access_hexo` column for
  independent control (see the migration plan / hand-off note).

## Env contract (read by BOTH the reconciler and the backend)

| Var | Read by | Meaning |
|-----|---------|---------|
| `AFROWS_HEXO_SUB_URL` | reconciler | Full https subscription URL incl. token. **Secret** — env only, never logged/committed. Unset → reconciler is a no-op. |
| `AFROWS_HEXO_COUNTRIES` | reconciler | CSV of countries to resolve. Default `DE,NL,SE,TR,US,AM,RO`. |
| `AFROWS_HEXO_ENTRY_PORTS` | reconciler **and** backend | `CC:port` CSV. Default `DE:8460,NL:8461,SE:8462,TR:8463,US:8464,AM:8465,RO:8466`. The single source of truth tying each `hexo-in-<cc>` listener to the port the `Hexo <CC>` entry link dials. |
| `AFROWS_HEXO_CLONE_INBOUND_TAG` | reconciler | The customer ws inbound whose IDENTITY (`streamSettings` incl. `wsSettings`, `network=ws`, `security=none`) is cloned; the reconciler keeps `listen=127.0.0.1` and swaps the path to `/afrowsws-<cc>`. Its client list is NOT cloned — the hexo inbounds are created EMPTY; only entitlement-gated `adu` adds customers (fail-closed by construction). Default `afrows-in`. |
| `AFROWS_HEXO_HEALTHCHECK` | reconciler | `1`/on (default) probes each candidate front and keeps only one whose PROBED exit country matches the label; `0`/`off`/`false`/`no` falls back to rank-only `select_per_country`. |
| `AFROWS_HEXO_XRAY_BIN` | reconciler | xray binary for the throwaway probe instance. Default = `AFROWS_XRAY_BIN` (`/usr/local/bin/xray`). |
| `AFROWS_HEXO_PROBE_URL` | reconciler | Exit-country probe URL. Default `https://www.cloudflare.com/cdn-cgi/trace` (UNLIMITED; returns a `loc=XX` line — do NOT use ipinfo, it rate-limits). |
| `AFROWS_HEXO_PROBE_TIMEOUT` | reconciler | Per-probe curl timeout (seconds). Default `10`. |
| `AFROWS_HEXO_PROBE_MAX_CANDIDATES` | reconciler | Max fronts probed per country before giving up. Default `4`. |
| `AFROWS_HEXO_PROBE_BUDGET_SECS` | reconciler | Total wall-clock cap for all probing in one tick; once spent, un-probed countries are left to keep-last-good. Default `90`. |
| `AFROWS_HEXO_ENTRY_ENABLED` | backend | Gate (default off) for emitting `hexo` entries in subscriptions. |
| `AFROWS_HEXO_ENTRY_HOST` | backend | Entry host customers dial (default `AFROWS_INBOUND_HOST`, the Afrows Iran server). The entry is TLS+WS on `:443`, path `/afrowsws-<cc>` (backend-owned; see the WS entry-transport note). |
| `AFROWS_XRAY_INBOUND_TAGS` | provisioning (**REQUIRED**) | Add `hexo-in-<cc>:<port>` (2-part, WS — **no** `:xtls-rprx-vision` flow suffix, matching the ws inbound) so `XrayProvisioningService` registers **entitled** customers (`access_hexo=true`) onto the hexo inbounds (`xray api adu`), and rmu's non-entitled ones. REQUIRED: the hexo inbounds are cloned with an EMPTY client list, so without this tag listing NO customer can authenticate on them (entitled customers' `Hexo <CC>` links would be dead), and the data-plane gate has nothing to enforce. This listing is what makes the gate fail-closed in practice. |

## Health-check & exit-country enforcement

Live probing from the Iran box showed two failure modes that rank-only selection cannot
catch: (a) several REALITY fronts are dead at any moment while their TLS/HTTP siblings for
the same country work, and (b) some fronts exit in the WRONG country (a "DE"-labelled front
exiting in NL). So, by default (`AFROWS_HEXO_HEALTHCHECK=1`), the reconciler PROBES before
it selects:

- `probe_front(front)` stands up a throwaway xray (`AFROWS_HEXO_XRAY_BIN`) with a localhost
  socks inbound → `build_outbound(front)`, curls `AFROWS_HEXO_PROBE_URL` through it, and
  parses the `loc=XX` line as the exit country. Bounded timeouts, never raises, and always
  reaps the process + removes the temp config (no zombies, no port collisions — a fresh
  ephemeral loopback port per probe).
- `health_select_per_country` probes each country's candidates in `_rank` order and takes
  the FIRST whose exit country matches the label. STABILITY: the previously-good front
  (persisted in the state file under `fronts`) is probed first and kept while it still
  passes, so a healthy country does not churn. COST CAPS: stop at the first pass per
  country, at most `AFROWS_HEXO_PROBE_MAX_CANDIDATES` probes per country, and a total
  `AFROWS_HEXO_PROBE_BUDGET_SECS` wall-clock cap.

**Keep-last-good ↔ resolved-countries file.** Only countries that PASS the probe this tick
(`healthy`) are written to `hexo-resolved.json`, so the backend advertises a `Hexo <CC>`
link only for a verified-working, correctly-geolocated country. The interaction with
keep-last-good:

- **Passes this tick** → fresh outbound + inbound + routing, and listed in the resolved file
  (advertised).
- **Fails this tick but had a last-good** (no sibling passes) → its last-good `hexo-<cc>`
  outbound (and inbound/rule) STAYS in the config so in-flight sessions are not ripped out,
  but the country is EXCLUDED from the resolved file, so the backend hides the link until it
  probes healthy again.
- **Absent from this shard** (sharded sub) → same as above: last-good kept in config,
  hidden from the resolved file until it is re-fetched and re-verified.
- `AFROWS_HEXO_HEALTHCHECK=0` → rank-only selection and the resolved file reverts to
  config-presence-only (a live inbound+outbound is advertised without a probe).

## Co-management with `afrows-egress-mode-sync.py`

Both reconcilers write `afrows-xray/config.json`, so hexo lives in the **same xray
instance** (required for per-user metering to aggregate). The egress reconciler rebuilds
`routing.rules` every minute; a one-line additive hook (`hexo_rules_of`) makes it carry
forward any `hexo-in-* -> hexo-*` rule verbatim, so it never wipes them and the
via-germany/via-usa/via-backup ladder is untouched. Timers are offset; both are idempotent
and converge, so a rare overlap costs at most one extra restart.
